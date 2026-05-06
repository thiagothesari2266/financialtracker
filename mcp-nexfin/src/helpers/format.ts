import type { MappedTx } from "../transactions/query.js";

export function decimalToString(value: unknown): string {
  if (value === null || value === undefined) return "0.00";
  const n = parseFloat(String(value));
  return isFinite(n) ? n.toFixed(2) : "0.00";
}

export function formatBRL(value: number | string): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (!isFinite(n)) return "R$ 0,00";
  const abs = Math.abs(n);
  const formatted = abs
    .toFixed(2)
    .replace(".", ",")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return n < 0 ? `R$ -${formatted}` : `R$ ${formatted}`;
}

export const MONTH_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function monthAbbr(dateStr: string): string {
  const m = parseInt(dateStr.substring(5, 7)) - 1;
  return MONTH_ABBR[m] ?? dateStr.substring(5, 7);
}

export function txLine(tx: MappedTx, viewMonth?: string): string {
  const status = tx.paid ? "Pago" : tx.isOverdue ? "ATRASO" : "Pendente";
  const cat = tx.categoryName ?? "Sem categoria";
  const virtual = tx.isVirtual ? " [rec]" : "";
  const installment =
    tx.installments && tx.installments > 1
      ? ` (${tx.currentInstallment}/${tx.installments})`
      : "";

  let originTag = "";
  if (tx.exceptionForDate) {
    const origMonth = tx.exceptionForDate.substring(0, 7);
    const txMonth = tx.date.substring(0, 7);
    if (origMonth !== txMonth) {
      originTag = ` (${monthAbbr(tx.exceptionForDate)})`;
    }
  } else if (viewMonth) {
    const txMonth = tx.date.substring(0, 7);
    if (txMonth !== viewMonth) {
      originTag = ` (${monthAbbr(tx.date)})`;
    }
  }

  const idCol = tx.isVirtual ? `${tx.id}*` : `${tx.id}`;
  return `| ${idCol} | ${tx.date} | ${tx.description}${installment}${virtual}${originTag} | ${formatBRL(tx.amount)} | ${status} | ${cat} |`;
}
