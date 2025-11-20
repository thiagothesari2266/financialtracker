import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Account } from '@shared/schema';

interface AccountContextType {
  currentAccount: Account | null;
  accounts: Account[];
  setCurrentAccount: (account: Account) => void;
  isLoading: boolean;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [currentAccount, setCurrentAccount] = useState<Account | null>(null);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['/api/accounts'],
  });

  // Load saved account from localStorage or set first account as current
  useEffect(() => {
    if ((accounts as Account[]).length > 0 && !currentAccount) {
      // Try to load saved account ID from localStorage
      const savedAccountId = localStorage.getItem('selectedAccountId');
      
      if (savedAccountId) {
        // Find the saved account in the list
        const savedAccount = (accounts as Account[]).find(
          account => account.id === parseInt(savedAccountId)
        );
        
        if (savedAccount) {
          setCurrentAccount(savedAccount);
          return;
        }
      }
      
      // If no saved account or saved account not found, prioritize personal account
      const personalAccount = (accounts as Account[]).find(account => account.type === 'personal');
      setCurrentAccount(personalAccount || (accounts as Account[])[0]);
    }
  }, [accounts, currentAccount]);

  // Custom setCurrentAccount that saves to localStorage
  const handleSetCurrentAccount = (account: Account) => {
    setCurrentAccount(account);
    localStorage.setItem('selectedAccountId', account.id.toString());
  };

  return (
    <AccountContext.Provider
      value={{
        currentAccount,
        accounts: accounts as Account[],
        setCurrentAccount: handleSetCurrentAccount,
        isLoading,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (context === undefined) {
    throw new Error('useAccount must be used within an AccountProvider');
  }
  return context;
}
