import { prisma } from "./server/db.js";

type DefaultCategory = { name: string; color: string; icon: string; type: "income" | "expense" };

const personalDefaultCategories: DefaultCategory[] = [
  { name: "Alimentação", color: "#f97316", icon: "Utensils", type: "expense" as const },
  { name: "Transporte", color: "#14b8a6", icon: "Car", type: "expense" as const },
  { name: "Moradia", color: "#6366f1", icon: "Home", type: "expense" as const },
  { name: "Saúde", color: "#ef4444", icon: "Heart", type: "expense" as const },
  { name: "Educação", color: "#0ea5e9", icon: "BookOpen", type: "expense" as const },
  { name: "Lazer", color: "#8b5cf6", icon: "Gamepad2", type: "expense" as const },
  { name: "Compras", color: "#f472b6", icon: "ShoppingCart", type: "expense" as const },
  { name: "Assinaturas", color: "#f59e0b", icon: "CreditCard", type: "expense" as const },
  { name: "Salário", color: "#16a34a", icon: "DollarSign", type: "income" as const },
  { name: "Investimentos", color: "#0f172a", icon: "Target", type: "income" as const },
];

const businessDefaultCategories: DefaultCategory[] = [
  { name: "Vendas", color: "#16a34a", icon: "Receipt", type: "income" as const },
  { name: "Serviços", color: "#22c55e", icon: "Handshake", type: "income" as const },
  { name: "Assinaturas recorrentes", color: "#0ea5e9", icon: "Wifi", type: "income" as const },
  { name: "Operacional", color: "#475569", icon: "Briefcase", type: "expense" as const },
  { name: "Marketing", color: "#ec4899", icon: "Target", type: "expense" as const },
  { name: "Tecnologia", color: "#3b82f6", icon: "Laptop", type: "expense" as const },
  { name: "Folha de pagamento", color: "#1d4ed8", icon: "Users", type: "expense" as const },
  { name: "Tributos e taxas", color: "#b45309", icon: "Receipt", type: "expense" as const },
  { name: "Fornecedores", color: "#059669", icon: "Car", type: "expense" as const },
  { name: "Viagens", color: "#0f766e", icon: "Plane", type: "expense" as const },
  { name: "Outros custos", color: "#6b7280", icon: "Lightbulb", type: "expense" as const },
];

function getDefaultsByType(type: "personal" | "business"): DefaultCategory[] {
  return type === "business" ? businessDefaultCategories : personalDefaultCategories;
}

function getOppositeDefaults(type: "personal" | "business"): DefaultCategory[] {
  return type === "business" ? personalDefaultCategories : businessDefaultCategories;
}

async function ensureCategoriesForAccount(accountId: number, accountType: "personal" | "business") {
  const defaults = getDefaultsByType(accountType);
  const conflictingDefaults = getOppositeDefaults(accountType).map((category) => category.name);

  if (conflictingDefaults.length > 0) {
    const deleted = await prisma.category.deleteMany({
      where: {
        accountId,
        name: { in: conflictingDefaults },
      },
    });

    if (deleted.count > 0) {
      console.log(`🧹 Removidas ${deleted.count} categorias do tipo oposto na conta ${accountId}`);
    }
  }

  const existingCategories = await prisma.category.findMany({ where: { accountId } });
  const existingNames = new Set(existingCategories.map((category) => category.name.toLowerCase()));

  const missingCategories = defaults.filter((category) => !existingNames.has(category.name.toLowerCase()));

  if (missingCategories.length === 0) {
    console.log(`✅ Categorias alinhadas para a conta ${accountId} (${accountType})`);
    return;
  }

  console.log(`🆕 Criando ${missingCategories.length} categorias para a conta ${accountId} (${accountType})...`);

  await prisma.category.createMany({
    data: missingCategories.map((category) => ({
      ...category,
      accountId,
    })),
  });

  console.log(`✅ Categorias criadas para a conta ${accountId}`);
}

async function checkAndCreateDefaultAccount() {
  try {
    console.log("🔍 Verificando contas existentes...");
    
    const existingAccounts = await prisma.account.findMany({
      include: {
        bankAccounts: true,
      },
      orderBy: {
        id: "asc",
      },
    });
    console.log(`📊 Contas encontradas: ${existingAccounts.length}`);
    
    if (existingAccounts.length > 0) {
      console.log("✅ Contas existentes:");
      existingAccounts.forEach((account) => {
        console.log(`  - ID: ${account.id}, Nome: ${account.name}, Tipo: ${account.type}`);
      });
      
      for (const account of existingAccounts) {
        console.log(`  📱 Contas bancárias para ${account.name}: ${account.bankAccounts.length}`);
        account.bankAccounts.forEach((bankAccount) => {
          console.log(`    - ${bankAccount.name}: R$ ${bankAccount.initialBalance}`);
        });
      }
    } else {
      console.log("⚠️ Nenhuma conta encontrada! Criando conta padrão...");
      
      const newAccount = await prisma.account.create({
        data: {
          name: "Conta Principal",
          type: "personal",
        },
      });
      
      console.log("✅ Conta criada:", newAccount);
      
      const newBankAccount = await prisma.bankAccount.create({
        data: {
          name: "Conta Corrente",
          initialBalance: "1000.00",
          pix: "",
          accountId: newAccount.id,
        },
      });
      
      console.log("✅ Conta bancária criada:", newBankAccount);
      
      await ensureCategoriesForAccount(newAccount.id, newAccount.type);
      
      console.log("✅ Categorias padrão criadas!");
    }

    for (const account of existingAccounts) {
      await ensureCategoriesForAccount(account.id, account.type as "personal" | "business");
    }
    
  } catch (error) {
    console.error("❌ Erro ao verificar/criar conta:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAndCreateDefaultAccount();
