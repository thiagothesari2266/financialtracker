import { prisma } from "../db";
import {
  analyzeInvoiceImage,
  analyzeMultipleInvoiceImages,
  type InvoiceAnalysisResult,
} from "./openai.service";
import {
  processFile,
  processImageBuffer,
  cleanupTempFile,
} from "./image-parser.service";

export interface ProcessInvoiceRequest {
  filePath: string;
  filename: string;
  fileSize: number;
  fileType: string;
  creditCardId: number;
  accountId: number;
}

export interface ProcessImageBufferRequest {
  imageBuffer: Buffer;
  filename: string;
  fileType: string;
  creditCardId: number;
  accountId: number;
}

export interface ProcessMultipleImagesRequest {
  filePaths: string[];
  filenames: string[];
  fileSizes: number[];
  fileTypes: string[];
  creditCardId: number;
  accountId: number;
}

export interface ProcessInvoiceResult {
  importId: number;
  success: boolean;
  transactionsCount: number;
  extractedData?: InvoiceAnalysisResult;
  error?: string;
}

const parseDate = (value: string): Date => {
  return new Date(`${value}T00:00:00.000Z`);
};

async function createImportRecord({
  accountId,
  creditCardId,
  filename,
  fileSize,
  fileType,
  filePath,
}: {
  accountId: number;
  creditCardId: number;
  filename: string;
  fileSize: number;
  fileType: string;
  filePath: string;
}) {
  return prisma.invoiceImport.create({
    data: {
      accountId,
      creditCardId,
      filename,
      fileSize,
      fileType,
      filePath,
      status: "processing",
    },
  });
}

async function finalizeImport(
  importId: number,
  status: "completed" | "failed",
  extras: Partial<{
    extractedData: InvoiceAnalysisResult;
    transactionsImported: number;
    errorMessage: string;
  }> = {},
) {
  await prisma.invoiceImport.update({
    where: { id: importId },
    data: {
      status,
      extractedData: extras.extractedData,
      transactionsImported: extras.transactionsImported,
      errorMessage: extras.errorMessage,
      processedAt: new Date(),
    },
  });
}

async function buildCategoryMap(accountId: number) {
  const categories = await prisma.category.findMany({
    where: { accountId },
  });

  if (categories.length === 0) {
    throw new Error("Nenhuma categoria cadastrada para esta conta");
  }

  const map = new Map(categories.map((category) => [category.name.toLowerCase(), category.id]));
  return { categories, map };
}

function buildTransactionPayload(
  extracted: InvoiceAnalysisResult,
  request: { creditCardId: number; accountId: number },
  categoryMap: Map<string, number>,
  fallbackCategoryId: number,
) {
  return extracted.transactions.map((transaction) => {
    const categoryId =
      findMatchingCategory(transaction.category ?? "", categoryMap, transaction.description) ??
      fallbackCategoryId;

    const installments = transaction.installments ?? 1;
    const invoiceMonth =
      extracted.invoiceMonth || new Date(transaction.date).toISOString().slice(0, 7);

    return {
      description: transaction.description.slice(0, 255),
      amount: transaction.amount.toString(),
      date: parseDate(transaction.date),
      categoryId,
      creditCardId: request.creditCardId,
      accountId: request.accountId,
      installments,
      currentInstallment: transaction.currentInstallment ?? 1,
      invoiceMonth,
      launchType: installments > 1 ? "recorrente" : "unico",
    };
  });
}

async function persistTransactions(
  transactions: Array<ReturnType<typeof buildTransactionPayload>[number]>,
) {
  if (transactions.length === 0) {
    return 0;
  }

  const result = await prisma.creditCardTransaction.createMany({
    data: transactions,
  });

  return result.count;
}

export async function processInvoice(request: ProcessInvoiceRequest): Promise<ProcessInvoiceResult> {
  const importRecord = await createImportRecord({
    accountId: request.accountId,
    creditCardId: request.creditCardId,
    filename: request.filename,
    fileSize: request.fileSize,
    fileType: request.fileType,
    filePath: request.filePath,
  });

  try {
    const { imageBase64 } = await processFile(request.filePath, request.fileType);
    if (!imageBase64) {
      throw new Error("Não foi possível processar a imagem enviada");
    }

    const analysisResult = await analyzeInvoiceImage(imageBase64);
    if (!analysisResult.transactions || analysisResult.transactions.length === 0) {
      throw new Error("Nenhuma transação foi identificada na fatura");
    }

    const { categories, map } = await buildCategoryMap(request.accountId);
    const fallbackCategoryId = categories[0].id;
    const payload = buildTransactionPayload(analysisResult, request, map, fallbackCategoryId);
    const insertedCount = await persistTransactions(payload);

    await finalizeImport(importRecord.id, "completed", {
      extractedData: analysisResult,
      transactionsImported: insertedCount,
    });

    cleanupTempFile(request.filePath);

    return {
      importId: importRecord.id,
      success: true,
      transactionsCount: insertedCount,
      extractedData: analysisResult,
    };
  } catch (error) {
    await finalizeImport(importRecord.id, "failed", {
      errorMessage: error instanceof Error ? error.message : "Erro desconhecido",
    });
    cleanupTempFile(request.filePath);

    return {
      importId: importRecord.id,
      success: false,
      transactionsCount: 0,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

export async function processImageFromBuffer(
  request: ProcessImageBufferRequest,
): Promise<ProcessInvoiceResult> {
  const importRecord = await createImportRecord({
    accountId: request.accountId,
    creditCardId: request.creditCardId,
    filename: request.filename,
    fileSize: request.imageBuffer.length,
    fileType: request.fileType,
    filePath: "clipboard-image",
  });

  try {
    const { imageBase64 } = await processImageBuffer(request.imageBuffer, request.fileType);
    if (!imageBase64) {
      throw new Error("Não foi possível processar a imagem colada");
    }

    const analysisResult = await analyzeInvoiceImage(imageBase64);
    if (!analysisResult.transactions || analysisResult.transactions.length === 0) {
      throw new Error("Nenhuma transação foi identificada na fatura");
    }

    const { categories, map } = await buildCategoryMap(request.accountId);
    const fallbackCategoryId = categories[0].id;
    const payload = buildTransactionPayload(analysisResult, request, map, fallbackCategoryId);
    const insertedCount = await persistTransactions(payload);

    await finalizeImport(importRecord.id, "completed", {
      extractedData: analysisResult,
      transactionsImported: insertedCount,
    });

    return {
      importId: importRecord.id,
      success: true,
      transactionsCount: insertedCount,
      extractedData: analysisResult,
    };
  } catch (error) {
    await finalizeImport(importRecord.id, "failed", {
      errorMessage: error instanceof Error ? error.message : "Erro desconhecido",
    });

    return {
      importId: importRecord.id,
      success: false,
      transactionsCount: 0,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

export async function processMultipleImages(
  request: ProcessMultipleImagesRequest,
): Promise<ProcessInvoiceResult> {
  const totalSize = request.fileSizes.reduce((sum, size) => sum + size, 0);
  const importRecord = await createImportRecord({
    accountId: request.accountId,
    creditCardId: request.creditCardId,
    filename: `${request.filenames.length} imagens: ${request.filenames.join(", ")}`,
    fileSize: totalSize,
    fileType: "multiple-images",
    filePath: request.filePaths.join(";"),
  });

  try {
    const base64Images: string[] = [];

    for (let index = 0; index < request.filePaths.length; index++) {
      const filePath = request.filePaths[index];
      const fileType = request.fileTypes[index];
      try {
        const { imageBase64 } = await processFile(filePath, fileType);
        if (imageBase64) {
          base64Images.push(imageBase64);
        }
      } finally {
        cleanupTempFile(filePath);
      }
    }

    if (base64Images.length === 0) {
      throw new Error("Não foi possível processar nenhuma das imagens enviadas");
    }

    const analysisResult =
      base64Images.length === 1
        ? await analyzeInvoiceImage(base64Images[0])
        : await analyzeMultipleInvoiceImages(base64Images);

    if (!analysisResult.transactions || analysisResult.transactions.length === 0) {
      throw new Error("Nenhuma transação foi identificada nas imagens");
    }

    const { categories, map } = await buildCategoryMap(request.accountId);
    const fallbackCategoryId = categories[0].id;
    const payload = buildTransactionPayload(analysisResult, request, map, fallbackCategoryId);
    const insertedCount = await persistTransactions(payload);

    await finalizeImport(importRecord.id, "completed", {
      extractedData: analysisResult,
      transactionsImported: insertedCount,
    });

    return {
      importId: importRecord.id,
      success: true,
      transactionsCount: insertedCount,
      extractedData: analysisResult,
    };
  } catch (error) {
    await finalizeImport(importRecord.id, "failed", {
      errorMessage: error instanceof Error ? error.message : "Erro desconhecido",
    });

    return {
      importId: importRecord.id,
      success: false,
      transactionsCount: 0,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

function findMatchingCategory(
  categoryName: string,
  categoryMap: Map<string, number>,
  transactionDescription?: string,
): number | null {
  if (!categoryName && !transactionDescription) return null;

  const normalizedCategory = categoryName.toLowerCase().trim();
  const normalizedDescription = (transactionDescription ?? "").toLowerCase().trim();
  const combinedText = `${normalizedCategory} ${normalizedDescription}`;

  if (normalizedCategory && categoryMap.has(normalizedCategory)) {
    return categoryMap.get(normalizedCategory)!;
  }

  for (const [existing, id] of categoryMap.entries()) {
    if (
      (normalizedCategory && existing.includes(normalizedCategory)) ||
      (normalizedCategory && normalizedCategory.includes(existing))
    ) {
      return id;
    }
  }

  for (const [targetCategory, keywords] of Object.entries(smartCategoryDictionary)) {
    const categoryId = categoryMap.get(targetCategory);
    if (!categoryId) continue;

    const matchesKeyword = keywords.some((keyword) => {
      const normalizedKeyword = keyword.toLowerCase();
      return (
        combinedText.includes(normalizedKeyword) ||
        removeAccents(combinedText).includes(removeAccents(normalizedKeyword))
      );
    });

    if (matchesKeyword) {
      return categoryId;
    }
  }

  return null;
}

const smartCategoryDictionary: Record<string, string[]> = {
  alimentação: [
    "extra",
    "carrefour",
    "walmart",
    "atacadao",
    "assai",
    "supermercado",
    "mercado",
    "ifood",
    "uber eats",
    "ubereats",
    "rappi",
    "delivery",
    "restaurant",
    "lanchonete",
    "pizzaria",
    "mcdonald",
    "burger king",
    "padaria",
    "padaria",
    "cafe",
    "starbucks",
    "hortifruti",
    "acougue",
    "alimento",
  ],
  transporte: [
    "shell",
    "petrobras",
    "br",
    "ipiranga",
    "posto",
    "combustivel",
    "gasolina",
    "uber",
    "taxi",
    "99",
    "metrô",
    "metro",
    "onibus",
    "estacionamento",
    "pedagio",
    "sem parar",
    "mecanica",
    "oficina",
  ],
  saúde: [
    "droga",
    "farmacia",
    "drogaria",
    "hospital",
    "clinica",
    "laboratorio",
    "exame",
    "consulta",
    "medic",
    "plano de saude",
    "odontologia",
  ],
  lazer: [
    "netflix",
    "spotify",
    "disney",
    "globoplay",
    "cinema",
    "ingresso",
    "teatro",
    "show",
    "hotel",
    "viagem",
    "resort",
    "parque",
  ],
  educação: [
    "escola",
    "colegio",
    "universidade",
    "faculdade",
    "curso",
    "livro",
    "papelaria",
    "kalunga",
    "apostila",
  ],
  casa: [
    "leroy",
    "telhanorte",
    "tok stok",
    "casas bahia",
    "magazine luiza",
    "mobly",
    "madeira",
    "moveis",
    "decoracao",
    "reforma",
    "limpeza",
  ],
  tecnologia: [
    "apple",
    "samsung",
    "lg",
    "google",
    "amazon",
    "kabum",
    "pichau",
    "notebook",
    "computador",
    "celular",
    "software",
    "internet",
    "banda larga",
  ],
  escritório: ["papelaria", "office", "material escritorio", "mesa", "cadeira", "toner"],
  marketing: ["facebook ads", "google ads", "instagram", "design", "grafica", "banner"],
  fornecedores: ["fornecedor", "distribuidor", "atacado", "materia prima", "insumo", "terceirizado"],
};

function removeAccents(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export async function getInvoiceImports(creditCardId: number, accountId: number) {
  return prisma.invoiceImport.findMany({
    where: {
      creditCardId,
      accountId,
    },
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function getInvoiceImportDetails(importId: number, accountId: number) {
  const record = await prisma.invoiceImport.findFirst({
    where: {
      id: importId,
      accountId,
    },
  });

  if (!record) {
    throw new Error("Importação não encontrada");
  }

  return record;
}
