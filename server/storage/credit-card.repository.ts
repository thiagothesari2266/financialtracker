import { randomUUID } from 'crypto';
import { todayBR, currentMonthBR } from '../utils/date-br';
import { prisma } from '../db';
import {
  mapCreditCard,
  mapCreditCardTransaction,
  stripCategoryFromCardTx,
  mapInvoicePayment,
  mapTransaction,
} from './mappers';
import {
  INVOICE_CATEGORY_NAME,
  INVOICE_CATEGORY_COLOR,
  INVOICE_CATEGORY_ICON,
  ensureDateString,
  parseDateInput,
  addMonthsPreserveDay,
  calculateInvoiceMonth,
  computeInvoiceDueDate,
  formatInvoiceDescription,
} from './utils';
import type {
  CreditCard,
  InsertCreditCard,
  CreditCardTransaction,
  InsertCreditCardTransaction,
  CreditCardTransactionWithCategory,
  InvoicePayment,
  InsertInvoicePayment,
  TransactionWithCategory,
} from '@shared/schema';
import type { Prisma, Category as PrismaCategory, CreditCardTransaction as PrismaCreditCardTransaction } from '@prisma/client';

// ---------------------------------------------------------------------------
// Funções internas (não exportadas)
// ---------------------------------------------------------------------------

async function ensureInvoiceCategory(accountId: number): Promise<PrismaCategory> {
  const existing = await prisma.category.findFirst({
    where: { accountId, name: INVOICE_CATEGORY_NAME },
  });
  if (existing) return existing;
  return prisma.category.create({
    data: {
      accountId,
      name: INVOICE_CATEGORY_NAME,
      color: INVOICE_CATEGORY_COLOR,
      icon: INVOICE_CATEGORY_ICON,
      type: 'expense',
    },
  });
}

async function buildCreditCardInvoiceSummaries(accountId: number): Promise<
  Array<{
    creditCardId: number;
    cardName: string;
    month: string;
    periodStart: string;
    periodEnd: string;
    total: number;
    transactions: CreditCardTransactionWithCategory[];
  }>
> {
  const cards = await prisma.creditCard.findMany({ where: { accountId } });
  const cardMap = new Map(cards.map((card) => [card.id, card]));
  const transactions = await prisma.creditCardTransaction.findMany({
    where: { accountId },
    include: { category: true },
    orderBy: [{ invoiceMonth: 'asc' }, { date: 'asc' }],
  });

  const invoices = new Map<
    string,
    {
      creditCardId: number;
      month: string;
      total: number;
      periodStart: string;
      periodEnd: string;
      transactions: CreditCardTransactionWithCategory[];
    }
  >();

  // Helper para adicionar transação ao mapa de faturas
  const addToInvoice = (
    creditCardId: number,
    invoiceMonth: string,
    mapped: CreditCardTransactionWithCategory,
    amt: number,
    dateStr: string,
    isIncome: boolean
  ) => {
    const key = `${creditCardId}:${invoiceMonth}`;
    const existing = invoices.get(key);
    const adjustedAmt = isIncome ? -amt : amt;
    if (existing) {
      existing.total += adjustedAmt;
      existing.periodStart = existing.periodStart < dateStr ? existing.periodStart : dateStr;
      existing.periodEnd = existing.periodEnd > dateStr ? existing.periodEnd : dateStr;
      existing.transactions.push(mapped);
    } else {
      invoices.set(key, {
        creditCardId,
        month: invoiceMonth,
        total: adjustedAmt,
        periodStart: dateStr,
        periodEnd: dateStr,
        transactions: [mapped],
      });
    }
  };

  // 0. Construir set de exceções por (recurrenceGroupId, invoiceMonth) para
  //    suprimir geração de virtuais cobertos por exceções
  const exceptionKeys = new Set<string>();
  for (const tx of transactions) {
    if (tx.isException && tx.recurrenceGroupId) {
      exceptionKeys.add(`${tx.recurrenceGroupId}:${tx.invoiceMonth}`);
    }
  }

  // 1. Adicionar transações físicas (exceto tombstones e templates cobertos por exceção)
  for (const tx of transactions) {
    // Tombstones (amount=0 + isException) não aparecem na fatura
    const amtNum = Number.parseFloat(tx.amount.toString());
    if (tx.isException && amtNum === 0) continue;

    // Templates recorrentes cobertos por exceção/tombstone no mesmo mês
    // não devem aparecer fisicamente — a exceção substitui.
    if (
      !tx.isException &&
      tx.recurrenceGroupId &&
      exceptionKeys.has(`${tx.recurrenceGroupId}:${tx.invoiceMonth}`)
    ) {
      continue;
    }

    // Recorrentes físicos além do recurrenceEndDate não aparecem
    if (
      !tx.isException &&
      tx.launchType === 'recorrente' &&
      tx.recurrenceEndDate &&
      tx.invoiceMonth > ensureDateString(tx.recurrenceEndDate)!.slice(0, 7)
    ) {
      continue;
    }

    const mapped = mapCreditCardTransaction(tx, tx.category);
    const dateStr = ensureDateString(tx.date) ?? todayBR();
    const isIncome = tx.category?.type === 'income';
    addToInvoice(tx.creditCardId, tx.invoiceMonth, mapped, amtNum, dateStr, isIncome);
  }

  // 2. Gerar instâncias virtuais de transações recorrentes para meses futuros
  const recurrents = transactions.filter(
    (tx) =>
      tx.launchType === 'recorrente' &&
      tx.recurrenceFrequency === 'mensal' &&
      !tx.isException
  );

  const currentMonth = currentMonthBR(); // 'YYYY-MM'
  for (const tx of recurrents) {
    const baseMonth = tx.invoiceMonth; // mês original da definição
    const [baseYear, baseMonthNum] = baseMonth.split('-').map(Number);
    const recurrenceEnd = tx.recurrenceEndDate ? ensureDateString(tx.recurrenceEndDate) : null;

    // Gerar para até 12 meses à frente do mês atual
    for (let offset = 1; offset <= 12; offset++) {
      let newMonthNum = baseMonthNum + offset;
      let newYear = baseYear;
      while (newMonthNum > 12) {
        newMonthNum -= 12;
        newYear++;
      }
      const futureMonth = `${newYear}-${String(newMonthNum).padStart(2, '0')}`;

      // Não gerar para meses anteriores ao atual
      if (futureMonth < currentMonth) continue;

      // Respeitar recurrenceEndDate
      if (recurrenceEnd && futureMonth > recurrenceEnd.slice(0, 7)) break;

      // Pular se há exceção (incluindo tombstone) para este mês
      if (tx.recurrenceGroupId && exceptionKeys.has(`${tx.recurrenceGroupId}:${futureMonth}`)) {
        continue;
      }

      // Fallback legado: pular se já existe outra física com mesma descrição
      // (cobre recorrentes pré-migração sem recurrenceGroupId)
      if (!tx.recurrenceGroupId) {
        const alreadyExists = transactions.some(
          (existing) =>
            existing.creditCardId === tx.creditCardId &&
            existing.invoiceMonth === futureMonth &&
            existing.description === tx.description
        );
        if (alreadyExists) continue;
      }

      const mapped = mapCreditCardTransaction(tx, tx.category);
      // Marcar como virtual com o mês correto + groupId para edição via escopo single
      const virtualMapped = {
        ...mapped,
        invoiceMonth: futureMonth,
        isVirtual: true,
        recurrenceGroupId: tx.recurrenceGroupId,
      } as CreditCardTransactionWithCategory;

      const dateStr = ensureDateString(tx.date) ?? todayBR();
      const amt = Number.parseFloat(tx.amount.toString());
      const isIncome = tx.category?.type === 'income';
      addToInvoice(tx.creditCardId, futureMonth, virtualMapped, amt, dateStr, isIncome);
    }
  }

  return Array.from(invoices.values()).map((invoice) => ({
    creditCardId: invoice.creditCardId,
    cardName: cardMap.get(invoice.creditCardId)?.name ?? '',
    month: invoice.month,
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    total: invoice.total,
    transactions: invoice.transactions,
  }));
}

async function updateAllInvoiceTransactions(accountId: number): Promise<void> {
  const cards = await prisma.creditCard.findMany({ where: { accountId } });
  const cardMap = new Map(cards.map((card) => [card.id, card]));
  const invoiceCategory = await ensureInvoiceCategory(accountId);
  const invoices = await buildCreditCardInvoiceSummaries(accountId);
  const invoicePayments = await prisma.invoicePayment.findMany({ where: { accountId } });
  const paymentMap = new Map(
    invoicePayments.map((payment) => [`${payment.creditCardId}:${payment.invoiceMonth}`, payment])
  );

  const existingTransactions = await prisma.transaction.findMany({
    where: { accountId, isInvoiceTransaction: true },
    select: { id: true, creditCardInvoiceId: true, date: true },
    orderBy: { id: 'asc' },
  });
  const existingMap = new Map<string, { id: number; date: Date }>();
  const duplicatesToDelete: number[] = [];
  for (const transaction of existingTransactions) {
    const key = transaction.creditCardInvoiceId ?? '';
    if (!key) {
      duplicatesToDelete.push(transaction.id);
      continue;
    }
    if (existingMap.has(key)) {
      duplicatesToDelete.push(transaction.id);
    } else {
      existingMap.set(key, { id: transaction.id, date: transaction.date });
    }
  }
  if (duplicatesToDelete.length > 0) {
    await prisma.transaction.deleteMany({
      where: { id: { in: duplicatesToDelete } },
    });
  }

  const usedInvoiceIds = new Set<string>();

  for (const invoice of invoices) {
    const card = cardMap.get(invoice.creditCardId);
    if (!card) continue;
    const total = Number.parseFloat(invoice.total as unknown as string);
    if (!Number.isFinite(total)) continue;
    if (total <= 0) {
      const invoiceId = `${card.id}-${invoice.month}`;
      if (existingMap.has(invoiceId)) {
        const existing = existingMap.get(invoiceId)!;
        await prisma.invoicePayment.updateMany({
          where: { transactionId: existing.id },
          data: { transactionId: null, status: 'pending', paidAt: null },
        });
        await prisma.transaction.delete({ where: { id: existing.id } });
        existingMap.delete(invoiceId);
      }
      continue;
    }

    const invoiceId = `${card.id}-${invoice.month}`;
    usedInvoiceIds.add(invoiceId);
    const dueDate = computeInvoiceDueDate(invoice.month, card.dueDate);
    const description = formatInvoiceDescription(card.name, invoice.month);
    const paymentKey = `${card.id}:${invoice.month}`;
    const payment = paymentMap.get(paymentKey);
    const paid = payment?.status === 'paid';
    const amountStr = total.toFixed(2);

    if (existingMap.has(invoiceId)) {
      const existing = existingMap.get(invoiceId)!;
      const userChangedDate = existing.date.getTime() !== dueDate.getTime();
      await prisma.transaction.update({
        where: { id: existing.id },
        data: {
          description,
          amount: amountStr,
          ...(userChangedDate ? {} : { date: dueDate }),
          categoryId: invoiceCategory.id,
          type: 'expense',
          creditCardId: card.id,
          creditCardInvoiceId: invoiceId,
          isInvoiceTransaction: true,
          paid,
        },
      });
      if (payment && payment.transactionId !== existing.id) {
        await prisma.invoicePayment.update({
          where: { id: payment.id },
          data: { transactionId: existing.id, totalAmount: amountStr },
        });
      }
    } else {
      const created = await prisma.transaction.create({
        data: {
          description,
          amount: amountStr,
          type: 'expense',
          date: dueDate,
          categoryId: invoiceCategory.id,
          accountId,
          creditCardId: card.id,
          creditCardInvoiceId: invoiceId,
          isInvoiceTransaction: true,
          installments: 1,
          currentInstallment: 1,
          paid,
        },
      });
      if (payment && payment.transactionId !== created.id) {
        await prisma.invoicePayment.update({
          where: { id: payment.id },
          data: { transactionId: created.id, totalAmount: amountStr },
        });
      }
    }
  }

  const staleTransactions = await prisma.transaction.findMany({
    where: {
      accountId,
      isInvoiceTransaction: true,
      ...(usedInvoiceIds.size > 0
        ? { creditCardInvoiceId: { notIn: Array.from(usedInvoiceIds) } }
        : {}),
    },
    select: { id: true },
  });

  if (staleTransactions.length > 0) {
    const staleIds = staleTransactions.map((tx) => tx.id);
    await prisma.invoicePayment.updateMany({
      where: { transactionId: { in: staleIds } },
      data: { transactionId: null, status: 'pending', paidAt: null },
    });
    await prisma.transaction.deleteMany({ where: { id: { in: staleIds } } });
  }
}

// ---------------------------------------------------------------------------
// CreditCard CRUD
// ---------------------------------------------------------------------------

export async function createCreditCard(insertCreditCard: InsertCreditCard): Promise<CreditCard> {
  const created = await prisma.creditCard.create({
    data: insertCreditCard as any,
  });
  return mapCreditCard(created);
}

export async function getCreditCards(accountId: number, userId: number): Promise<CreditCard[]> {
  const userAccounts = await prisma.account.findMany({
    where: { userId },
    select: { id: true },
  });
  const userAccountIds = userAccounts.map((a) => a.id);

  const cards = await prisma.creditCard.findMany({
    where: {
      OR: [
        { accountId },
        { shared: true, accountId: { in: userAccountIds } },
      ],
    },
    orderBy: { name: 'asc' },
  });
  return cards.map(mapCreditCard);
}

export async function getCreditCard(id: number): Promise<CreditCard | undefined> {
  const card = await prisma.creditCard.findUnique({
    where: { id },
  });
  return card ? mapCreditCard(card) : undefined;
}

export async function updateCreditCard(
  id: number,
  creditCard: Partial<InsertCreditCard>
): Promise<CreditCard | undefined> {
  const updated = await prisma.creditCard.update({
    where: { id },
    data: creditCard,
  });
  return updated ? mapCreditCard(updated) : undefined;
}

export async function deleteCreditCard(id: number): Promise<void> {
  const card = await prisma.creditCard.findUnique({ where: { id } });
  if (!card) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.creditCardTransaction.deleteMany({
      where: { creditCardId: id },
    });

    await tx.transaction.updateMany({
      where: { creditCardId: id },
      data: { creditCardId: null, creditCardInvoiceId: null },
    });

    await tx.invoicePayment.deleteMany({
      where: { creditCardId: id },
    });

    await tx.creditCard.delete({
      where: { id },
    });
  });

  await updateAllInvoiceTransactions(card.accountId);
}

// ---------------------------------------------------------------------------
// CreditCardTransaction CRUD
// ---------------------------------------------------------------------------

export async function createCreditCardTransaction(
  insertTransaction: InsertCreditCardTransaction
): Promise<CreditCardTransaction> {
  const installments =
    insertTransaction.installments && insertTransaction.installments > 0
      ? insertTransaction.installments
      : 1;
  const currentInstallment =
    insertTransaction.currentInstallment && insertTransaction.currentInstallment > 0
      ? insertTransaction.currentInstallment
      : 1;

  const baseData: Prisma.CreditCardTransactionUncheckedCreateInput = {
    description: insertTransaction.description,
    amount: insertTransaction.amount,
    date: parseDateInput(insertTransaction.date),
    installments,
    currentInstallment,
    categoryId: insertTransaction.categoryId,
    creditCardId: insertTransaction.creditCardId,
    accountId: insertTransaction.accountId,
    invoiceMonth: insertTransaction.invoiceMonth,
    clientName: insertTransaction.clientName ?? null,
    projectName: insertTransaction.projectName ?? null,
    costCenter: insertTransaction.costCenter ?? null,
    launchType: insertTransaction.launchType ?? null,
    recurrenceFrequency: insertTransaction.recurrenceFrequency ?? null,
    recurrenceEndDate: insertTransaction.recurrenceEndDate
      ? parseDateInput(insertTransaction.recurrenceEndDate)
      : null,
  };

  if (installments > 1) {
    const installmentsGroupId = randomUUID();
    let first: PrismaCreditCardTransaction | undefined;

    const card = await prisma.creditCard.findUnique({
      where: { id: insertTransaction.creditCardId },
      select: { closingDay: true },
    });
    const closingDay = card?.closingDay ?? 1;

    await prisma.$transaction(async (tx) => {
      for (let installment = 1; installment <= installments; installment++) {
        const date = addMonthsPreserveDay(
          parseDateInput(insertTransaction.date),
          installment - 1
        );
        const invoiceMonth = calculateInvoiceMonth(date, closingDay);
        const created = await tx.creditCardTransaction.create({
          data: {
            ...baseData,
            date,
            invoiceMonth,
            installments,
            currentInstallment: installment,
            installmentsGroupId,
          },
        });
        if (installment === 1) {
          first = created;
        }
      }
    });

    if (!first) {
      throw new Error('Falha ao criar transação parcelada de cartão');
    }

    await updateAllInvoiceTransactions(insertTransaction.accountId);
    return stripCategoryFromCardTx(mapCreditCardTransaction(first));
  }

  const created = await prisma.creditCardTransaction.create({
    data: baseData,
  });

  await updateAllInvoiceTransactions(insertTransaction.accountId);
  return stripCategoryFromCardTx(mapCreditCardTransaction(created));
}

export async function getCreditCardTransactions(
  accountId: number,
  creditCardId?: number
): Promise<CreditCardTransactionWithCategory[]> {
  const transactions = await prisma.creditCardTransaction.findMany({
    where: {
      accountId,
      creditCardId: creditCardId ?? undefined,
    },
    include: { category: true },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  });

  return transactions.map((item) => mapCreditCardTransaction(item, item.category));
}

export async function getCreditCardTransaction(
  id: number
): Promise<CreditCardTransactionWithCategory | undefined> {
  const transaction = await prisma.creditCardTransaction.findUnique({
    where: { id },
    include: { category: true },
  });
  return transaction ? mapCreditCardTransaction(transaction, transaction.category) : undefined;
}

export async function updateCreditCardTransaction(
  id: number,
  transaction: Partial<InsertCreditCardTransaction> & {
    editScope?: 'single' | 'all' | 'future';
    exceptionForDate?: string;
    installmentsGroupId?: string;
    recurrenceGroupId?: string;
  }
): Promise<CreditCardTransaction | undefined> {
  const { editScope, exceptionForDate, ...rest } = transaction;
  const scope = editScope ?? 'single';

  let current = await prisma.creditCardTransaction.findUnique({ where: { id } });
  if (!current) return undefined;

  const card = await prisma.creditCard.findUnique({
    where: { id: current.creditCardId },
    select: { closingDay: true },
  });
  const closingDay = card?.closingDay ?? 1;

  // CASO 0: row já é exceção → UPDATE direto
  if (current.isException) {
    const updated = await prisma.creditCardTransaction.update({
      where: { id },
      data: {
        ...rest,
        date: rest.date ? parseDateInput(rest.date) : undefined,
        recurrenceEndDate: rest.recurrenceEndDate
          ? parseDateInput(rest.recurrenceEndDate)
          : undefined,
      },
    });
    await updateAllInvoiceTransactions(updated.accountId);
    return stripCategoryFromCardTx(mapCreditCardTransaction(updated));
  }

  // CASO 1: edição "single" de recorrente → criar/atualizar exceção
  const isRecurrent =
    current.launchType === 'recorrente' ||
    !!current.recurrenceFrequency ||
    !!current.recurrenceGroupId;

  if (scope === 'single' && isRecurrent) {
    // Lazy: criar recurrenceGroupId se ainda não existe
    if (!current.recurrenceGroupId) {
      const newGroupId = randomUUID();
      current = await prisma.creditCardTransaction.update({
        where: { id: current.id },
        data: { recurrenceGroupId: newGroupId },
      });
    }

    const originalDate = exceptionForDate
      ? parseDateInput(exceptionForDate)
      : current.date;

    // Verificar se já existe exceção para esta data
    const existingException = await prisma.creditCardTransaction.findFirst({
      where: {
        accountId: current.accountId,
        recurrenceGroupId: current.recurrenceGroupId,
        isException: true,
        exceptionForDate: originalDate,
      },
    });

    if (existingException) {
      const updated = await prisma.creditCardTransaction.update({
        where: { id: existingException.id },
        data: {
          description: rest.description ?? existingException.description,
          amount: rest.amount ?? existingException.amount,
          date: rest.date ? parseDateInput(rest.date) : existingException.date,
          categoryId: rest.categoryId ?? existingException.categoryId,
          creditCardId: rest.creditCardId ?? existingException.creditCardId,
        },
      });
      await updateAllInvoiceTransactions(updated.accountId);
      return stripCategoryFromCardTx(mapCreditCardTransaction(updated));
    }

    // Criar nova exceção
    const newDate = rest.date ? parseDateInput(rest.date) : originalDate;
    const newInvoiceMonth = calculateInvoiceMonth(newDate, closingDay);

    const exception = await prisma.creditCardTransaction.create({
      data: {
        description: rest.description ?? current.description,
        amount: rest.amount ?? current.amount,
        date: newDate,
        installments: 1,
        currentInstallment: 1,
        categoryId: rest.categoryId ?? current.categoryId,
        creditCardId: rest.creditCardId ?? current.creditCardId,
        accountId: current.accountId,
        invoiceMonth: newInvoiceMonth,
        clientName: current.clientName,
        projectName: current.projectName,
        costCenter: current.costCenter,

        // Campos de exceção
        isException: true,
        exceptionForDate: originalDate,
        recurrenceGroupId: current.recurrenceGroupId,

        // Não é mais recorrente
        launchType: 'unica',
        recurrenceFrequency: null,
        recurrenceEndDate: null,
      },
    });

    await updateAllInvoiceTransactions(exception.accountId);
    return stripCategoryFromCardTx(mapCreditCardTransaction(exception));
  }

  // CASO 2: single em não-recorrente OU sem editScope → UPDATE direto
  if (scope === 'single') {
    const updated = await prisma.creditCardTransaction.update({
      where: { id },
      data: {
        ...rest,
        date: rest.date ? parseDateInput(rest.date) : undefined,
        recurrenceEndDate: rest.recurrenceEndDate
          ? parseDateInput(rest.recurrenceEndDate)
          : undefined,
      },
    });
    await updateAllInvoiceTransactions(updated.accountId);
    return stripCategoryFromCardTx(mapCreditCardTransaction(updated));
  }

  // CASO 3: all/future → UPDATE batch no grupo
  const groupId =
    transaction.installmentsGroupId ??
    transaction.recurrenceGroupId ??
    current.installmentsGroupId ??
    current.recurrenceGroupId;
  const isInstallmentGroup = Boolean(
    transaction.installmentsGroupId ?? current.installmentsGroupId
  );

  if (!groupId) {
    // Sem grupo, fallback para single
    const updated = await prisma.creditCardTransaction.update({
      where: { id },
      data: {
        ...rest,
        date: rest.date ? parseDateInput(rest.date) : undefined,
        recurrenceEndDate: rest.recurrenceEndDate
          ? parseDateInput(rest.recurrenceEndDate)
          : undefined,
      },
    });
    await updateAllInvoiceTransactions(updated.accountId);
    return stripCategoryFromCardTx(mapCreditCardTransaction(updated));
  }

  const where: Prisma.CreditCardTransactionWhereInput = isInstallmentGroup
    ? { installmentsGroupId: groupId }
    : { recurrenceGroupId: groupId, isException: false };

  if (scope === 'future') {
    if (isInstallmentGroup) {
      where.currentInstallment = { gte: current.currentInstallment };
    } else {
      // CCT é organizado por fatura, não por date
      where.invoiceMonth = { gte: current.invoiceMonth };
    }
  }

  await prisma.creditCardTransaction.updateMany({
    where,
    data: {
      description: rest.description,
      amount: rest.amount,
      categoryId: rest.categoryId,
      creditCardId: rest.creditCardId,
      clientName: rest.clientName,
      projectName: rest.projectName,
      costCenter: rest.costCenter,
      recurrenceFrequency: rest.recurrenceFrequency,
      recurrenceEndDate: rest.recurrenceEndDate
        ? parseDateInput(rest.recurrenceEndDate)
        : undefined,
    },
  });

  await updateAllInvoiceTransactions(current.accountId);
  return getCreditCardTransaction(id).then((tx) =>
    tx ? stripCategoryFromCardTx(tx) : undefined
  );
}

export async function deleteCreditCardTransaction(
  id: number,
  options?: { editScope?: 'single' | 'all' | 'future'; exceptionForDate?: string }
): Promise<void> {
  const scope = options?.editScope ?? 'single';
  const current = await prisma.creditCardTransaction.findUnique({ where: { id } });
  if (!current) return;

  // Recorrente em scope=single → criar tombstone (amount=0, is_exception=true)
  // Não pode DELETE direto porque a próxima query de virtuais regenera a row.
  const isRecurrent =
    current.launchType === 'recorrente' ||
    !!current.recurrenceFrequency ||
    !!current.recurrenceGroupId;

  if (scope === 'single' && isRecurrent && !current.isException) {
    // Lazy recurrenceGroupId
    let groupId = current.recurrenceGroupId;
    if (!groupId) {
      groupId = randomUUID();
      await prisma.creditCardTransaction.update({
        where: { id },
        data: { recurrenceGroupId: groupId },
      });
    }

    const originalDate = options?.exceptionForDate
      ? parseDateInput(options.exceptionForDate)
      : current.date;

    // Se já existe exceção, removê-la (não recriar tombstone)
    const existing = await prisma.creditCardTransaction.findFirst({
      where: {
        accountId: current.accountId,
        recurrenceGroupId: groupId,
        isException: true,
        exceptionForDate: originalDate,
      },
    });

    if (existing) {
      // Substituir por tombstone (amount=0)
      await prisma.creditCardTransaction.update({
        where: { id: existing.id },
        data: { amount: 0, description: '[deleted]' },
      });
    } else {
      const card = await prisma.creditCard.findUnique({
        where: { id: current.creditCardId },
        select: { closingDay: true },
      });
      const closingDay = card?.closingDay ?? 1;
      const tombstoneInvoiceMonth = calculateInvoiceMonth(originalDate, closingDay);

      await prisma.creditCardTransaction.create({
        data: {
          description: '[deleted]',
          amount: 0,
          date: originalDate,
          installments: 1,
          currentInstallment: 1,
          categoryId: current.categoryId,
          creditCardId: current.creditCardId,
          accountId: current.accountId,
          invoiceMonth: tombstoneInvoiceMonth,
          isException: true,
          exceptionForDate: originalDate,
          recurrenceGroupId: groupId,
          launchType: 'unica',
        },
      });
    }

    await updateAllInvoiceTransactions(current.accountId);
    return;
  }

  // scope=all/future em grupo
  if (scope !== 'single') {
    const groupId = current.installmentsGroupId ?? current.recurrenceGroupId;
    if (groupId) {
      const isInstallmentGroup = Boolean(current.installmentsGroupId);
      const where: Prisma.CreditCardTransactionWhereInput = isInstallmentGroup
        ? { installmentsGroupId: groupId }
        : { recurrenceGroupId: groupId };

      if (scope === 'future') {
        if (isInstallmentGroup) {
          where.currentInstallment = { gte: current.currentInstallment };
        } else {
          where.invoiceMonth = { gte: current.invoiceMonth };
        }
      }

      await prisma.creditCardTransaction.deleteMany({ where });
      await updateAllInvoiceTransactions(current.accountId);
      return;
    }
  }

  // Default: DELETE direto (single em não-recorrente, ou exceção)
  await prisma.creditCardTransaction.delete({ where: { id } });
  await updateAllInvoiceTransactions(current.accountId);
}

// ---------------------------------------------------------------------------
// InvoicePayment
// ---------------------------------------------------------------------------

export async function getCreditCardInvoices(accountId: number): Promise<
  Array<{
    creditCardId: number;
    cardName: string;
    month: string;
    periodStart: string;
    periodEnd: string;
    total: string;
    transactions: CreditCardTransactionWithCategory[];
    invoicePayment: InvoicePayment | null;
    dueDate: string;
  }>
> {
  const invoices = await buildCreditCardInvoiceSummaries(accountId);

  // Buscar payments e cards para enriquecer a resposta
  const payments = await prisma.invoicePayment.findMany({ where: { accountId } });
  const paymentMap = new Map(
    payments.map((p) => [`${p.creditCardId}:${p.invoiceMonth}`, mapInvoicePayment(p)])
  );
  const cards = await prisma.creditCard.findMany({ where: { accountId } });
  const cardMap = new Map(cards.map((c) => [c.id, c]));

  return invoices.map((invoice) => {
    const key = `${invoice.creditCardId}:${invoice.month}`;
    const card = cardMap.get(invoice.creditCardId);
    const dueDay = card?.dueDate ?? 10;
    const dueDateObj = computeInvoiceDueDate(invoice.month, dueDay);
    return {
      creditCardId: invoice.creditCardId,
      cardName: invoice.cardName,
      month: invoice.month,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      total: invoice.total.toFixed(2),
      transactions: invoice.transactions,
      invoicePayment: paymentMap.get(key) ?? null,
      dueDate: ensureDateString(dueDateObj) ?? '',
    };
  });
}

export async function createInvoicePayment(
  insertInvoicePayment: InsertInvoicePayment
): Promise<InvoicePayment> {
  const created = await prisma.invoicePayment.create({
    data: {
      ...insertInvoicePayment,
      dueDate: parseDateInput(insertInvoicePayment.dueDate),
      totalAmount: insertInvoicePayment.totalAmount,
    },
  });
  return mapInvoicePayment(created);
}

export async function getInvoicePayments(accountId: number): Promise<InvoicePayment[]> {
  const payments = await prisma.invoicePayment.findMany({
    where: { accountId },
    orderBy: [{ createdAt: 'desc' }],
  });
  return payments.map(mapInvoicePayment);
}

export async function getPendingInvoicePayments(accountId: number): Promise<InvoicePayment[]> {
  const payments = await prisma.invoicePayment.findMany({
    where: { accountId, status: 'pending' },
    orderBy: [{ dueDate: 'asc' }],
  });
  return payments.map(mapInvoicePayment);
}

export async function getInvoicePayment(id: number): Promise<InvoicePayment | undefined> {
  const payment = await prisma.invoicePayment.findUnique({
    where: { id },
  });
  return payment ? mapInvoicePayment(payment) : undefined;
}

export async function updateInvoicePayment(
  id: number,
  invoicePayment: Partial<InsertInvoicePayment>
): Promise<InvoicePayment | undefined> {
  const updated = await prisma.invoicePayment.update({
    where: { id },
    data: {
      ...invoicePayment,
      dueDate: invoicePayment.dueDate ? parseDateInput(invoicePayment.dueDate) : undefined,
      totalAmount: invoicePayment.totalAmount,
    },
  });
  return mapInvoicePayment(updated);
}

export async function deleteInvoicePayment(id: number): Promise<void> {
  await prisma.invoicePayment.delete({ where: { id } });
}

export async function processOverdueInvoices(accountId: number): Promise<InvoicePayment[]> {
  const invoices = await getCreditCardInvoices(accountId);
  if (invoices.length === 0) {
    return [];
  }

  const existingPayments = await prisma.invoicePayment.findMany({
    where: { accountId },
  });
  const paymentsKey = new Set(
    existingPayments.map((payment) => `${payment.creditCardId}:${payment.invoiceMonth}`)
  );

  const creditCards = await prisma.creditCard.findMany({
    where: { accountId },
  });
  const cardMap = new Map(creditCards.map((card) => [card.id, card]));

  const created: InvoicePayment[] = [];

  for (const invoice of invoices) {
    if (Number.parseFloat(invoice.total) <= 0) continue;
    const key = `${invoice.creditCardId}:${invoice.month}`;
    if (paymentsKey.has(key)) continue;

    const card = cardMap.get(invoice.creditCardId);
    if (!card) continue;

    const dueDate = computeInvoiceDueDate(invoice.month, card.dueDate);
    const payment = await prisma.invoicePayment.create({
      data: {
        creditCardId: invoice.creditCardId,
        accountId,
        invoiceMonth: invoice.month,
        totalAmount: invoice.total,
        dueDate,
        status: 'pending',
      },
    });
    created.push(mapInvoicePayment(payment));
  }

  return created;
}

export async function markInvoiceAsPaid(
  invoicePaymentId: number,
  transactionId: number
): Promise<InvoicePayment | undefined> {
  const updated = await prisma.invoicePayment.update({
    where: { id: invoicePaymentId },
    data: {
      status: 'paid',
      transactionId,
      paidAt: new Date(),
    },
  });
  return mapInvoicePayment(updated);
}

export async function syncInvoiceTransactions(accountId: number): Promise<void> {
  await updateAllInvoiceTransactions(accountId);
}

// ---------------------------------------------------------------------------
// Legacy Invoice
// ---------------------------------------------------------------------------

export async function getLegacyInvoiceTransactions(
  accountId: number
): Promise<TransactionWithCategory[]> {
  const transactions = await prisma.transaction.findMany({
    where: {
      accountId,
      description: {
        contains: 'fatura',
        mode: 'insensitive',
      },
      OR: [{ isInvoiceTransaction: false }, { isInvoiceTransaction: undefined }],
    },
    include: { category: true },
    orderBy: [{ date: 'asc' }],
  });

  return transactions.map((tx) => mapTransaction(tx, (tx as any).category));
}

export async function deleteLegacyInvoiceTransactions(
  accountId: number
): Promise<{ deletedCount: number }> {
  const legacy = await getLegacyInvoiceTransactions(accountId);
  const ids = legacy.map((item) => item.id);
  if (ids.length === 0) {
    return { deletedCount: 0 };
  }

  await prisma.$transaction([
    prisma.invoicePayment.updateMany({
      where: { transactionId: { in: ids } },
      data: { transactionId: null },
    }),
    prisma.transaction.deleteMany({
      where: {
        accountId,
        id: { in: ids },
      },
    }),
  ]);

  return { deletedCount: ids.length };
}
