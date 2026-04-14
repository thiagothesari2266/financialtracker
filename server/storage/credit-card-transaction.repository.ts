import { randomUUID } from 'crypto';
import { prisma } from '../db';
import { mapCreditCardTransaction, stripCategoryFromCardTx } from './mappers';
import {
  parseDateInput,
  addMonthsPreserveDay,
  calculateInvoiceMonth,
} from './utils';
import { updateAllInvoiceTransactions } from './credit-card-invoice.repository';
import type {
  CreditCardTransaction,
  InsertCreditCardTransaction,
  CreditCardTransactionWithCategory,
} from '@shared/schema';
import type {
  Prisma,
  CreditCardTransaction as PrismaCreditCardTransaction,
} from '@prisma/client';

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
