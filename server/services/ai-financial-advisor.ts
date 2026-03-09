import OpenAI from 'openai';
import { storage } from '../storage';
import { todayBR, currentMonthBR } from '../utils/date-br';

if (!process.env.OPENAI_API_KEY) {
  console.warn('⚠️  OPENAI_API_KEY não encontrada. Funcionalidade de IA desabilitada.');
}

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

export interface FinancialContext {
  account: {
    id: number;
    name: string;
    type: 'personal' | 'business';
  };
  currentMonth: string;
  stats: {
    totalBalance: string;
    monthlyIncome: string;
    monthlyExpenses: string;
    projectedBalance: string;
  };
  categories: {
    income: Array<{ name: string; total: string; color: string }>;
    expense: Array<{ name: string; total: string; color: string }>;
  };
  recentTransactions: Array<{
    description: string;
    amount: string;
    type: 'income' | 'expense';
    categoryName: string;
    date: string;
  }>;
  creditCards: Array<{
    name: string;
    currentBalance: string;
    creditLimit: string;
    dueDate: number;
  }>;
  bankAccounts: Array<{
    name: string;
    balance: string;
  }>;
}

const SYSTEM_PROMPT = `Você é um assistente financeiro direto e objetivo.

ESTILO DE RESPOSTA:
- Seja DIRETO e CONCISO
- Responda exatamente o que foi perguntado
- Use frases curtas e objetivas
- Evite introduções desnecessárias
- Vá direto ao ponto principal
- Use números específicos quando relevante

INTERPRETAÇÃO CORRETA DOS DADOS:
- "Saldo Atual" = saldo acumulado total da conta (não é sobre o mês)
- "Receitas" e "Despesas" = valores APENAS do mês atual
- "Resultado Mensal" = Receitas - Despesas do mês (exemplo: R$ 1.500 - R$ 300 = R$ 1.200 POSITIVO)

REGRAS IMPORTANTES:
- Quando perguntarem "gastos do mês", responda: "Despesas do mês: R$ X,XX"
- NUNCA chame "Resultado Mensal" de "Saldo Projetado"
- O resultado mensal é INDEPENDENTE do saldo total da conta
- Se resultado mensal for positivo (receitas > despesas), diga que o mês foi BOM
- Se resultado mensal for negativo (receitas < despesas), diga que o mês foi RUIM

FORMATO:
- Use formatação brasileira (R$)
- Use poucos emojis (apenas quando necessário)
- Seja específico com valores
- Termine com 1 sugestão prática quando apropriado`;

export class AIFinancialAdvisor {
  static async getFinancialContext(accountId: number, userId: number): Promise<FinancialContext> {
    try {
      console.log(`[AIFinancialAdvisor] Getting context for account ${accountId}`);
      const currentMonth = currentMonthBR();
      const today = todayBR();

      // Buscar estatísticas da conta
      console.log(
        `[AIFinancialAdvisor] Fetching account stats for ${accountId}, month: ${currentMonth}`
      );
      const stats = await storage.getAccountStats(accountId, currentMonth);
      if (!stats) {
        console.error(`[AIFinancialAdvisor] Account ${accountId} not found`);
        throw new Error('Account not found');
      }

      // Calcular saldo atual (até hoje)
      const transactionsUpToToday = await storage.getTransactionsByDateRange(
        accountId,
        '1900-01-01',
        today
      );
      const currentBalance = transactionsUpToToday
        .filter((t) => t.paid) // Apenas transações pagas
        .reduce((sum, t) => {
          return t.type === 'income' ? sum + parseFloat(t.amount) : sum - parseFloat(t.amount);
        }, 0);

      console.log(`[AIFinancialAdvisor] Raw data for month ${currentMonth}:`);
      console.log(`- Account Stats monthlyIncome: ${stats.monthlyIncome}`);
      console.log(`- Account Stats monthlyExpenses: ${stats.monthlyExpenses}`);
      console.log(`- Calculated currentBalance: ${currentBalance.toFixed(2)}`);
      console.log(
        `- Calculated projectedBalance: ${(parseFloat(stats.monthlyIncome) - parseFloat(stats.monthlyExpenses)).toFixed(2)}`
      );

      // Buscar categorias com estatísticas
      const categoryStats = await storage.getCategoryStats(accountId, currentMonth);

      // Buscar transações recentes
      const transactions = await storage.getTransactions(accountId, 10);

      // Buscar cartões de crédito
      const creditCards = await storage.getCreditCards(accountId);

      // Buscar contas bancárias
      const bankAccounts = await storage.getBankAccounts(accountId, userId);

      const context: FinancialContext = {
        account: {
          id: stats.id,
          name: stats.name,
          type: stats.type as 'personal' | 'business',
        },
        currentMonth,
        stats: {
          totalBalance: currentBalance.toFixed(2), // Saldo atual até hoje (apenas transações pagas)
          monthlyIncome: stats.monthlyIncome, // Receitas do mês atual
          monthlyExpenses: stats.monthlyExpenses, // Despesas do mês atual
          projectedBalance: (
            parseFloat(stats.monthlyIncome) - parseFloat(stats.monthlyExpenses)
          ).toFixed(2), // Resultado líquido do mês (receitas - despesas)
        },
        categories: {
          income: [], // Categories don't have type field in current implementation
          expense: categoryStats.map((c) => ({
            name: c.categoryName,
            total: c.total,
            color: c.color,
          })),
        },
        recentTransactions: transactions.map((t) => ({
          description: t.description,
          amount: t.amount,
          type: t.type,
          categoryName: t.category?.name || 'Sem categoria',
          date: t.date,
        })),
        creditCards: creditCards.map((cc) => ({
          name: cc.name,
          currentBalance: cc.currentBalance,
          creditLimit: cc.creditLimit,
          dueDate: cc.dueDate,
        })),
        bankAccounts: bankAccounts.map((ba) => ({
          name: ba.name,
          balance: ba.initialBalance, // Assumindo que é o saldo atual
        })),
      };

      console.log(`[AIFinancialAdvisor] Final context being sent to AI:`);
      console.log(`- totalBalance: ${context.stats.totalBalance}`);
      console.log(`- monthlyIncome: ${context.stats.monthlyIncome}`);
      console.log(`- monthlyExpenses: ${context.stats.monthlyExpenses}`);
      console.log(`- projectedBalance: ${context.stats.projectedBalance}`);

      return context;
    } catch (error) {
      console.error('[AIFinancialAdvisor] Error getting financial context:', error);
      console.error('[AIFinancialAdvisor] Stack trace:', error.stack);
      throw error;
    }
  }

  static async analyzeFinances(
    accountId: number,
    userId: number,
    userMessage: string,
    conversationHistory: Array<{ role: string; content: string }> = []
  ): Promise<string> {
    if (!openai) {
      return '❌ Serviço de IA não disponível. Verifique a configuração da OpenAI API.';
    }

    try {
      const context = await this.getFinancialContext(accountId, userId);

      const contextMessage = `
DADOS FINANCEIROS:
Conta: ${context.account.name}
Mês: ${context.currentMonth}

SALDO TOTAL DA CONTA: R$ ${parseFloat(context.stats.totalBalance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

MOVIMENTAÇÃO DO MÊS:
- Receitas: R$ ${parseFloat(context.stats.monthlyIncome).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Despesas: R$ ${parseFloat(context.stats.monthlyExpenses).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Resultado Mensal: R$ ${parseFloat(context.stats.projectedBalance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ${parseFloat(context.stats.projectedBalance) >= 0 ? '(BOM MÊS)' : '(MÊS RUIM)'}

🏷️ CATEGORIAS DE DESPESA (TOP 5):
${context.categories.expense
  .slice(0, 5)
  .map(
    (c) =>
      `- ${c.name}: R$ ${parseFloat(c.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  )
  .join('\n')}

💳 CARTÕES DE CRÉDITO:
${
  context.creditCards
    .map(
      (cc) =>
        `- ${cc.name}: R$ ${parseFloat(cc.currentBalance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (Limite: R$ ${parseFloat(cc.creditLimit).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`
    )
    .join('\n') || 'Nenhum cartão cadastrado'
}

🏦 CONTAS BANCÁRIAS:
${
  context.bankAccounts
    .map(
      (ba) =>
        `- ${ba.name}: R$ ${parseFloat(ba.balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    )
    .join('\n') || 'Nenhuma conta bancária cadastrada'
}

🔄 TRANSAÇÕES RECENTES:
${context.recentTransactions
  .slice(0, 5)
  .map(
    (t) =>
      `- ${t.description}: ${t.type === 'income' ? '+' : '-'}R$ ${parseFloat(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${t.categoryName})`
  )
  .join('\n')}
      `;

      // Construir histórico de mensagens incluindo o contexto financeiro
      const messages = [
        {
          role: 'system' as const,
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user' as const,
          content: `${contextMessage}\n\nPERGUNTA DO USUÁRIO: ${userMessage}`,
        },
      ];

      // Se há histórico de conversa, incluir as mensagens anteriores
      if (conversationHistory.length > 0) {
        // Inserir histórico antes da mensagem atual
        const historyMessages = conversationHistory.map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        }));

        // Manter apenas as últimas 10 mensagens para não exceder o limite de tokens
        const recentHistory = historyMessages.slice(-10);

        messages.splice(1, 0, ...recentHistory);
      }

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 500, // Reduzido para forçar respostas mais concisas
        temperature: 0.3, // Reduzido para respostas mais focadas
      });

      return (
        completion.choices[0]?.message?.content ||
        'Desculpe, não consegui processar sua solicitação.'
      );
    } catch (error) {
      console.error('[AIFinancialAdvisor] Error analyzing finances:', error);
      console.error('[AIFinancialAdvisor] Stack trace:', error.stack);
      if (error.response?.data) {
        console.error('[AIFinancialAdvisor] OpenAI API error:', error.response.data);
      }
      return '❌ Erro ao processar análise financeira. Tente novamente.';
    }
  }
}
