import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, PlusCircle, Building2, User2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { useAccount } from "@/contexts/AccountContext";
import type { Account } from "@shared/schema";
import { cn } from "@/lib/utils";
import AccountModal from "@/components/Modals/AccountModal";

const accountTypeLabels: Record<Account["type"], string> = {
  personal: "Pessoal",
  business: "Empresarial",
};

const accountTypeBadgeClass: Record<Account["type"], string> = {
  personal: "bg-blue-50 text-blue-700 border-blue-100",
  business: "bg-slate-900/5 text-slate-900 border-slate-200",
};

export function AccountSwitcher() {
  const { accounts, currentAccount, setCurrentAccount } = useAccount();
  const [open, setOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const orderedAccounts = useMemo(() => {
    return [...accounts].sort((a, b) => a.name.localeCompare(b.name));
  }, [accounts]);

  const handleSelect = (account: Account) => {
    setCurrentAccount(account);
    setOpen(false);
  };

  const handleAccountCreated = (account: Account) => {
    setCurrentAccount(account);
    setIsModalOpen(false);
    setOpen(false);
  };

  const CurrentIcon = currentAccount?.type === "business" ? Building2 : User2;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-12 w-full justify-between gap-3 rounded-lg border-sidebar-border bg-sidebar px-3 text-left font-normal text-sidebar-foreground shadow-none"
          >
            {currentAccount ? (
              <div className="flex flex-1 items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <CurrentIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold leading-tight">
                    {currentAccount.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground/80">
                    {accountTypeLabels[currentAccount.type]}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <User2 className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">Selecionar conta</span>
              </div>
            )}
            <ChevronsUpDown className="h-4 w-4 flex-shrink-0 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar conta..." />
            <CommandList>
              <CommandEmpty>Nenhuma conta encontrada</CommandEmpty>
              <CommandGroup heading="Contas">
                {orderedAccounts.map((account) => {
                  const Icon = account.type === "business" ? Building2 : User2;
                  return (
                    <CommandItem
                      key={account.id}
                      value={account.name}
                      onSelect={() => handleSelect(account)}
                      className="flex items-center justify-between gap-2 rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {account.name}
                          </p>
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-5 rounded-full px-2 text-[10px] uppercase tracking-wide",
                              accountTypeBadgeClass[account.type]
                            )}
                          >
                            {accountTypeLabels[account.type]}
                          </Badge>
                        </div>
                      </div>
                      <Check
                        className={cn(
                          "h-4 w-4",
                          account.id === currentAccount?.id
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  className="gap-2"
                  onSelect={() => {
                    setIsModalOpen(true);
                    setOpen(false);
                  }}
                >
                  <PlusCircle className="h-4 w-4" />
                  Nova conta
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <AccountModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAccountCreated={handleAccountCreated}
      />
    </>
  );
}
