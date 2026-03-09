const formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' });

export function todayBR(): string {
  return formatter.format(new Date()); // 'YYYY-MM-DD'
}

export function currentMonthBR(): string {
  return todayBR().substring(0, 7); // 'YYYY-MM'
}
