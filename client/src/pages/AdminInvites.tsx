import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Trash2, Copy, Check, Clock, UserCheck, AlertCircle } from 'lucide-react';
import AdminSidebar from '@/components/Layout/AdminSidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import type { Invite } from '@shared/schema';

export default function AdminInvites() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const invitesQuery = useQuery<Invite[]>({
    queryKey: ['/api/admin/invites'],
    queryFn: async () => {
      const res = await fetch('/api/admin/invites');
      if (!res.ok) throw new Error('Falha ao carregar convites');
      return res.json();
    },
  });

  const createInviteMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch('/api/admin/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Falha ao criar convite');
      }
      return res.json();
    },
    onSuccess: (data: { emailSent?: boolean; emailError?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/invites'] });
      setEmail('');

      if (data.emailSent) {
        toast({
          title: 'Convite enviado',
          description: 'O email de convite foi enviado com sucesso.',
        });
      } else {
        toast({
          title: 'Convite criado',
          description: data.emailError
            ? `Email não enviado: ${data.emailError}. Use o link manual.`
            : 'Email não configurado. Use o link manual para convidar.',
          variant: 'default',
        });
      }
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  const deleteInviteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/invites/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha ao deletar convite');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/invites'] });
      toast({ title: 'Convite removido' });
    },
    onError: () => {
      toast({ title: 'Falha ao remover convite', variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    createInviteMutation.mutate(email.trim());
  };

  const copyInviteLink = async (token: string) => {
    const link = `${window.location.origin}/login?invite=${token}`;
    await navigator.clipboard.writeText(link);
    setCopiedToken(token);
    toast({ title: 'Link copiado!' });
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const getStatusBadge = (invite: Invite) => {
    if (invite.status === 'accepted') {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <UserCheck className="w-3 h-3 mr-1" />
          Aceito
        </Badge>
      );
    }

    const isExpired = new Date(invite.expiresAt) < new Date();
    if (isExpired || invite.status === 'expired') {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          <AlertCircle className="w-3 h-3 mr-1" />
          Expirado
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
        <Clock className="w-3 h-3 mr-1" />
        Pendente
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar />
      <main className="flex-1 p-6 md:p-8 ml-16 md:ml-64">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Gerenciar Convites</h1>
            <p className="text-slate-600">Convide novos usuários para a plataforma</p>
          </div>

          {/* Criar convite */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Enviar Convite</CardTitle>
              <CardDescription>
                Digite o email do usuário que você deseja convidar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="flex gap-3">
                <div className="flex-1">
                  <Label htmlFor="email" className="sr-only">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" disabled={createInviteMutation.isPending}>
                  <Mail className="w-4 h-4 mr-2" />
                  {createInviteMutation.isPending ? 'Criando...' : 'Criar Convite'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Lista de convites */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Convites</CardTitle>
              <CardDescription>
                Lista de todos os convites enviados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {invitesQuery.isLoading ? (
                <div className="text-center py-8 text-slate-500">Carregando...</div>
              ) : invitesQuery.data?.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  Nenhum convite enviado ainda
                </div>
              ) : (
                <div className="space-y-3">
                  {invitesQuery.data?.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                    >
                      <div className="space-y-1">
                        <div className="font-medium text-slate-900">{invite.email}</div>
                        <div className="text-sm text-slate-500">
                          Criado em {formatDate(invite.createdAt)}
                          {invite.status === 'pending' && (
                            <> | Expira em {formatDate(invite.expiresAt)}</>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(invite)}
                        {invite.status === 'pending' &&
                          new Date(invite.expiresAt) > new Date() && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyInviteLink(invite.token)}
                            >
                              {copiedToken === invite.token ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => deleteInviteMutation.mutate(invite.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
