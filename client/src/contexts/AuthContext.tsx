import { createContext, useContext, type ReactNode, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthenticatedUser, InsertUser, LoginInput } from "@shared/schema";
import { getQueryFn } from "@/lib/queryClient";

interface AuthContextValue {
  user: AuthenticatedUser | null;
  isLoading: boolean;
  login: (credentials: LoginInput) => Promise<void>;
  register: (data: InsertUser) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const SESSION_QUERY_KEY = ["/api/auth/session"] as const;

async function parseResponse(res: Response) {
  if (res.ok) return;
  let message = "Falha ao processar solicitação";
  try {
    const payload = await res.json();
    if (payload?.message) {
      message = payload.message;
    }
  } catch (_) {
    const text = await res.text();
    if (text) message = text;
  }
  throw new Error(message);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const sessionQuery = useQuery<AuthenticatedUser | null>({
    queryKey: SESSION_QUERY_KEY,
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: Infinity,
  });

  const refreshSession = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    await sessionQuery.refetch();
  }, [queryClient, sessionQuery]);

  const resetAppQueries = useCallback(() => {
    queryClient.removeQueries({
      predicate: (query) => {
        const firstKey = Array.isArray(query.queryKey)
          ? (query.queryKey[0] as string | undefined)
          : (query.queryKey as string | undefined);
        return firstKey !== SESSION_QUERY_KEY[0];
      },
    });
  }, [queryClient]);

  const login = useCallback(
    async (credentials: LoginInput) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(credentials),
      });
      await parseResponse(res);
      resetAppQueries();
      await refreshSession();
    },
    [refreshSession, resetAppQueries],
  );

  const register = useCallback(
    async (data: InsertUser) => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      await parseResponse(res);
      resetAppQueries();
      await refreshSession();
    },
    [refreshSession, resetAppQueries],
  );

  const logout = useCallback(async () => {
    const res = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok && res.status !== 204) {
      await parseResponse(res);
    }
    resetAppQueries();
    await refreshSession();
  }, [refreshSession, resetAppQueries]);

  const value: AuthContextValue = {
    user: sessionQuery.data ?? null,
    isLoading: sessionQuery.isLoading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return context;
}
