import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AccountProvider, useAccount } from "@/contexts/AccountContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Dashboard from "@/pages/Dashboard";
import AccountSelector from "@/pages/AccountSelector";
import Transactions from "@/pages/Transactions";
import Categories from "@/pages/Categories";
import CreditCards from "@/pages/CreditCards";
import CreditCardInvoice from "@/pages/CreditCardInvoice";
import Reports from "@/pages/Reports";
import Projects from "@/pages/Projects";
import CostCenters from "@/pages/CostCenters";
import NotFound from "@/pages/not-found";
import BankAccounts from "@/pages/BankAccounts";
import Settings from "@/pages/Settings";
import FloatingChatButton from "@/components/Chat/FloatingChatButton";
import LoginPage from "@/pages/Login";

function AuthenticatedRoutes() {
  const { accounts, isLoading } = useAccount();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600">Carregando contas...</div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <Switch>
        <Route component={AccountSelector} />
      </Switch>
    );
  }

  return (
    <>
      <Switch>
        <Route path="/" component={AccountSelector} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/transactions" component={Transactions} />
        <Route path="/categories" component={Categories} />
        <Route path="/credit-cards" component={CreditCards} />
        <Route path="/credit-card-invoice" component={CreditCardInvoice} />
        <Route path="/reports" component={Reports} />
        <Route path="/projects" component={Projects} />
        <Route path="/cost-centers" component={CostCenters} />
        <Route path="/accounts" component={AccountSelector} />
        <Route path="/bank-accounts" component={BankAccounts} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
      <FloatingChatButton />
    </>
  );
}

function UnauthenticatedRoutes() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route component={LoginPage} />
    </Switch>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return <UnauthenticatedRoutes />;
  }

  return (
    <AccountProvider>
      <AuthenticatedRoutes />
    </AccountProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <AppContent />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
