import { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useLocation, useSearch } from 'wouter';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/Logo';

type Mode = 'login' | 'register';

interface InviteData {
  email: string;
  expiresAt: string;
}

export default function LoginPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const inviteToken = params.get('invite');

  const [mode, setMode] = useState<Mode>(inviteToken ? 'register' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { login } = useAuth();

  // Verificar convite se houver token
  useEffect(() => {
    if (inviteToken) {
      fetch(`/api/auth/invite/${inviteToken}`)
        .then(async (res) => {
          if (!res.ok) {
            const data = await res.json();
            setInviteError(data.message || 'Convite inválido');
            setMode('login');
            return;
          }
          const data = await res.json();
          setInviteData(data);
          setEmail(data.email);
        })
        .catch(() => {
          setInviteError('Erro ao verificar convite');
          setMode('login');
        });
    }
  }, [inviteToken]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        const userData = await login({ email: email.trim(), password });
        toast({ title: 'Bem-vindo de volta' });
        // Redirecionar baseado no role
        if (userData.role === 'admin') {
          setLocation('/admin/invites');
        } else {
          setLocation('/dashboard');
        }
      } else {
        // Registro via convite (sempre role 'user')
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim(),
            password,
            inviteToken,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Falha ao criar conta');
        }

        toast({ title: 'Conta criada', description: 'Você foi autenticado automaticamente.' });
        setLocation('/dashboard');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao autenticar';
      toast({ title: message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Se está no modo registro mas não tem convite válido
  if (mode === 'register' && !inviteData && !inviteToken) {
    return (
      <div className="min-h-screen flex">
        {/* Form side */}
        <div className="flex flex-1 flex-col items-center justify-center px-6 lg:w-1/2">
          <div className="w-full max-w-sm space-y-6">
            <div>
              <Logo className="h-8 w-auto" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Acesso Restrito</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                O cadastro é feito apenas por convite. Solicite um convite ao administrador.
              </p>
            </div>
            <Button className="w-full bg-primary text-primary-foreground" onClick={() => setMode('login')}>
              Voltar para login
            </Button>
          </div>
        </div>
        {/* Brand panel */}
        <BrandPanel />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Form side */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 lg:w-1/2">
        <div className="w-full max-w-sm space-y-6">
          <div>
            <Logo className="h-8 w-auto" />
          </div>

          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {mode === 'login' ? 'Entrar na sua conta' : 'Criar conta'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === 'login'
                ? 'Gerencie suas finanças com inteligência'
                : 'Complete seu cadastro para começar a usar o Nexfin.'}
            </p>
          </div>

          {inviteError && (
            <div className="p-3 rounded-[10px] border border-destructive/30 bg-destructive/10 text-sm text-destructive">
              {inviteError}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                placeholder="seu@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={mode === 'register' && !!inviteData}
                className="bg-background border border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  minLength={mode === 'login' ? 1 : 8}
                  placeholder="Sua senha"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="pr-10 bg-background border border-border"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {mode === 'register' && (
                <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres</p>
              )}
            </div>

            <Button className="w-full mt-6 bg-primary text-primary-foreground" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Processando...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </Button>
          </form>

          {mode === 'register' && (
            <div className="text-center text-sm text-muted-foreground">
              <span>
                Já possui cadastro?{' '}
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 font-medium text-primary"
                  onClick={() => {
                    setMode('login');
                    setLocation('/login');
                  }}
                >
                  Fazer login
                </Button>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Brand panel */}
      <BrandPanel />
    </div>
  );
}

function BrandPanel() {
  return (
    <div className="relative hidden lg:flex lg:w-1/2 flex-col items-center justify-center bg-[#0c1222] overflow-hidden">
      {/* Gradiente radial sutil */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(159,232,112,0.15),_transparent_70%)]" />

      <div className="relative z-10 max-w-md px-8 space-y-8">
        <div className="space-y-3">
          <h2 className="text-3xl font-bold text-white">
            Controle total das suas finanças
          </h2>
          <p className="text-lg text-white/60">
            Acompanhe receitas, despesas, cartões e investimentos em um só lugar.
          </p>
        </div>

        {/* Card mock decorativo */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 space-y-2">
          <p className="text-white/60 text-sm">Saldo total</p>
          <p className="text-white text-2xl font-bold tabular-nums">R$ 24.850,00</p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-xs text-white/40">Atualizado agora</span>
          </div>
        </div>
      </div>
    </div>
  );
}
