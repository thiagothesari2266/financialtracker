interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

class RateLimiter {
  private store: RateLimitStore = {};
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 10) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;

    // Limpa registros expirados a cada minuto
    setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  private cleanup() {
    const now = Date.now();
    Object.keys(this.store).forEach((key) => {
      if (this.store[key].resetTime < now) {
        delete this.store[key];
      }
    });
  }

  public checkLimit(identifier: string): { allowed: boolean; resetTime?: number } {
    const now = Date.now();
    const record = this.store[identifier];

    if (!record || record.resetTime < now) {
      // Primeira requisição ou janela expirada
      this.store[identifier] = {
        count: 1,
        resetTime: now + this.windowMs,
      };
      return { allowed: true };
    }

    if (record.count >= this.maxRequests) {
      return {
        allowed: false,
        resetTime: record.resetTime,
      };
    }

    record.count++;
    return { allowed: true };
  }
}

// Rate limiter para AI chat: 10 mensagens por minuto por conta
export const aiChatRateLimit = new RateLimiter(60000, 10);

export function createRateLimitMiddleware(rateLimiter: RateLimiter) {
  return (req: any, res: any, next: any) => {
    const accountId = req.params.id;
    const identifier = `ai-chat:${accountId}`;

    const result = rateLimiter.checkLimit(identifier);

    if (!result.allowed) {
      const resetInSeconds = Math.ceil((result.resetTime! - Date.now()) / 1000);
      return res.status(429).json({
        message: `Muitas requisições. Tente novamente em ${resetInSeconds} segundos.`,
        resetTime: result.resetTime,
      });
    }

    next();
  };
}
