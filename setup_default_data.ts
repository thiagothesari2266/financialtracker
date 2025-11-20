import { prisma } from "./server/db.js";

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
      
      const defaultCategories = [
        { name: "Alimentação", color: "#FF6B35", icon: "Utensils", type: "expense" as const },
        { name: "Transporte", color: "#4ECDC4", icon: "Car", type: "expense" as const },
        { name: "Saúde", color: "#45B7D1", icon: "Heart", type: "expense" as const },
        { name: "Lazer", color: "#96CEB4", icon: "Gamepad2", type: "expense" as const },
        { name: "Fatura do cartão", color: "#FFEAA7", icon: "CreditCard", type: "expense" as const },
        { name: "Salário", color: "#6C5CE7", icon: "DollarSign", type: "income" as const }
      ];
      
      for (const category of defaultCategories) {
        await prisma.category.create({
          data: {
            ...category,
            accountId: newAccount.id,
          },
        });
      }
      
      console.log("✅ Categorias padrão criadas!");
    }
    
  } catch (error) {
    console.error("❌ Erro ao verificar/criar conta:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAndCreateDefaultAccount();
