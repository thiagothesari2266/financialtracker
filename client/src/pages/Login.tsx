import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

type Mode = "login" | "register";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { login, register } = useAuth();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = { email: email.trim(), password };
      if (mode === "login") {
        await login(payload);
        toast({ title: "Bem-vindo de volta" });
      } else {
        await register(payload);
        toast({ title: "Conta criada", description: "Você foi autenticado automaticamente." });
      }
      setLocation("/dashboard");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao autenticar";
      toast({ title: message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-slate-900">
            {mode === "login" ? "Acessar painel" : "Criar conta"}
          </CardTitle>
          <CardDescription className="text-slate-600">
            {mode === "login"
              ? "Entre para visualizar e gerenciar seus dados financeiros."
              : "Cadastre-se para começar a usar o Financial Tracker."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={mode === "login" ? 1 : 8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Processando..."
                : mode === "login"
                ? "Entrar"
                : "Registrar"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-600">
            {mode === "login" ? (
              <span>
                Ainda não tem conta?{" "}
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 font-medium text-primary"
                  onClick={() => setMode("register")}
                >
                  Criar agora
                </Button>
              </span>
            ) : (
              <span>
                Já possui cadastro?{" "}
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 font-medium text-primary"
                  onClick={() => setMode("login")}
                >
                  Fazer login
                </Button>
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
