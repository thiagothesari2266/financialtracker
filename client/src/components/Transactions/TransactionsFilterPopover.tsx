import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useCategories } from '@/hooks/useCategories';
import type { BankAccount, CreditCard } from '@shared/schema';

export interface TransactionFilters {
  types: Set<'income' | 'expense'>;
  statuses: Set<'paid' | 'pending' | 'overdue'>;
  categoryIds: Set<number>;
  bankAccountIds: Set<number>;
  creditCardIds: Set<number>;
  launchTypes: Set<'unica' | 'parcelada' | 'recorrente' | 'fatura'>;
  amountMin: string;
  amountMax: string;
}

export function emptyFilters(): TransactionFilters {
  return {
    types: new Set(),
    statuses: new Set(),
    categoryIds: new Set(),
    bankAccountIds: new Set(),
    creditCardIds: new Set(),
    launchTypes: new Set(),
    amountMin: '',
    amountMax: '',
  };
}

export function countActiveFilters(filters: TransactionFilters): number {
  return (
    filters.types.size +
    filters.statuses.size +
    filters.categoryIds.size +
    filters.bankAccountIds.size +
    filters.creditCardIds.size +
    filters.launchTypes.size +
    (filters.amountMin !== '' ? 1 : 0) +
    (filters.amountMax !== '' ? 1 : 0)
  );
}

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

interface Props {
  filters: TransactionFilters;
  onChange: (filters: TransactionFilters) => void;
  accountId: number;
  bankAccounts: BankAccount[];
  creditCards: CreditCard[];
}

const SECTION_LABEL = 'text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block';
const CHECKBOX_ROW = 'flex items-center gap-2 py-0.5';

export function TransactionsFilterPopover({
  filters,
  onChange,
  accountId,
  bankAccounts,
  creditCards,
}: Props) {
  const { data: categories = [] } = useCategories(accountId);
  const activeCount = countActiveFilters(filters);

  function setTypes(types: Set<'income' | 'expense'>) {
    onChange({ ...filters, types });
  }
  function setStatuses(statuses: Set<'paid' | 'pending' | 'overdue'>) {
    onChange({ ...filters, statuses });
  }
  function setCategoryIds(categoryIds: Set<number>) {
    onChange({ ...filters, categoryIds });
  }
  function setBankAccountIds(bankAccountIds: Set<number>) {
    onChange({ ...filters, bankAccountIds });
  }
  function setCreditCardIds(creditCardIds: Set<number>) {
    onChange({ ...filters, creditCardIds });
  }
  function setLaunchTypes(launchTypes: Set<'unica' | 'parcelada' | 'recorrente' | 'fatura'>) {
    onChange({ ...filters, launchTypes });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="relative">
          <Filter className="mr-2 h-4 w-4" />
          Filtros
          {activeCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-2 h-5 min-w-5 px-1 text-xs"
            >
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[360px] p-0"
      >
        <div className="max-h-[70vh] overflow-y-auto p-4 space-y-4">

          {/* Tipo */}
          <div>
            <span className={SECTION_LABEL}>Tipo</span>
            <div className={CHECKBOX_ROW}>
              <Checkbox
                id="type-income"
                checked={filters.types.has('income')}
                onCheckedChange={() => setTypes(toggleInSet(filters.types, 'income'))}
              />
              <Label htmlFor="type-income" className="cursor-pointer font-normal">Receita</Label>
            </div>
            <div className={CHECKBOX_ROW}>
              <Checkbox
                id="type-expense"
                checked={filters.types.has('expense')}
                onCheckedChange={() => setTypes(toggleInSet(filters.types, 'expense'))}
              />
              <Label htmlFor="type-expense" className="cursor-pointer font-normal">Despesa</Label>
            </div>
          </div>

          <Separator />

          {/* Status */}
          <div>
            <span className={SECTION_LABEL}>Status</span>
            <div className={CHECKBOX_ROW}>
              <Checkbox
                id="status-paid"
                checked={filters.statuses.has('paid')}
                onCheckedChange={() => setStatuses(toggleInSet(filters.statuses, 'paid'))}
              />
              <Label htmlFor="status-paid" className="cursor-pointer font-normal">Pago</Label>
            </div>
            <div className={CHECKBOX_ROW}>
              <Checkbox
                id="status-pending"
                checked={filters.statuses.has('pending')}
                onCheckedChange={() => setStatuses(toggleInSet(filters.statuses, 'pending'))}
              />
              <Label htmlFor="status-pending" className="cursor-pointer font-normal">Pendente</Label>
            </div>
            <div className={CHECKBOX_ROW}>
              <Checkbox
                id="status-overdue"
                checked={filters.statuses.has('overdue')}
                onCheckedChange={() => setStatuses(toggleInSet(filters.statuses, 'overdue'))}
              />
              <Label htmlFor="status-overdue" className="cursor-pointer font-normal">Em atraso</Label>
            </div>
          </div>

          <Separator />

          {/* Categoria */}
          {categories.length > 0 && (
            <>
              <div>
                <span className={SECTION_LABEL}>Categoria</span>
                {categories.map((cat) => (
                  <div key={cat.id} className={CHECKBOX_ROW}>
                    <Checkbox
                      id={`cat-${cat.id}`}
                      checked={filters.categoryIds.has(cat.id)}
                      onCheckedChange={() =>
                        setCategoryIds(toggleInSet(filters.categoryIds, cat.id))
                      }
                    />
                    <Label htmlFor={`cat-${cat.id}`} className="cursor-pointer font-normal">
                      {cat.name}
                    </Label>
                  </div>
                ))}
              </div>
              <Separator />
            </>
          )}

          {/* Conta bancária */}
          {bankAccounts.length > 0 && (
            <>
              <div>
                <span className={SECTION_LABEL}>Conta bancária</span>
                {bankAccounts.map((ba) => (
                  <div key={ba.id} className={CHECKBOX_ROW}>
                    <Checkbox
                      id={`ba-${ba.id}`}
                      checked={filters.bankAccountIds.has(ba.id)}
                      onCheckedChange={() =>
                        setBankAccountIds(toggleInSet(filters.bankAccountIds, ba.id))
                      }
                    />
                    <Label htmlFor={`ba-${ba.id}`} className="cursor-pointer font-normal">
                      {ba.name}
                    </Label>
                  </div>
                ))}
              </div>
              <Separator />
            </>
          )}

          {/* Cartão de crédito */}
          {creditCards.length > 0 && (
            <>
              <div>
                <span className={SECTION_LABEL}>Cartão de crédito</span>
                {creditCards.map((cc) => (
                  <div key={cc.id} className={CHECKBOX_ROW}>
                    <Checkbox
                      id={`cc-${cc.id}`}
                      checked={filters.creditCardIds.has(cc.id)}
                      onCheckedChange={() =>
                        setCreditCardIds(toggleInSet(filters.creditCardIds, cc.id))
                      }
                    />
                    <Label htmlFor={`cc-${cc.id}`} className="cursor-pointer font-normal">
                      {cc.name}
                    </Label>
                  </div>
                ))}
              </div>
              <Separator />
            </>
          )}

          {/* Tipo de lançamento */}
          <div>
            <span className={SECTION_LABEL}>Tipo de lançamento</span>
            {(
              [
                { value: 'unica', label: 'Única' },
                { value: 'parcelada', label: 'Parcelada' },
                { value: 'recorrente', label: 'Recorrente' },
                { value: 'fatura', label: 'Fatura' },
              ] as const
            ).map(({ value, label }) => (
              <div key={value} className={CHECKBOX_ROW}>
                <Checkbox
                  id={`lt-${value}`}
                  checked={filters.launchTypes.has(value)}
                  onCheckedChange={() =>
                    setLaunchTypes(toggleInSet(filters.launchTypes, value))
                  }
                />
                <Label htmlFor={`lt-${value}`} className="cursor-pointer font-normal">
                  {label}
                </Label>
              </div>
            ))}
          </div>

          <Separator />

          {/* Faixa de valor */}
          <div>
            <span className={SECTION_LABEL}>Faixa de valor</span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="Mínimo"
                value={filters.amountMin}
                onChange={(e) => onChange({ ...filters, amountMin: e.target.value })}
                className="h-8 text-sm"
                min={0}
              />
              <span className="text-muted-foreground text-sm">-</span>
              <Input
                type="number"
                placeholder="Máximo"
                value={filters.amountMax}
                onChange={(e) => onChange({ ...filters, amountMax: e.target.value })}
                className="h-8 text-sm"
                min={0}
              />
            </div>
          </div>

          {/* Limpar filtros */}
          {activeCount > 0 && (
            <>
              <Separator />
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => onChange(emptyFilters())}
              >
                Limpar filtros
              </Button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
