import { randomUUID } from 'crypto';
import type { Prisma, Transaction as PrismaTransaction } from '@prisma/client';
import { prisma } from '../db';
import { mapTransaction } from './mappers';
import {
  parseDateInput,
  addMonthsPreserveDay,
  addDays,
  differenceInDays,
  ensureDateString,
} from './utils';
import type { Transaction, InsertTransaction, TransactionWithCategory } from '@shared/schema';

export async function createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
  const installments =
    insertTransaction.installments && insertTransaction.installments > 0
      ? insertTransaction.installments
      : 1;
  const currentInstallment =
    insertTransaction.currentInstallment && insertTransaction.currentInstallment > 0
      ? insertTransaction.currentInstallment
      : 1;

  const baseData: Prisma.TransactionUncheckedCreateInput = {
    description: insertTransaction.description,
    amount: insertTransaction.amount,
    type: insertTransaction.type,
    date: parseDateInput(insertTransaction.date),
    categoryId: insertTransaction.categoryId,
    accountId: insertTransaction.accountId,
    bankAccountId: insertTransaction.bankAccountId ?? null,
    paymentMethod: insertTransaction.paymentMethod ?? null,
    clientName: insertTransaction.clientName ?? null,
    projectName: insertTransaction.projectName ?? null,
    costCenter: insertTransaction.costCenter ?? null,
    installments,
    currentInstallment,
    installmentsGroupId: insertTransaction.installmentsGroupId ?? null,
    recurrenceFrequency: insertTransaction.recurrenceFrequency ?? null,
    recurrenceEndDate: insertTransaction.recurrenceEndDate
      ? parseDateInput(insertTransaction.recurrenceEndDate)
      : null,
    launchType: insertTransaction.launchType ?? null,
    recurrenceGroupId: insertTransaction.recurrenceGroupId ?? null,
    creditCardInvoiceId: insertTransaction.creditCardInvoiceId ?? null,
    creditCardId: insertTransaction.creditCardId ?? null,
    isInvoiceTransaction: insertTransaction.isInvoiceTransaction ?? false,
    paid: insertTransaction.paid ?? false,
    externalId: insertTransaction.externalId ?? null,
  };

  if (
    insertTransaction.launchType === 'recorrente' &&
    insertTransaction.recurrenceFrequency === 'mensal'
  ) {
    const recurrenceGroupId = insertTransaction.recurrenceGroupId ?? randomUUID();
    const recurrenceEndDate = insertTransaction.recurrenceEndDate
      ? parseDateInput(insertTransaction.recurrenceEndDate)
      : null;
    const created = await prisma.transaction.create({
      data: {
        ...baseData,
        recurrenceGroupId,
        recurrenceFrequency: insertTransaction.recurrenceFrequency,
        recurrenceEndDate,
        installments: 1,
        currentInstallment: 1,
      },
      include: { category: true },
    });
    return mapTransaction(created, created.category);
  }

  if (insertTransaction.launchType === 'parcelada' && installments > 1) {
    const installmentsGroupId = randomUUID();
    const baseDate = parseDateInput(insertTransaction.date);
    let first: PrismaTransaction | undefined;

    await prisma.$transaction(async (tx) => {
      for (let installment = 1; installment <= installments; installment++) {
        const installmentDate = addMonthsPreserveDay(baseDate, installment - 1);
        const created = await tx.transaction.create({
          data: {
            ...baseData,
            date: installmentDate,
            installments,
            currentInstallment: installment,
            installmentsGroupId,
            recurrenceFrequency: null,
            recurrenceEndDate: null,
            recurrenceGroupId: null,
          },
        });
        if (installment === 1) {
          first = created;
        }
      }
    });

    if (!first) {
      throw new Error('Falha ao criar transação parcelada');
    }

    const withCategory = await prisma.transaction.findUnique({
      where: { id: first.id },
      include: { category: true },
    });
    if (!withCategory) {
      throw new Error('Falha ao carregar transação criada');
    }
    return mapTransaction(withCategory, withCategory.category);
  }

  const created = await prisma.transaction.create({
    data: {
      ...baseData,
      installments: 1,
      currentInstallment: 1,
      installmentsGroupId: null,
    },
    include: { category: true },
  });

  return mapTransaction(created, created.category);
}

export async function getTransactions(accountId: number, limit?: number): Promise<TransactionWithCategory[]> {
  const transactions = await prisma.transaction.findMany({
    where: { accountId },
    include: { category: true },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  });

  return transactions.map((item) => mapTransaction(item, item.category));
}

export async function getTransactionsByDateRange(
  accountId: number,
  startDate: string,
  endDate: string
): Promise<TransactionWithCategory[]> {
  const start = parseDateInput(startDate);
  const end = parseDateInput(endDate);

  // 1. Buscar transações físicas (únicas, parceladas, e NÃO-recorrentes mensais)
  const physical = await prisma.transaction.findMany({
    where: {
      accountId,
      date: { gte: start, lte: end },
      isException: false, // Exceções são tratadas separadamente
      OR: [
        { launchType: null },
        { launchType: '' },
        { launchType: 'unica' },
        { launchType: 'parcelada' },
        {
          launchType: 'recorrente',
          OR: [
            { recurrenceFrequency: null },
            { recurrenceFrequency: '' },
            { recurrenceFrequency: 'unica' },
          ],
        },
      ],
    },
    include: { category: true },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  });

  // 2. Buscar TODAS as exceções desta conta (para saber quais virtuais ignorar)
  const allExceptions = await prisma.transaction.findMany({
    where: {
      accountId,
      isException: true,
    },
    include: { category: true },
  });

  // 3. Criar Set de datas que têm exceção (para não gerar virtual)
  // Chave: recurrenceGroupId + exceptionForDate
  const exceptionKeys = new Set(
    allExceptions
      .filter((e) => e.exceptionForDate && e.recurrenceGroupId)
      .map((e) => `${e.recurrenceGroupId}-${ensureDateString(e.exceptionForDate)}`)
  );

  // 4. Buscar definições de recorrência mensal
  const recurrenceDefinitions = await prisma.transaction.findMany({
    where: {
      accountId,
      launchType: 'recorrente',
      recurrenceFrequency: 'mensal',
      isException: false,
    },
    include: { category: true },
  });

  // 5. Gerar virtuais, exceto onde há exceção
  const virtualTransactions: TransactionWithCategory[] = [];
  for (const definition of recurrenceDefinitions) {
    const base = mapTransaction(definition, definition.category);
    const firstDate = parseDateInput(base.date);
    const recurrenceEnd = base.recurrenceEndDate ? parseDateInput(base.recurrenceEndDate) : null;
    let monthOffset = 0;

    while (true) {
      const virtualDate = addMonthsPreserveDay(firstDate, monthOffset);

      // Passou do fim do período? Para.
      if (virtualDate > end) break;

      // Respeita recurrenceEndDate
      if (recurrenceEnd && virtualDate > recurrenceEnd) break;

      // Está dentro do período?
      if (virtualDate >= start) {
        const virtualDateStr = ensureDateString(virtualDate);
        const key = `${definition.recurrenceGroupId}-${virtualDateStr}`;

        // Só gera se NÃO houver exceção para esta data
        if (!exceptionKeys.has(key)) {
          virtualTransactions.push({
            ...base,
            date: virtualDateStr ?? base.date,
            virtualDate: virtualDateStr ?? base.date, // Campo extra para o frontend
            paid: false,
          });
        }
      }

      monthOffset++;
      // Limite de segurança (10 anos)
      if (monthOffset > 120) break;
    }
  }

  // 6. Buscar exceções cuja DATA REAL (date) está no período
  // (podem ter exceptionForDate em outro mês, mas aparecem neste)
  const exceptionsInPeriod = allExceptions.filter(
    (e) => e.date >= start && e.date <= end
  );

  // 7. Combinar: físicas + exceções (pela date real) + virtuais
  const mappedPhysical = physical.map((item) => mapTransaction(item, item.category));
  const mappedExceptions = exceptionsInPeriod.map((e) => ({
    ...mapTransaction(e, e.category),
    // Exceções também precisam do virtualDate para re-edição
    virtualDate: ensureDateString(e.exceptionForDate) ?? undefined,
  }));

  const all = [...mappedPhysical, ...mappedExceptions, ...virtualTransactions];
  return all.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export async function getTransaction(id: number): Promise<TransactionWithCategory | undefined> {
  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: { category: true },
  });
  return transaction ? mapTransaction(transaction, transaction.category) : undefined;
}

export async function updateTransaction(
  id: number,
  transaction: Partial<InsertTransaction> & { exceptionForDate?: string; editScope?: string }
): Promise<Transaction | undefined> {
  // Remove campos que não são do banco de dados
  const { exceptionForDate, editScope, ...transactionData } = transaction;

  const updatePayload: Prisma.TransactionUpdateInput = {
    ...transactionData,
    date: transactionData.date ? parseDateInput(transactionData.date) : undefined,
  };

  if ('recurrenceEndDate' in transaction) {
    updatePayload.recurrenceEndDate = transaction.recurrenceEndDate
      ? parseDateInput(transaction.recurrenceEndDate)
      : null;
  }

  const updated = await prisma.transaction.update({
    where: { id },
    data: updatePayload,
    include: { category: true },
  });

  // Se alterou o status de 'paid' de uma transação de fatura, sincronizar invoicePayment
  if ('paid' in transactionData && updated.isInvoiceTransaction && updated.creditCardInvoiceId) {
    const [, invoiceMonth] = updated.creditCardInvoiceId.split(/-(.+)/);
    if (invoiceMonth && updated.creditCardId && updated.accountId) {
      const newStatus: 'paid' | 'pending' = updated.paid ? 'paid' : 'pending';
      // Buscar invoicePayment existente
      const existingPayment = await prisma.invoicePayment.findFirst({
        where: {
          creditCardId: updated.creditCardId,
          invoiceMonth,
        },
      });

      if (existingPayment) {
        // Atualizar existente
        await prisma.invoicePayment.update({
          where: { id: existingPayment.id },
          data: {
            status: newStatus,
            paidAt: updated.paid ? new Date() : null,
            transactionId: updated.id,
          },
        });
      } else {
        // Criar novo
        await prisma.invoicePayment.create({
          data: {
            creditCardId: updated.creditCardId,
            accountId: updated.accountId,
            invoiceMonth,
            totalAmount: updated.amount,
            dueDate: updated.date,
            transactionId: updated.id,
            status: newStatus,
            paidAt: updated.paid ? new Date() : null,
          },
        });
      }
    }
  }

  return updated ? mapTransaction(updated, updated.category) : undefined;
}

export async function updateTransactionWithScope(
  id: number,
  data: Partial<InsertTransaction> & {
    editScope?: 'single' | 'all' | 'future';
    installmentsGroupId?: string;
    recurrenceGroupId?: string;
    exceptionForDate?: string; // Data da ocorrência virtual sendo editada
  }
): Promise<Transaction | undefined> {
  const scope = data.editScope ?? 'single';
  console.log('[updateTransactionWithScope] start', {
    id,
    editScope: scope,
    installmentsGroupId: data.installmentsGroupId,
    recurrenceGroupId: data.recurrenceGroupId,
    exceptionForDate: data.exceptionForDate,
    hasRecurrenceFrequency: !!data.recurrenceFrequency,
  });

  let current = await prisma.transaction.findUnique({ where: { id } });
  if (!current) return undefined;

  // CASO 1: Edição "single" de transação recorrente → criar exceção
  if (
    scope === 'single' &&
    (current.launchType === 'recorrente' ||
      !!current.recurrenceFrequency ||
      !!current.recurrenceGroupId)
  ) {
    console.log('[updateTransactionWithScope] creating exception for recurrence', {
      transactionId: id,
      exceptionForDate: data.exceptionForDate,
      targetDate: data.date,
    });

    // Se não tem recurrenceGroupId, criar um primeiro
    if (!current.recurrenceGroupId) {
      const newGroupId = randomUUID();
      current = await prisma.transaction.update({
        where: { id: current.id },
        data: { recurrenceGroupId: newGroupId },
      });
      console.log('[updateTransactionWithScope] created recurrenceGroupId', newGroupId);
    }

    // A data da ocorrência sendo editada vem do frontend
    const originalDate = data.exceptionForDate
      ? parseDateInput(data.exceptionForDate)
      : current.date;

    // Verificar se já existe exceção para esta data
    const existingException = await prisma.transaction.findFirst({
      where: {
        accountId: current.accountId,
        recurrenceGroupId: current.recurrenceGroupId,
        isException: true,
        exceptionForDate: originalDate,
      },
    });

    if (existingException) {
      // Atualiza a exceção existente
      console.log('[updateTransactionWithScope] updating existing exception', existingException.id);
      const updated = await prisma.transaction.update({
        where: { id: existingException.id },
        data: {
          description: data.description ?? existingException.description,
          amount: data.amount ?? existingException.amount,
          type: data.type ?? existingException.type,
          date: data.date ? parseDateInput(data.date) : existingException.date,
          categoryId: data.categoryId ?? existingException.categoryId,
          bankAccountId: data.bankAccountId !== undefined ? data.bankAccountId : existingException.bankAccountId,
          paid: data.paid ?? existingException.paid,
        },
        include: { category: true },
      });
      return mapTransaction(updated, updated.category);
    }

    // Criar nova exceção
    console.log('[updateTransactionWithScope] creating new exception');
    const exception = await prisma.transaction.create({
      data: {
        description: data.description ?? current.description,
        amount: data.amount ?? current.amount,
        type: data.type ?? current.type,
        date: data.date ? parseDateInput(data.date) : originalDate,
        categoryId: data.categoryId ?? current.categoryId,
        accountId: current.accountId,
        bankAccountId: data.bankAccountId !== undefined ? data.bankAccountId : current.bankAccountId,
        paymentMethod: current.paymentMethod,
        clientName: current.clientName,
        projectName: current.projectName,
        costCenter: current.costCenter,

        // Campos de exceção
        isException: true,
        exceptionForDate: originalDate,
        recurrenceGroupId: current.recurrenceGroupId,

        // Não é mais recorrente (é uma instância única)
        launchType: 'unica',
        recurrenceFrequency: null,
        recurrenceEndDate: null,
        installments: 1,
        currentInstallment: 1,

        creditCardInvoiceId: current.creditCardInvoiceId,
        creditCardId: current.creditCardId,
        isInvoiceTransaction: current.isInvoiceTransaction,
        paid: data.paid ?? false,
      },
      include: { category: true },
    });

    return mapTransaction(exception, exception.category);
  }

  if (!data.editScope || data.editScope === 'single') {
    console.log('[updateTransactionWithScope] fallback single update');
    return updateTransaction(id, data);
  }

  let groupId =
    data.installmentsGroupId ??
    data.recurrenceGroupId ??
    current.installmentsGroupId ??
    current.recurrenceGroupId;
  const isInstallmentGroup = Boolean(data.installmentsGroupId ?? current.installmentsGroupId);

  // Para recorrentes sem recurrenceGroupId, cria um grupo na hora para permitir escopos all/future
  if (
    !groupId &&
    !isInstallmentGroup &&
    (current.launchType === 'recorrente' || current.recurrenceFrequency)
  ) {
    groupId = randomUUID();
    await prisma.transaction.update({
      where: { id: current.id },
      data: { recurrenceGroupId: groupId },
    });
  }

  if (!groupId) {
    return updateTransaction(id, data);
  }

  const where: Prisma.TransactionWhereInput = isInstallmentGroup
    ? { installmentsGroupId: groupId }
    : { recurrenceGroupId: groupId };

  if (scope === 'future') {
    if (isInstallmentGroup) {
      where.currentInstallment = { gte: current.currentInstallment };
    } else {
      where.date = { gte: current.date };
    }
  }

  const transactionsToUpdate = await prisma.transaction.findMany({
    where,
    orderBy: isInstallmentGroup ? { currentInstallment: 'asc' } : { date: 'asc' },
  });
  if (transactionsToUpdate.length === 0) {
    return undefined;
  }

  const scopeReferenceDate = scope === 'future' ? current.date : transactionsToUpdate[0]?.date;

  const baseDate = data.date ? parseDateInput(data.date) : undefined;

  await prisma.$transaction(
    transactionsToUpdate.map((transactionToUpdate) => {
      const scopedBaseDate =
        baseDate && scope !== 'single'
          ? isInstallmentGroup
            ? addMonthsPreserveDay(
                baseDate,
                transactionToUpdate.currentInstallment -
                  transactionsToUpdate[0].currentInstallment
              )
            : addDays(
                baseDate,
                differenceInDays(
                  new Date(transactionToUpdate.date),
                  new Date(scopeReferenceDate ?? transactionToUpdate.date)
                )
              )
          : undefined;
      const updatePayload: Prisma.TransactionUpdateInput = {
        description: data.description,
        amount: data.amount,
        type: data.type,
        categoryId: data.categoryId,
        paymentMethod: data.paymentMethod,
        clientName: data.clientName,
        projectName: data.projectName,
        costCenter: data.costCenter,
        installments: data.installments,
        currentInstallment: data.currentInstallment,
        installmentsGroupId: data.installmentsGroupId,
        recurrenceFrequency: data.recurrenceFrequency,
        recurrenceGroupId: data.recurrenceGroupId,
        creditCardInvoiceId: data.creditCardInvoiceId,
        creditCardId: data.creditCardId,
        isInvoiceTransaction: data.isInvoiceTransaction,
        paid: data.paid,
        launchType: data.launchType,
      };

      if (data.bankAccountId !== undefined) {
        updatePayload.bankAccountId = data.bankAccountId;
      }

      if (data.recurrenceEndDate !== undefined) {
        updatePayload.recurrenceEndDate = data.recurrenceEndDate
          ? parseDateInput(data.recurrenceEndDate)
          : null;
      }

      if (data.date) {
        updatePayload.date =
          scope === 'single'
            ? parseDateInput(data.date)
            : (scopedBaseDate ?? parseDateInput(data.date));
      }

      return prisma.transaction.update({
        where: { id: transactionToUpdate.id },
        data: updatePayload,
      });
    })
  );

  return getTransaction(id);
}

export async function deleteTransaction(
  id: number,
  options?: { editScope?: 'single' | 'all' | 'future'; installmentsGroupId?: string }
): Promise<void> {
  if (!options?.editScope || !options.installmentsGroupId || options.editScope === 'single') {
    await prisma.transaction.delete({ where: { id } });
    return;
  }

  const groupId = options.installmentsGroupId;
  const current = await prisma.transaction.findUnique({ where: { id } });
  if (!current) return;

  const where: Prisma.TransactionWhereInput = {
    installmentsGroupId: groupId,
  };

  if (options.editScope === 'future') {
    where.currentInstallment = { gte: current.currentInstallment };
  }

  await prisma.transaction.deleteMany({ where });
}

export async function deleteAllTransactions(
  accountId: number
): Promise<{ deletedTransactions: number; deletedCreditCardTransactions: number }> {
  const [transactionsResult, creditCardResult] = await prisma.$transaction([
    prisma.transaction.deleteMany({ where: { accountId } }),
    prisma.creditCardTransaction.deleteMany({ where: { accountId } }),
  ]);

  return {
    deletedTransactions: transactionsResult.count,
    deletedCreditCardTransactions: creditCardResult.count,
  };
}
