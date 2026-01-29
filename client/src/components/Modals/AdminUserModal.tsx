import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AdminUserView } from '@shared/schema';

const userFormSchema = z.object({
  role: z.enum(['admin', 'user']),
  maxPersonalAccounts: z.number().int().min(0),
  maxBusinessAccounts: z.number().int().min(0),
});

type UserFormData = z.infer<typeof userFormSchema>;

interface AdminUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AdminUserView | null;
  onSave: (data: UserFormData) => void;
  isSaving: boolean;
}

export default function AdminUserModal({
  isOpen,
  onClose,
  user,
  onSave,
  isSaving,
}: AdminUserModalProps) {
  const form = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      role: 'user',
      maxPersonalAccounts: 1,
      maxBusinessAccounts: 0,
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        role: user.role,
        maxPersonalAccounts: user.maxPersonalAccounts,
        maxBusinessAccounts: user.maxBusinessAccounts,
      });
    }
  }, [user, form]);

  const onSubmit = (data: UserFormData) => {
    onSave(data);
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-slate-900">
            Editar Usuário
          </DialogTitle>
        </DialogHeader>

        <div className="mb-4 p-3 bg-slate-50 rounded-lg">
          <div className="text-sm text-slate-600">Email</div>
          <div className="font-medium text-slate-900">{user.email}</div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Papel</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o papel" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="user">Usuário</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="maxPersonalAccounts"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Máx. Contas Pessoais</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormDescription>
                    Em uso: {user.accountsCount.personal}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="maxBusinessAccounts"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Máx. Contas Empresariais</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormDescription>
                    Em uso: {user.accountsCount.business}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex space-x-3 pt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
