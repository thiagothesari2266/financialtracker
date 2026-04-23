import { prisma } from '../db';
import { addDays, differenceInDays } from '../storage/utils';

export interface AsaasImportData {
  amount: string | number;
  dueDate: Date | string;
  paymentDate?: Date | string | null;
  description?: string | null;
  externalReference?: string | null;
  bankAccountId?: number | null;
}

export interface MatchCandidate {
  id: number;
  amount: string | number;
  date: Date | string;
  description: string;
  bankAccountId: number | null;
  externalId: string | null;
}

export interface MatchResult {
  transactionId: number;
  score: number;
}

/**
 * Normaliza string para comparacao: minusculas, sem acentos, sem caracteres especiais.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Distancia de Levenshtein simplificada (retorna valor entre 0 e 1, sendo 1 = identico).
 * Limitada a strings curtas para performance.
 */
function similarityScore(a: string, b: string): number {
  if (!a || !b) return 0;
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (na === nb) return 1;
  if (nb.includes(na) || na.includes(nb)) return 0.8;

  // Jaccard por palavras (suficiente para o caso de uso)
  const arrA = na.split(' ').filter(Boolean);
  const arrB = nb.split(' ').filter(Boolean);
  const wordsB = new Set(arrB);
  if (arrA.length === 0 || arrB.length === 0) return 0;

  let intersection = 0;
  for (let i = 0; i < arrA.length; i++) {
    if (wordsB.has(arrA[i])) intersection++;
  }
  const union = arrA.length + arrB.length - intersection;
  return union > 0 ? intersection / union : 0;
}

function toDate(value: Date | string): Date {
  if (value instanceof Date) return value;
  if (value.includes('T')) return new Date(value);
  return new Date(`${value}T00:00:00.000Z`);
}

function toNumber(value: string | number): number {
  if (typeof value === 'number') return value;
  return Number.parseFloat(value);
}

/**
 * Calcula score de match entre um import do Asaas e uma transacao candidata.
 * Score maximo: 100
 *   +60 valor exato (diferenca < 0.01)
 *   +25 data exata
 *   +15 data com diferenca de 1 dia
 *   +5  data com diferenca de 2-3 dias
 *   +10 descricao similar (similaridade >= 0.5)
 *   +5  externalReference presente na descricao da transacao
 */
export function scoreCandidate(importData: AsaasImportData, candidate: MatchCandidate): number {
  let score = 0;

  // Score de valor
  const importAmount = toNumber(importData.amount);
  const candidateAmount = toNumber(candidate.amount);
  if (Math.abs(importAmount - candidateAmount) < 0.01) {
    score += 60;
  }

  // Score de data: usa paymentDate se disponivel, senao dueDate
  const referenceDate = importData.paymentDate
    ? toDate(importData.paymentDate)
    : toDate(importData.dueDate);
  const candidateDate = toDate(candidate.date);
  const daysDiff = Math.abs(differenceInDays(referenceDate, candidateDate));

  if (daysDiff === 0) {
    score += 25;
  } else if (daysDiff === 1) {
    score += 15;
  } else if (daysDiff <= 3) {
    score += 5;
  }

  // Score de descricao
  if (importData.description && candidate.description) {
    const sim = similarityScore(importData.description, candidate.description);
    if (sim >= 0.5) {
      score += 10;
    }
  }

  // Score de referencia externa
  if (importData.externalReference && candidate.description) {
    const normalRef = normalizeText(importData.externalReference);
    const normalDesc = normalizeText(candidate.description);
    if (normalRef.length > 0 && normalDesc.includes(normalRef)) {
      score += 5;
    }
  }

  return score;
}

/**
 * Encontra o melhor match entre um import e uma lista de candidatos.
 * Retorna o candidato com maior score se score >= 60, caso contrario null.
 */
export function findBestMatch(
  importData: AsaasImportData,
  candidates: MatchCandidate[]
): MatchResult | null {
  if (candidates.length === 0) return null;

  let bestScore = 0;
  let bestId = -1;

  for (const candidate of candidates) {
    const score = scoreCandidate(importData, candidate);
    if (score > bestScore) {
      bestScore = score;
      bestId = candidate.id;
    }
  }

  if (bestScore >= 60 && bestId !== -1) {
    return { transactionId: bestId, score: bestScore };
  }
  return null;
}

/**
 * Busca candidatos no banco de dados para reconciliacao.
 * Filtra: type=direction, paid=false, externalId=null,
 * bankAccountId null OU igual ao do import, data ±3 dias do dueDate/paymentDate.
 */
export async function getMatchCandidates(
  importData: AsaasImportData,
  accountId: number,
  direction: 'income' | 'expense' = 'income',
): Promise<MatchCandidate[]> {
  const referenceDate = importData.paymentDate
    ? toDate(importData.paymentDate)
    : toDate(importData.dueDate);

  const dateMin = addDays(referenceDate, -3);
  const dateMax = addDays(referenceDate, 3);

  const bankAccountFilter = importData.bankAccountId
    ? { OR: [{ bankAccountId: null }, { bankAccountId: importData.bankAccountId }] }
    : {};

  const transactions = await prisma.transaction.findMany({
    where: {
      accountId,
      type: direction,
      paid: false,
      externalId: null,
      date: {
        gte: dateMin,
        lte: dateMax,
      },
      ...bankAccountFilter,
    },
    select: {
      id: true,
      amount: true,
      date: true,
      description: true,
      bankAccountId: true,
      externalId: true,
    },
  });

  return transactions.map((tx) => ({
    id: tx.id,
    amount: tx.amount.toString(),
    date: tx.date,
    description: tx.description,
    bankAccountId: tx.bankAccountId ?? null,
    externalId: tx.externalId ?? null,
  }));
}
