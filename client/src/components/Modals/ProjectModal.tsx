import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { insertProjectSchema, type InsertProject, type ProjectWithClient } from "@shared/schema";
import { useCreateProject, useUpdateProject } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { DatePicker } from "@/components/ui/date-picker";
import { format, parse } from "date-fns";

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: number;
  project?: ProjectWithClient | null;
}

export default function ProjectModal({ isOpen, onClose, accountId, project }: ProjectModalProps) {
  const { toast } = useToast();
  const { data: clients = [] } = useClients(accountId);

  const createMutation = useCreateProject(accountId);
  const updateMutation = useUpdateProject();

  const form = useForm<InsertProject>({
    resolver: zodResolver(insertProjectSchema),
    defaultValues: {
      name: project?.name || "",
      description: project?.description || "",
      clientId: project?.clientId || undefined,
      budget: project?.budget || "",
      startDate: project?.startDate || "",
      endDate: project?.endDate || "",
      status: project?.status || "planning",
      accountId: accountId,
    },
  });

  useEffect(() => {
    if (project) {
      form.reset({
        name: project.name,
        description: project.description || "",
        clientId: project.clientId || undefined,
        budget: project.budget || "",
        startDate: project.startDate || "",
        endDate: project.endDate || "",
        status: project.status,
        accountId: accountId,
      });
    } else {
      form.reset({
        name: "",
        description: "",
        clientId: undefined,
        budget: "",
        startDate: "",
        endDate: "",
        status: "planning",
        accountId: accountId,
      });
    }
  }, [project, accountId, form]);

  const onSubmit = async (data: InsertProject) => {
    try {
      if (project) {
        await updateMutation.mutateAsync({ id: project.id, data });
        toast({
          title: "Projeto atualizado!",
          description: `O projeto "${data.name}" foi atualizado com sucesso.`,
        });
      } else {
        await createMutation.mutateAsync(data);
        toast({
          title: "Projeto criado!",
          description: `O projeto "${data.name}" foi criado com sucesso.`,
        });
      }
      form.reset();
      onClose();
    } catch (error) {
      toast({
        title: "Erro",
        description: project ? "Não foi possível atualizar o projeto." : "Não foi possível criar o projeto.",
        variant: "destructive",
      });
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {project ? "Editar Projeto" : "Novo Projeto"}
          </DialogTitle>
          <DialogDescription>
            {project ? "Atualize as informações do projeto." : "Crie um novo projeto para organizar suas atividades."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Projeto</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Desenvolvimento de App" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="planning">Planejamento</SelectItem>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="on-hold">Em Espera</SelectItem>
                        <SelectItem value="completed">Concluído</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Descrição detalhada do projeto..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente</FormLabel>
                    <Select 
                      value={field.value?.toString() || ""} 
                      onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um cliente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Nenhum cliente</SelectItem>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id.toString()}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="budget"
                render={({ field }) => {
                  const numericValue = field.value && !isNaN(Number(field.value)) ? Number(field.value) : null;
                  return (
                    <FormItem>
                      <FormLabel>Orçamento</FormLabel>
                      <FormControl>
                        <CurrencyInput
                          placeholder="0,00"
                          value={numericValue}
                          onValueChange={(val) => field.onChange(val == null ? "" : val.toString())}
                        />
                      </FormControl>
                    </FormItem>
                  );
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Início</FormLabel>
                    <FormControl>
                      <DatePicker
                        date={field.value ? parse(field.value, "yyyy-MM-dd", new Date()) : undefined}
                        onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Término</FormLabel>
                    <FormControl>
                      <DatePicker
                        date={field.value ? parse(field.value, "yyyy-MM-dd", new Date()) : undefined}
                        onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Salvando..." : project ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
