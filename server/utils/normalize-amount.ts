export const normalizeAmount = (value: unknown, decimals = 2): string | undefined => {
  if (value === null || value === undefined) return undefined;

  const raw = String(value).trim();
  if (!raw) return undefined;

  const hasComma = raw.includes(',');
  const hasDot = raw.includes('.');

  // Vírgula como decimal: remove pontos de milhar e troca vírgula por ponto
  if (hasComma && (!hasDot || raw.lastIndexOf(',') > raw.lastIndexOf('.'))) {
    const withoutThousands = raw.replace(/\./g, '');
    const normalized = withoutThousands.replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    if (Number.isFinite(parsed)) return parsed.toFixed(decimals);
  }

  // Ponto como decimal: remover vírgulas usadas como milhar
  if (hasDot) {
    const normalized = raw.replace(/,/g, '');
    const parsed = Number.parseFloat(normalized);
    if (Number.isFinite(parsed)) return parsed.toFixed(decimals);
  }

  // Sem separadores explícitos: interpretar como número inteiro ou decimal já no formato do usuário
  const parsed = Number.parseFloat(raw.replace(/\s+/g, ''));
  return Number.isFinite(parsed) ? parsed.toFixed(decimals) : undefined;
};
