import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
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
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Account } from '@shared/schema';

const accountSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  type: z.enum(['personal', 'business']),
});

interface AccountLimits {
  limits: { personal: number; business: number };
  current: { personal: number; business: number };
  canCreate: { personal: boolean; business: boolean };
}

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountCreated: (account: Account) => void;
  account?: Account | null;
  isEdit?: boolean;
  accountLimits?: AccountLimits;
}

export default function AccountModal({
  isOpen,
  onClose,
  onAccountCreated,
  account,
  isEdit,
  accountLimits,
}: AccountModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Determinar qual tipo está disponível para criação
  const canCreatePersonal = accountLimits?.canCreate?.personal ?? true;
  const canCreateBusiness = accountLimits?.canCreate?.business ?? true;

  // Determinar o tipo padrão baseado no que está disponível
  const getDefaultType = (): 'personal' | 'business' => {
    if (account?.type) return account.type;
    if (canCreatePersonal) return 'personal';
    if (canCreateBusiness) return 'business';
    return 'personal';
  };

  const form = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: account?.name || '',
      type: getDefaultType(),
    },
    values: account ? { name: account.name, type: account.type } : undefined,
  });

  // Atualiza o formulário ao abrir para edição
  useEffect(() => {
    if (account) {
      form.reset({ name: account.name, type: account.type });
    } else {
      form.reset({ name: '', type: getDefaultType() });
    }
  }, [account, form, canCreatePersonal, canCreateBusiness]);

  const createAccountMutation = useMutation({
    mutationFn: async (data: z.infer<typeof accountSchema>) => {
      if (isEdit && account) {
        const response = await apiRequest('PATCH', `/api/accounts/${account.id}`, data);
        return response.json();
      } else {
        const response = await apiRequest('POST', '/api/accounts', data);
        return response.json();
      }
    },
    onSuccess: (newAccount: Account) => {
      queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
      toast({
        title: isEdit ? 'Conta atualizada' : 'Sucesso',
        description: isEdit ? 'Conta editada com sucesso' : 'Conta criada com sucesso',
      });
      form.reset();
      onAccountCreated(newAccount);
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || (isEdit ? 'Erro ao editar conta' : 'Erro ao criar conta'),
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: z.infer<typeof accountSchema>) => {
    createAccountMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">Nova Conta</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Conta</FormLabel>
                  <FormControl>
                    <Input placeholder="Digite o nome da conta..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo da Conta</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isEdit || !!account}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="personal" disabled={!canCreatePersonal && !account}>
                        Pessoal {!canCreatePersonal && !account && '(limite atingido)'}
                      </SelectItem>
                      <SelectItem value="business" disabled={!canCreateBusiness && !account}>
                        Empresarial {!canCreateBusiness && !account && '(limite atingido)'}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="bg-muted rounded-lg p-4 mt-4">
              <div className="text-sm text-foreground">
                <strong>Pessoal:</strong> Para controle financeiro individual, despesas domésticas e
                orçamento pessoal.
              </div>
              <div className="text-sm text-foreground mt-2">
                <strong>Empresarial:</strong> Inclui recursos avançados como controle por cliente,
                projeto e centro de custo.
              </div>
            </div>

            <div className="flex space-x-3 pt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={createAccountMutation.isPending}>
                {createAccountMutation.isPending ? 'Criando...' : 'Criar Conta'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
