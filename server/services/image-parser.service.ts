import fs from 'fs';
import sharp from 'sharp';
import logger from '../lib/logger';

/**
 * Image processing for Vision API
 */

/**
 * Processa imagem e converte para base64
 */
export async function processImageToBase64(filePath: string): Promise<string> {
  try {
    logger.debug({ filePath }, 'Image Parser: processando imagem');

    // Para imagens, usar Sharp para otimização
    const optimizedBuffer = await sharp(filePath)
      .resize(2000, 2000, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png({
        quality: 90,
        progressive: true,
      })
      .toBuffer();

    // Converter para base64
    const base64 = optimizedBuffer.toString('base64');

    logger.debug({ base64Length: base64.length }, 'Image Parser: imagem processada');
    return base64;
  } catch (error) {
    logger.error({ err: error }, 'Erro ao processar imagem');
    throw new Error(
      `Erro ao processar imagem: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    );
  }
}

/**
 * Processa arquivo de imagem apenas
 */
export async function processFile(
  filePath: string,
  fileType: string
): Promise<{ imageBase64: string }> {
  try {
    logger.debug({ fileType }, 'Image Parser: processando arquivo');

    if (fileType.startsWith('image/')) {
      // Process image directly
      const imageBase64 = await processImageToBase64(filePath);
      return { imageBase64 };
    } else {
      throw new Error('Tipo de arquivo não suportado. Use apenas PNG, JPG ou JPEG.');
    }
  } catch (error) {
    logger.error({ err: error }, 'Image Parser: erro ao processar arquivo');
    throw error;
  }
}

/**
 * Processa imagem de buffer (para imagens coladas da área de transferência)
 */
export async function processImageBuffer(
  imageBuffer: Buffer,
  fileType: string
): Promise<{ imageBase64: string }> {
  try {
    logger.debug({ fileType }, 'Image Parser: processando buffer de imagem');

    // Otimizar imagem para melhor OCR
    const optimizedBuffer = await sharp(imageBuffer)
      .resize(2000, 2000, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png({
        quality: 90,
        progressive: true,
      })
      .toBuffer();

    // Converter para base64
    const base64 = optimizedBuffer.toString('base64');

    logger.debug({ base64Length: base64.length }, 'Image Parser: buffer processado');
    return { imageBase64: base64 };
  } catch (error) {
    logger.error({ err: error }, 'Erro ao processar buffer de imagem');
    throw new Error(
      `Erro ao processar imagem: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    );
  }
}

/**
 * Limpa arquivos temporários
 */
export function cleanupTempFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.debug({ filePath }, 'Arquivo temporário removido');
    }
  } catch (error) {
    logger.error({ err: error }, 'Erro ao limpar arquivo temporário');
  }
}
