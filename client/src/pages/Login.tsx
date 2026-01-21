import { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useLocation, useSearch } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

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
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
        <div className="mb-8">
          <img src="/logo.png" alt="Nexfin" className="h-14 w-auto" />
        </div>
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-slate-900">Acesso Restrito</CardTitle>
            <CardDescription className="text-slate-600">
              O cadastro é feito apenas por convite. Solicite um convite ao administrador.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => setMode('login')}>
              Voltar para login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <div className="mb-8">
        <img src="/logo.png" alt="Nexfin" className="h-14 w-auto" />
      </div>
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-slate-900">
            {mode === 'login' ? 'Acessar painel' : 'Criar conta'}
          </CardTitle>
          <CardDescription className="text-slate-600">
            {mode === 'login'
              ? 'Entre para visualizar e gerenciar seus dados financeiros.'
              : 'Complete seu cadastro para começar a usar o Nexfin.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {inviteError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
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
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={mode === 'register' && !!inviteData}
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
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="pr-10"
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

            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Processando...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </Button>
          </form>

          {mode === 'register' && (
            <div className="mt-6 text-center text-sm text-slate-600">
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
        </CardContent>
      </Card>
    </div>
  );
}
