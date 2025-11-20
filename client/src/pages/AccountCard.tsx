import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Account } from "@shared/schema";
import React from "react";

interface AccountCardProps {
  account: Account;
  onSelect: (account: Account) => void;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
  hasTransactions: boolean;
}

export function AccountCard({ account, onSelect, onEdit, onDelete, hasTransactions }: AccountCardProps) {
  return (
    <Card
      key={account.id}
      className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-primary/50 relative"
      onClick={() => onSelect(account)}
    >
      <div className="absolute top-2 right-2 flex gap-2 z-10">
        <Button size="icon" variant="ghost" onClick={e => { e.stopPropagation(); onEdit(account); }}><i className="fas fa-edit" /></Button>
        <Button size="icon" variant="ghost"
          onClick={e => {
            e.stopPropagation();
            if (hasTransactions) {
              alert('Não é possível excluir uma conta com transações vinculadas.');
              return;
            }
            onDelete(account);
          }}
        >
          <i className="fas fa-trash" />
        </Button>
      </div>
      <div className="p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">{account.name}</h2>
        <p className="text-sm text-slate-600 mb-2 capitalize">{account.type === 'personal' ? 'Pessoal' : 'Empresarial'}</p>
        {/* Adicione saldo ou outras infos aqui se desejar */}
      </div>
    </Card>
  );
}
