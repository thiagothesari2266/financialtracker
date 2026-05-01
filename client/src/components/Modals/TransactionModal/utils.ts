/**
 * Calcula o mês da fatura baseado na data da transação e dia de fechamento do cartão.
 */
export function calculateInvoiceMonth(transactionDate: string, closingDay: number): string {
  const purchaseDate = new Date(transactionDate);
  let invoiceMonth = purchaseDate.getMonth() + 1; // 1-12
  let invoiceYear = purchaseDate.getFullYear();

  if (closingDay >= 25) {
    if (purchaseDate.getDate() <= closingDay) {
      invoiceMonth += 1;
      if (invoiceMonth > 12) {
        invoiceMonth = 1;
        invoiceYear += 1;
      }
    } else {
      invoiceMonth += 2;
      if (invoiceMonth > 12) {
        invoiceMonth -= 12;
        invoiceYear += 1;
      }
    }
  } else {
    if (purchaseDate.getDate() > closingDay) {
      invoiceMonth += 1;
      if (invoiceMonth > 12) {
        invoiceMonth = 1;
        invoiceYear += 1;
      }
    }
  }

  return `${invoiceYear}-${String(invoiceMonth).padStart(2, '0')}`;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/**
 * Formata o mês da fatura de forma amigável (ex: "Abril de 2026").
 */
export function formatInvoiceMonth(transactionDate: string, closingDay: number): string {
  const yearMonth = calculateInvoiceMonth(transactionDate, closingDay);
  const [year, month] = yearMonth.split('-');
  return `${MONTH_NAMES[parseInt(month) - 1]} de ${year}`;
}

/**
 * Detecta campos alterados entre o original e o atualizado.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payloads de API têm shape dinâmico e não mapeiam para um tipo fixo sem cast excessivo
export function getChangedFields(original: any, updated: any): Record<string, unknown> {
  const changed: Record<string, unknown> = {};
  for (const key of Object.keys(updated)) {
    if (['editScope', 'installmentsGroupId'].includes(key)) continue;
    if (String(updated[key] ?? '') !== String(original[key] ?? '')) {
      if (key === 'categoryId') {
        const numVal = Number(updated[key]);
        if (
          updated[key] === null ||
          updated[key] === undefined ||
          updated[key] === '' ||
          updated[key] === 'null' ||
          (typeof updated[key] === 'string' && updated[key].trim() === '') ||
          Number.isNaN(numVal) ||
          !Number.isFinite(numVal)
        ) {
          continue;
        }
        changed[key] = numVal;
        continue;
      }
      if (updated[key] !== null && updated[key] !== undefined && updated[key] !== '') {
        if (['bankAccountId', 'installments'].includes(key)) {
          changed[key] = Number(updated[key]);
        } else {
          changed[key] = updated[key];
        }
      }
    }
  }
  return changed;
}

/**
 * Limpa campos inválidos de um payload antes do envio ao backend.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payloads de API têm shape dinâmico
export function cleanPatchPayload(payload: any): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const key in payload) {
    if (
      payload[key] === null ||
      payload[key] === undefined ||
      (payload[key] === '' && key !== 'recurrenceEndDate') ||
      payload[key] === 'null' ||
      (typeof payload[key] === 'string' &&
        payload[key].trim() === '' &&
        key !== 'recurrenceEndDate')
    ) {
      if (key === 'date') continue;
      if (key === 'recurrenceGroupId' || key === 'installmentsGroupId') continue;
      continue;
    }
    if (key === 'recurrenceEndDate' && payload[key] === '') {
      cleaned[key] = '';
      continue;
    }
    if (['categoryId', 'bankAccountId', 'installments'].includes(key)) {
      const numVal = Number(payload[key]);
      if (Number.isNaN(numVal) || !Number.isFinite(numVal)) continue;
      cleaned[key] = numVal;
    } else {
      cleaned[key] = payload[key];
    }
  }
  return cleaned;
}

/**
 * Verifica se um categoryId é válido (numérico e finito).
 */
export function isValidCategoryId(value: unknown): boolean {
  if (
    value === null ||
    value === undefined ||
    value === '' ||
    value === 'null' ||
    (typeof value === 'string' && value.trim() === '')
  ) {
    return false;
  }
  const numVal = Number(value);
  return !Number.isNaN(numVal) && Number.isFinite(numVal);
}

/**
 * Determina o launchType a partir de uma transação existente.
 */
export function resolveLaunchType(
  transaction: Pick<{ launchType: string | null; installments: number }, 'launchType' | 'installments'>
): 'unica' | 'recorrente' | 'parcelada' {
  if (
    transaction.launchType === 'recorrente' ||
    transaction.launchType === 'parcelada' ||
    transaction.launchType === 'unica'
  ) {
    return transaction.launchType;
  }
  return transaction.installments > 1
    ? 'parcelada'
    : 'unica';
}

export const COST_CENTERS = [
  'Vendas',
  'Marketing',
  'Administrativo',
  'Tecnologia',
  'Recursos Humanos',
  'Financeiro',
];
