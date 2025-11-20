import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { processInvoice, processImageFromBuffer, processMultipleImages, getInvoiceImports, getInvoiceImportDetails } from '../services/invoice-processor.service';

// Configuração do multer para upload de arquivos  
const uploadDir = path.join(process.cwd(), 'server/uploads/invoices');

// Criar diretório se não existir
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Gerar nome único para o arquivo
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `invoice-${uniqueSuffix}${extension}`);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Aceitar apenas imagens
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de arquivo não suportado. Use apenas JPG ou PNG.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10, // Maximum 10 files
    fieldSize: 50 * 1024 * 1024, // 50MB field size
  }
});

/**
 * POST /api/invoice-paste
 * Processamento de imagem colada da área de transferência
 */
export function pasteInvoiceImage(req: Request, res: Response) {
  console.log('[Invoice Paste] Iniciando processamento de imagem colada...');
  
  try {
    const { imageData, creditCardId, accountId } = req.body;
    
    if (!imageData || !creditCardId || !accountId) {
      return res.status(400).json({ 
        error: 'imageData, creditCardId e accountId são obrigatórios' 
      });
    }

    // Parse base64 image data
    const matches = imageData.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ 
        error: 'Formato de imagem inválido. Use base64 com data URL.' 
      });
    }

    const imageType = matches[1];
    const base64Data = matches[2];
    const imageBuffer = Buffer.from(base64Data, 'base64');

    console.log(`[Invoice Paste] Imagem recebida: ${imageType} (${imageBuffer.length} bytes)`);

    // Process the image
    processImageFromBuffer({
      imageBuffer,
      filename: `pasted-image-${Date.now()}.${imageType}`,
      fileType: `image/${imageType}`,
      creditCardId: parseInt(creditCardId),
      accountId: parseInt(accountId),
    }).then(result => {
      if (result.success) {
        res.json({
          success: true,
          importId: result.importId,
          transactionsCount: result.transactionsCount,
          transactions: result.extractedData?.transactions || [],
          message: `${result.transactionsCount} transações importadas com sucesso`
        });
      } else {
        res.status(422).json({
          success: false,
          error: result.error || 'Erro no processamento da imagem'
        });
      }
    }).catch(error => {
      console.error('Erro no processamento de imagem colada:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Erro interno do servidor'
      });
    });

  } catch (error) {
    console.error('Erro ao processar imagem colada:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    });
  }
}

/**
 * POST /api/invoice-upload-multiple
 * Upload e processamento de múltiplas imagens de fatura
 */
export function uploadMultipleInvoiceImages(req: Request, res: Response) {
  console.log('[Invoice Upload Multiple] Iniciando upload de múltiplas imagens...');
  
  // Aplicar middleware de upload para múltiplos arquivos
  upload.array('files', 10)(req, res, async (err) => { // máximo 10 arquivos
    if (err) {
      console.error('[Invoice Upload Multiple] Erro no upload:', err);
      return res.status(400).json({
        error: err.message || 'Erro no upload dos arquivos'
      });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const { creditCardId, accountId } = req.body;
    
    if (!creditCardId || !accountId) {
      // Limpar arquivos se dados inválidos
      files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
      return res.status(400).json({ 
        error: 'creditCardId e accountId são obrigatórios' 
      });
    }

    console.log(`[Upload Multiple] ${files.length} arquivos recebidos`);

    try {
      // Processar múltiplas imagens
      const result = await processMultipleImages({
        filePaths: files.map(f => f.path),
        filenames: files.map(f => f.originalname),
        fileSizes: files.map(f => f.size),
        fileTypes: files.map(f => f.mimetype),
        creditCardId: parseInt(creditCardId),
        accountId: parseInt(accountId),
      });

      if (result.success) {
        res.json({
          success: true,
          importId: result.importId,
          transactionsCount: result.transactionsCount,
          transactions: result.extractedData?.transactions || [],
          message: `${result.transactionsCount} transações importadas de ${files.length} imagem(ns)`
        });
      } else {
        res.status(422).json({
          success: false,
          error: result.error || 'Erro no processamento das imagens'
        });
      }

    } catch (error) {
      console.error('Erro no processamento de múltiplas imagens:', error);
      
      // Limpar arquivos em caso de erro
      files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });

      res.status(500).json({
        error: error instanceof Error ? error.message : 'Erro interno do servidor'
      });
    }
  });
}

/**
 * POST /api/invoice-upload
 * Upload e processamento de fatura
 */
export function uploadInvoice(req: Request, res: Response) {
  console.log('[Invoice Upload] Iniciando upload...');
  
  // Aplicar middleware de upload
  upload.single('file')(req, res, async (err) => {
    if (err) {
      console.error('[Invoice Upload] Erro no upload:', err);
      return res.status(400).json({
        error: err.message || 'Erro no upload do arquivo'
      });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const { creditCardId, accountId } = req.body;
    
    if (!creditCardId || !accountId) {
      // Limpar arquivo se dados inválidos
      fs.unlinkSync(file.path);
      return res.status(400).json({ 
        error: 'creditCardId e accountId são obrigatórios' 
      });
    }

    console.log(`[Upload] Arquivo recebido: ${file.originalname} (${file.size} bytes)`);

    try {
      // Processar fatura
      const result = await processInvoice({
        filePath: file.path,
        filename: file.originalname,
        fileSize: file.size,
        fileType: file.mimetype,
        creditCardId: parseInt(creditCardId),
        accountId: parseInt(accountId),
      });

      if (result.success) {
        res.json({
          success: true,
          importId: result.importId,
          transactionsCount: result.transactionsCount,
          transactions: result.extractedData?.transactions || [],
          message: `${result.transactionsCount} transações importadas com sucesso`
        });
      } else {
        res.status(422).json({
          success: false,
          error: result.error || 'Erro no processamento da fatura'
        });
      }

    } catch (error) {
      console.error('Erro no processamento:', error);
      
      // Limpar arquivo em caso de erro
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      res.status(500).json({
        error: error instanceof Error ? error.message : 'Erro interno do servidor'
      });
    }
  });
}

/**
 * GET /api/invoice-imports/:creditCardId
 * Lista importações de um cartão
 */
export async function getCardInvoiceImports(req: Request, res: Response) {
  try {
    const { creditCardId } = req.params;
    const { accountId } = req.query;

    if (!accountId) {
      return res.status(400).json({ error: 'accountId é obrigatório' });
    }

    const imports = await getInvoiceImports(
      parseInt(creditCardId),
      parseInt(accountId as string)
    );

    res.json(imports);

  } catch (error) {
    console.error('Erro ao buscar importações:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    });
  }
}

/**
 * GET /api/invoice-import/:importId
 * Detalhes de uma importação específica
 */
export async function getInvoiceImportDetail(req: Request, res: Response) {
  try {
    const { importId } = req.params;
    const { accountId } = req.query;

    if (!accountId) {
      return res.status(400).json({ error: 'accountId é obrigatório' });
    }

    const importDetails = await getInvoiceImportDetails(
      parseInt(importId),
      parseInt(accountId as string)
    );

    res.json(importDetails);

  } catch (error) {
    console.error('Erro ao buscar detalhes da importação:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    });
  }
}

/**
 * POST /api/invoice-import/:importId/retry
 * Retry processamento de uma importação falhada
 */
export async function retryInvoiceImport(req: Request, res: Response) {
  try {
    const { importId } = req.params;
    const { accountId } = req.body;

    if (!accountId) {
      return res.status(400).json({ error: 'accountId é obrigatório' });
    }

    // Buscar importação
    const importDetails = await getInvoiceImportDetails(
      parseInt(importId),
      parseInt(accountId)
    );

    if (importDetails.status !== 'failed') {
      return res.status(400).json({ 
        error: 'Apenas importações falhadas podem ser reprocessadas' 
      });
    }

    // Verificar se arquivo ainda existe
    if (!fs.existsSync(importDetails.filePath)) {
      return res.status(400).json({ 
        error: 'Arquivo da importação não encontrado' 
      });
    }

    // Reprocessar
    const result = await processInvoice({
      filePath: importDetails.filePath,
      filename: importDetails.filename,
      fileSize: importDetails.fileSize,
      fileType: importDetails.fileType,
      creditCardId: importDetails.creditCardId,
      accountId: importDetails.accountId,
    });

    if (result.success) {
      res.json({
        success: true,
        transactionsCount: result.transactionsCount,
        message: `${result.transactionsCount} transações importadas com sucesso`
      });
    } else {
      res.status(422).json({
        success: false,
        error: result.error || 'Erro no reprocessamento da fatura'
      });
    }

  } catch (error) {
    console.error('Erro no reprocessamento:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    });
  }
}