export type AsaasEnv = 'production' | 'sandbox';

export interface AsaasFinancialTransaction {
  object: string;
  id: string;
  type: string;
  value: number;
  date: string;
  description: string | null;
  payment?: string | null;
  transfer?: string | null;
  netValue?: number;
}

export interface AsaasListPage<T> {
  object: string;
  hasMore: boolean;
  totalCount: number;
  limit: number;
  offset: number;
  data: T[];
}

export interface ListFinancialTransactionsParams {
  startDate?: string;
  finishDate?: string;
  offset?: number;
  limit?: number;
}

export interface AsaasPayment {
  id: string;
  customer: string | null;
  billingType: string | null;
  value: number;
  description: string | null;
}

export interface AsaasCustomer {
  id: string;
  name: string | null;
  email: string | null;
  cpfCnpj: string | null;
}

const BASE_URLS: Record<AsaasEnv, string> = {
  production: 'https://api.asaas.com/v3',
  sandbox: 'https://api-sandbox.asaas.com/v3',
};

function inferEnv(apiKey: string): AsaasEnv {
  return apiKey.startsWith('$aact_hmlg') || apiKey.includes('sandbox') ? 'sandbox' : 'production';
}

export class AsaasClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey: string, env?: AsaasEnv) {
    if (!apiKey) throw new Error('AsaasClient: apiKey obrigatória');
    this.apiKey = apiKey;
    this.baseUrl = BASE_URLS[env ?? inferEnv(apiKey)];
  }

  private async request<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'access_token': this.apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'nexfin/1.0',
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Asaas ${res.status}: ${body.slice(0, 300)}`);
    }

    return (await res.json()) as T;
  }

  async listFinancialTransactions(
    params: ListFinancialTransactionsParams = {}
  ): Promise<AsaasListPage<AsaasFinancialTransaction>> {
    return this.request<AsaasListPage<AsaasFinancialTransaction>>('/financialTransactions', {
      startDate: params.startDate,
      finishDate: params.finishDate,
      offset: params.offset ?? 0,
      limit: params.limit ?? 100,
    });
  }

  async getPayment(id: string): Promise<AsaasPayment> {
    return this.request<AsaasPayment>(`/payments/${id}`);
  }

  async getCustomer(id: string): Promise<AsaasCustomer> {
    return this.request<AsaasCustomer>(`/customers/${id}`);
  }
}
