import { pool } from "../db.js";
import { todayBR, ensureDateString, parseDateInput, addMonthsPreserveDay } from "../helpers/dates.js";
import { decimalToString } from "../helpers/format.js";

export interface MappedTx {
  id: number;
  description: string;
  amount: string;
  type: string;
  date: string;
  categoryName: string | null;
  paid: boolean;
  launchType: string | null;
  recurrenceFrequency: string | null;
  recurrenceGroupId: string | null;
  recurrenceEndDate: string | null;
  installments: number | null;
  currentInstallment: number | null;
  bankAccountId: number | null;
  paymentMethod: string | null;
  creditCardInvoiceId: string | null;
  isInvoiceTransaction: boolean;
  isException: boolean;
  exceptionForDate: string | null;
  isVirtual: boolean;
  isOverdue: boolean;
  clientName: string | null;
  projectName: string | null;
  costCenter: string | null;
}

export function mapRow(row: any, today: string, virtual = false): MappedTx {
  const dateStr = ensureDateString(row.date) ?? "";
  const paid = row.paid ?? false;
  return {
    id: row.id,
    description: row.description ?? "",
    amount: decimalToString(row.amount),
    type: row.type,
    date: dateStr,
    categoryName: row.category_name ?? null,
    paid,
    launchType: row.launch_type ?? null,
    recurrenceFrequency: row.recurrence_frequency ?? null,
    recurrenceGroupId: row.recurrence_group_id ?? null,
    recurrenceEndDate: ensureDateString(row.recurrence_end_date),
    installments: row.installments ?? null,
    currentInstallment: row.current_installment ?? null,
    bankAccountId: row.bank_account_id ?? null,
    paymentMethod: row.payment_method ?? null,
    creditCardInvoiceId: row.credit_card_invoice_id ?? null,
    isInvoiceTransaction: row.is_invoice_transaction ?? false,
    isException: row.is_exception ?? false,
    exceptionForDate: ensureDateString(row.exception_for_date),
    isVirtual: virtual,
    isOverdue: !paid && dateStr !== "" && dateStr < today,
    clientName: row.client_name ?? null,
    projectName: row.project_name ?? null,
    costCenter: row.cost_center ?? null,
  };
}

export const TX_SELECT = `
  SELECT t.id, t.description, t.amount, t.type, t.date,
         t.bank_account_id, t.payment_method, t.paid,
         t.launch_type, t.recurrence_frequency, t.recurrence_group_id,
         t.recurrence_end_date, t.installments, t.current_installment,
         t.installments_group_id, t.is_exception, t.exception_for_date,
         t.credit_card_invoice_id, t.is_invoice_transaction, t.credit_card_id,
         t.client_name, t.project_name, t.cost_center, t.created_at,
         c.name as category_name, c.type as category_type
  FROM transactions t
  LEFT JOIN categories c ON t.category_id = c.id
`;

export async function getTransactionsByDateRange(
  accountId: number,
  startDate: string,
  endDate: string
): Promise<MappedTx[]> {
  const start = parseDateInput(startDate);
  const end = parseDateInput(endDate);
  const today = todayBR();

  // 1. Physical transactions (non-exception, not monthly recurrence definitions)
  const physical = await pool.query(
    `${TX_SELECT}
     WHERE t.account_id = $1
       AND t.date >= $2::date AND t.date <= $3::date
       AND COALESCE(t.is_exception, false) = false
       AND NOT (
         COALESCE(t.launch_type, '') = 'recorrente'
         AND COALESCE(t.recurrence_frequency, '') = 'mensal'
       )
     ORDER BY t.date ASC, t.created_at ASC`,
    [accountId, startDate, endDate]
  );

  // 2. All exceptions for this account (unbounded by date)
  const allExceptions = await pool.query(
    `${TX_SELECT}
     WHERE t.account_id = $1 AND t.is_exception = true`,
    [accountId]
  );

  // 3. Build exception keys set
  const exceptionKeys = new Set<string>();
  for (const e of allExceptions.rows) {
    if (e.exception_for_date && e.recurrence_group_id) {
      exceptionKeys.add(
        `${e.recurrence_group_id}-${ensureDateString(e.exception_for_date)}`
      );
    }
  }

  // 4. Monthly recurrence definitions
  const recurrenceDefs = await pool.query(
    `${TX_SELECT}
     WHERE t.account_id = $1
       AND t.launch_type = 'recorrente'
       AND t.recurrence_frequency = 'mensal'
       AND COALESCE(t.is_exception, false) = false`,
    [accountId]
  );

  // 5. Generate virtual transactions
  const virtuals: MappedTx[] = [];
  for (const def of recurrenceDefs.rows) {
    const base = mapRow(def, today, true);
    const firstDate = parseDateInput(base.date);
    const recEnd = base.recurrenceEndDate
      ? parseDateInput(base.recurrenceEndDate)
      : null;

    for (let offset = 0; offset <= 120; offset++) {
      const vDate = addMonthsPreserveDay(firstDate, offset);
      if (vDate > end) break;
      if (recEnd && vDate > recEnd) break;

      if (vDate >= start) {
        const vDateStr = ensureDateString(vDate)!;
        const key = `${def.recurrence_group_id}-${vDateStr}`;
        if (!exceptionKeys.has(key)) {
          virtuals.push({
            ...base,
            date: vDateStr,
            paid: false,
            isVirtual: true,
            isOverdue: vDateStr < today,
          });
        }
      }
    }
  }

  // 6. Exceptions whose real date falls in period
  const exceptionsInPeriod = allExceptions.rows.filter((e: any) => {
    const eDate = new Date(e.date);
    if (eDate < start || eDate > end) return false;

    if (e.recurrence_group_id) {
      const eDateStr = ensureDateString(e.date);
      const supersededKey = `${e.recurrence_group_id}-${eDateStr}`;
      if (exceptionKeys.has(supersededKey)) return false;
    }

    return true;
  });

  // 7. Merge + sort
  const all = [
    ...physical.rows.map((r: any) => mapRow(r, today)),
    ...exceptionsInPeriod.map((r: any) => mapRow(r, today)),
    ...virtuals,
  ];
  return all.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}
