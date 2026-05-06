const brFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "America/Sao_Paulo",
});

export function todayBR(): string {
  return brFormatter.format(new Date());
}

export function currentMonthBR(): string {
  return todayBR().substring(0, 7);
}

export function ensureDateString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return d.toISOString().slice(0, 10);
}

export function parseDateInput(value: string): Date {
  if (value.includes("T")) return new Date(value);
  return new Date(`${value}T00:00:00.000Z`);
}

export function addMonthsPreserveDay(date: Date, months: number): Date {
  const originalDay = date.getUTCDate();
  const d = new Date(date);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)
  ).getUTCDate();
  d.setUTCDate(Math.min(originalDay, lastDay));
  return d;
}

export function computeInvoiceDueDate(invoiceMonth: string, dueDay: number): string {
  const [year, month] = invoiceMonth.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(dueDay, lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function monthLastDay(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function calculateInvoiceMonth(date: Date, closingDay: number): string {
  const day = date.getUTCDate();
  let month = date.getUTCMonth() + 1;
  let year = date.getUTCFullYear();
  if (closingDay >= 25) {
    if (day <= closingDay) month += 1;
    else month += 2;
  } else {
    if (day > closingDay) month += 1;
  }
  if (month > 12) {
    month -= 12;
    year += 1;
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}
