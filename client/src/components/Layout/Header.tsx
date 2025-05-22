import { ChevronLeft, ChevronRight, Plus, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/contexts/AccountContext";
import { useState } from "react";

interface HeaderProps {
  currentMonth: string;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onAddTransaction: () => void;
}

export default function Header({ 
  currentMonth, 
  onPreviousMonth, 
  onNextMonth, 
  onAddTransaction 
}: HeaderProps) {
  const { currentAccount } = useAccount();

  const formatMonth = (month: string) => {
    const date = new Date(month + "-01");
    return date.toLocaleDateString('pt-BR', { 
      month: 'long', 
      year: 'numeric' 
    }).replace(/^\w/, c => c.toUpperCase());
  };

  return (
    <header className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-4 lg:py-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {/* Mobile Menu Button */}
          <Button 
            variant="ghost" 
            size="sm"
            className="lg:hidden p-2"
          >
            <Menu className="h-5 w-5 text-slate-600" />
          </Button>
          
          <div>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900">Dashboard Financeiro</h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1 hidden sm:block">
              Visão geral da conta <span className="font-medium">{currentAccount?.name}</span>
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* Month Selector */}
          <div className="flex items-center space-x-1 sm:space-x-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onPreviousMonth}
              className="p-1.5 sm:p-2 hover:bg-slate-100"
            >
              <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4 text-slate-400" />
            </Button>
            <span className="font-medium text-slate-900 text-xs sm:text-sm lg:text-base min-w-20 sm:min-w-32 text-center">
              {formatMonth(currentMonth)}
            </span>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onNextMonth}
              className="p-1.5 sm:p-2 hover:bg-slate-100"
            >
              <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 text-slate-400" />
            </Button>
          </div>
          
          <Button 
            onClick={onAddTransaction}
            size="sm"
            className="bg-primary text-white hover:bg-blue-600 transition-colors duration-200 text-xs sm:text-sm"
          >
            <Plus className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Nova Transação</span>
            <span className="sm:hidden">+</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
