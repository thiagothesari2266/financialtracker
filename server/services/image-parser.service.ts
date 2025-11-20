import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

/**
 * Image processing for Vision API
 */

/**
 * Processa imagem e converte para base64
 */
export async function processImageToBase64(filePath: string): Promise<string> {
  try {
    console.log(`[Image Parser] Processando imagem: ${filePath}`);
    
    // Para imagens, usar Sharp para otimização
    const optimizedBuffer = await sharp(filePath)
      .resize(2000, 2000, { 
        fit: 'inside', 
        withoutEnlargement: true 
      })
      .png({ 
        quality: 90,
        progressive: true 
      })
      .toBuffer();
    
    // Converter para base64
    const base64 = optimizedBuffer.toString('base64');
    
    console.log(`[Image Parser] Imagem processada: ${base64.length} caracteres base64`);
    return base64;
    
  } catch (error) {
    console.error('Erro ao processar imagem:', error);
    throw new Error(`Erro ao processar imagem: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}


/**
 * Processa arquivo de imagem apenas
 */
export async function processFile(filePath: string, fileType: string): Promise<{ imageBase64: string }> {
  try {
    console.log(`[Image Parser] Processando imagem: ${fileType}`);
    
    if (fileType.startsWith('image/')) {
      // Process image directly
      const imageBase64 = await processImageToBase64(filePath);
      return { imageBase64 };
    } else {
      throw new Error('Tipo de arquivo não suportado. Use apenas PNG, JPG ou JPEG.');
    }
    
  } catch (error) {
    console.error('[Image Parser] Erro ao processar arquivo:', error);
    throw error;
  }
}

/**
 * Processa imagem de buffer (para imagens coladas da área de transferência)
 */
export async function processImageBuffer(imageBuffer: Buffer, fileType: string): Promise<{ imageBase64: string }> {
  try {
    console.log(`[Image Parser] Processando buffer de imagem: ${fileType}`);
    
    // Otimizar imagem para melhor OCR
    const optimizedBuffer = await sharp(imageBuffer)
      .resize(2000, 2000, { 
        fit: 'inside', 
        withoutEnlargement: true 
      })
      .png({ 
        quality: 90,
        progressive: true 
      })
      .toBuffer();
    
    // Converter para base64
    const base64 = optimizedBuffer.toString('base64');
    
    console.log(`[Image Parser] Buffer processado: ${base64.length} caracteres base64`);
    return { imageBase64: base64 };
    
  } catch (error) {
    console.error('Erro ao processar buffer de imagem:', error);
    throw new Error(`Erro ao processar imagem: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

/**
 * Valida se o arquivo é uma fatura válida baseado no conteúdo
 */
export function validateInvoiceContent(text: string): boolean {
  const invoiceKeywords = [
    'fatura',
    'cartão',
    'crédito',
    'vencimento',
    'pagamento',
    'compra',
    'valor',
    'total',
    'saldo',
    'limite'
  ];
  
  const lowercaseText = text.toLowerCase();
  const foundKeywords = invoiceKeywords.filter(keyword => 
    lowercaseText.includes(keyword)
  );
  
  // Deve conter pelo menos 3 palavras-chave relacionadas a fatura
  return foundKeywords.length >= 3;
}

/**
 * Limpa arquivos temporários
 */
export function cleanupTempFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[Cleanup] Arquivo temporário removido: ${filePath}`);
    }
  } catch (error) {
    console.error('Erro ao limpar arquivo temporário:', error);
  }
}