import { useState } from "react";
import { useLocation } from "wouter";
import { ChevronDown, Plus } from "lucide-react";
import { useAccount } from "@/contexts/AccountContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AccountModal from "@/components/Modals/AccountModal";
import type { Account } from "@shared/schema";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const [, setLocation] = useLocation();
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const { currentAccount, accounts, setCurrentAccount } = useAccount();

  const handleAccountSelect = (account: Account) => {
    setCurrentAccount(account);
  };

  const handleAccountCreated = (account: Account) => {
    setCurrentAccount(account);
    setIsAccountModalOpen(false);
  };

  if (!currentAccount) return null;

  const navigationItems = [
    { icon: "fas fa-chart-pie", label: "Dashboard", path: "/dashboard", active: true },
    { icon: "fas fa-exchange-alt", label: "Transações", path: "/transactions" },
    { icon: "fas fa-credit-card", label: "Cartões", path: "/cards" },
    { icon: "fas fa-chart-bar", label: "Relatórios", path: "/reports" },
  ];

  const businessNavigationItems = [
    { icon: "fas fa-users", label: "Clientes", path: "/clients" },
    { icon: "fas fa-project-diagram", label: "Projetos", path: "/projects" },
    { icon: "fas fa-building", label: "Centro de Custo", path: "/cost-centers" },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`w-64 bg-white shadow-sm border-r border-slate-200 fixed h-full z-50 transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0 lg:block`}>
        {/* Account Selector */}
        <div className="p-6 border-b border-slate-200">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full justify-between p-3 h-auto bg-slate-50 hover:bg-slate-100"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                    <i className={`fas ${currentAccount.type === 'business' ? 'fa-building' : 'fa-user'} text-white text-sm`}></i>
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-slate-900 text-sm">{currentAccount.name}</div>
                    <div className="text-xs text-slate-500">
                      {currentAccount.type === 'business' ? 'Empresarial' : 'Pessoal'}
                    </div>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start">
              {accounts.map((account: Account) => (
                <DropdownMenuItem 
                  key={account.id}
                  onClick={() => handleAccountSelect(account)}
                  className="flex items-center space-x-3 p-3"
                >
                  <div className={`w-6 h-6 ${account.type === 'business' ? 'bg-primary' : 'bg-secondary'} rounded flex items-center justify-center`}>
                    <i className={`fas ${account.type === 'business' ? 'fa-building' : 'fa-user'} text-white text-xs`}></i>
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-slate-900">{account.name}</div>
                    <div className="text-xs text-slate-500">
                      {account.type === 'business' ? 'Empresarial' : 'Pessoal'}
                    </div>
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setIsAccountModalOpen(true)}
                className="flex items-center space-x-3 p-3 text-primary"
              >
                <Plus className="h-4 w-4" />
                <span className="font-medium">Nova Conta</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Navigation Menu */}
        <nav className="p-4">
          <ul className="space-y-2">
            {navigationItems.map((item) => (
              <li key={item.path}>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (item.path === "/dashboard") {
                      setLocation("/dashboard");
                    }
                  }}
                  className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                    item.active
                      ? "bg-blue-50 text-primary font-medium"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <i className={`${item.icon} text-sm`}></i>
                  <span>{item.label}</span>
                </a>
              </li>
            ))}

            {/* Business Account Exclusive Features */}
            {currentAccount.type === 'business' && (
              <>
                <li className="pt-4 border-t border-slate-200">
                  <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                    Empresarial
                  </div>
                </li>
                {businessNavigationItems.map((item) => (
                  <li key={item.path}>
                    <a
                      href="#"
                      onClick={(e) => e.preventDefault()}
                      className="flex items-center space-x-3 p-3 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors duration-200"
                    >
                      <i className={`${item.icon} text-sm`}></i>
                      <span>{item.label}</span>
                    </a>
                  </li>
                ))}
              </>
            )}
          </ul>
        </nav>
      </aside>

      <AccountModal 
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        onAccountCreated={handleAccountCreated}
      />
    </>
  );
}
