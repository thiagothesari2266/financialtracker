import { createEntityCrud } from './useEntityCrud';
import type { Debt, InsertDebt } from '@shared/schema';

const crud = createEntityCrud<Debt, InsertDebt>({
  listKey: (accountId) => ['/api/accounts', accountId, 'debts'],
  singleKey: (id) => ['/api/debts', id],
  listPath: (accountId) => `/api/accounts/${accountId}/debts`,
  singlePath: (id) => `/api/debts/${id}`,
});

export const useDebts = crud.useList;
export const useCreateDebt = crud.useCreate;
// useUpdate não usa accountId (deriva do retorno da entity), mas mantém assinatura para compatibilidade
export function useUpdateDebt(_accountId?: number) {
  return crud.useUpdate();
}
export const useDeleteDebt = crud.useDelete;
