import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AccountProvider } from "@/contexts/AccountContext";
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

function Router() {
  return (
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
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AccountProvider>
          <Toaster />
          <Router />
          <FloatingChatButton />
        </AccountProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
