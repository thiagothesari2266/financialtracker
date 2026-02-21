import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Pencil, Trash2, Shield, User } from 'lucide-react';
import AdminSidebar from '@/components/Layout/AdminSidebar';
import AdminUserModal from '@/components/Modals/AdminUserModal';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import type { AdminUserView, UpdateUser } from '@shared/schema';

export default function AdminUsers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { users, isLoading } = useAdminUsers();
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<AdminUserView | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUserView | null>(null);

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const searchLower = search.toLowerCase();
    return users.filter((user) => user.email.toLowerCase().includes(searchLower));
  }, [users, search]);

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateUser }) => {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const responseData = await res.json();
        throw new Error(responseData.message || 'Falha ao atualizar usuário');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: 'Usuário atualizado' });
      setEditingUser(null);
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const responseData = await res.json();
        throw new Error(responseData.message || 'Falha ao deletar usuário');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: 'Usuário removido' });
      setDeletingUser(null);
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  const handleSaveUser = (data: UpdateUser) => {
    if (!editingUser) return;
    updateUserMutation.mutate({ id: editingUser.id, data });
  };

  const handleDeleteUser = () => {
    if (!deletingUser) return;
    deleteUserMutation.mutate(deletingUser.id);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getRoleBadge = (role: string) => {
    if (role === 'admin') {
      return (
        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
          <Shield className="w-3 h-3 mr-1" />
          Admin
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-muted text-foreground border-border">
        <User className="w-3 h-3 mr-1" />
        Usuário
      </Badge>
    );
  };

  return (
    <div className="flex min-h-screen bg-muted">
      <AdminSidebar />
      <main className="flex-1 p-6 md:p-8 ml-16 md:ml-64">
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-xl font-semibold">Gerenciar Usuários</h1>
            <p className="text-sm text-muted-foreground">Visualize e gerencie os usuários da plataforma</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Usuários</CardTitle>
              <CardDescription>
                Lista de todos os usuários cadastrados ({users.length})
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Users list */}
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {search ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 bg-muted rounded-lg"
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground truncate">
                            {user.email}
                          </span>
                          {getRoleBadge(user.role)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Criado em {formatDate(user.createdAt)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Limites: {user.maxPersonalAccounts} pessoal, {user.maxBusinessAccounts} empresarial
                          {' | '}
                          Em uso: {user.accountsCount.personal} pessoal, {user.accountsCount.business} empresarial
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingUser(user)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setDeletingUser(user)}
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

      {/* Edit Modal */}
      <AdminUserModal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        user={editingUser}
        onSave={handleSaveUser}
        isSaving={updateUserMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingUser} onOpenChange={() => setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o usuário <strong>{deletingUser?.email}</strong>?
              <br />
              <br />
              Esta ação irá deletar permanentemente:
              <ul className="list-disc list-inside mt-2 text-muted-foreground">
                <li>Todas as contas do usuário</li>
                <li>Todas as transações e categorias</li>
                <li>Cartões de crédito e faturas</li>
                <li>Projetos, clientes e centros de custo</li>
              </ul>
              <br />
              <strong className="text-red-600">Esta ação não pode ser desfeita.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? 'Excluindo...' : 'Excluir usuário'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
