import OpenAI from 'openai';

// Configuração do cliente OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ExtractedTransaction {
  date: string;
  description: string;
  amount: number;
  category?: string;
  installments?: number;
  currentInstallment?: number;
}

export interface InvoiceAnalysisResult {
  transactions: ExtractedTransaction[];
  invoiceMonth: string;
  totalAmount: number;
  cardName?: string;
  dueDate?: string;
  confidence: number;
}

/**
 * Analisa texto extraído de fatura usando GPT-4
 */
export async function analyzeInvoiceText(text: string): Promise<InvoiceAnalysisResult> {
  const prompt = `
Você é um especialista em análise de faturas de cartão de crédito. Analise o texto abaixo e extraia as informações em formato JSON estruturado.

INSTRUÇÕES:
1. Extraia TODAS as transações/compras encontradas
2. Para cada transação, identifique: data, descrição, valor
3. Se for parcelado, identifique o número de parcelas
4. Sugira uma categoria baseada na descrição
5. Identifique o mês/ano da fatura e valor total
6. Retorne um JSON válido no formato especificado

CATEGORIAS SUGERIDAS:
- Alimentação (restaurantes, delivery, supermercado)
- Transporte (combustível, uber, transporte público)
- Saúde (farmácia, consultas, exames)
- Educação (cursos, livros, material escolar)
- Lazer (cinema, streaming, jogos)
- Vestuário (roupas, calçados, acessórios)
- Casa (móveis, decoração, limpeza)
- Tecnologia (eletrônicos, software, apps)
- Serviços (internet, telefone, seguros)
- Outros

FORMATO DE RESPOSTA (JSON):
{
  "transactions": [
    {
      "date": "2024-01-15",
      "description": "SUPERMERCADO ABC",
      "amount": 123.45,
      "category": "Alimentação",
      "installments": 1,
      "currentInstallment": 1
    }
  ],
  "invoiceMonth": "2024-01",
  "totalAmount": 1234.56,
  "cardName": "Nome do Cartão",
  "dueDate": "2024-02-10",
  "confidence": 0.95
}

TEXTO DA FATURA:
${text}

Retorne APENAS o JSON, sem explicações adicionais:`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Você é um assistente especializado em análise de faturas de cartão de crédito. Sempre responda com JSON válido."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1, // Baixa criatividade para maior precisão
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Resposta vazia da API OpenAI');
    }

    // Tentar fazer parse do JSON
    try {
      const result = JSON.parse(content);
      
      // Validar estrutura básica
      if (!result.transactions || !Array.isArray(result.transactions)) {
        throw new Error('Formato de resposta inválido: transactions não encontrado');
      }

      // Validar cada transação
      result.transactions = result.transactions.filter((t: any) => 
        t.date && t.description && typeof t.amount === 'number' && t.amount > 0
      );

      return {
        transactions: result.transactions,
        invoiceMonth: result.invoiceMonth || '',
        totalAmount: result.totalAmount || 0,
        cardName: result.cardName || '',
        dueDate: result.dueDate || '',
        confidence: result.confidence || 0.8
      };

    } catch (parseError) {
      console.error('Erro ao fazer parse da resposta JSON:', parseError);
      console.error('Conteúdo recebido:', content);
      throw new Error('Resposta da IA não está em formato JSON válido');
    }

  } catch (error) {
    console.error('Erro na API OpenAI:', error);
    throw new Error(`Erro ao processar fatura com IA: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

/**
 * Analisa imagem de fatura usando GPT-4 Vision
 */
export async function analyzeInvoiceImage(imageBase64: string): Promise<InvoiceAnalysisResult> {
  const prompt = `
Analise esta imagem de fatura de cartão de crédito e extraia TODAS as transações em formato JSON.

INSTRUÇÕES IMPORTANTES:
1. Extraia TODAS as transações/compras encontradas na imagem
2. Para cada transação, identifique: data, descrição, valor
3. Se for parcelado, identifique o número de parcelas
4. Sugira uma categoria baseada na descrição
5. Identifique o mês/ano da fatura e valor total
6. Retorne APENAS o JSON válido no formato especificado
7. NÃO adicione texto explicativo antes ou depois do JSON

CATEGORIAS DISPONÍVEIS (use EXATAMENTE estes nomes):
- Alimentação: supermercados, restaurantes, delivery, lanchonetes, padarias, açougues, hortifruti, bebidas
- Transporte: postos de gasolina, uber, taxi, ônibus, metrô, estacionamento, pedágios, mecânica, manutenção
- Saúde: farmácias, hospitais, clínicas, laboratórios, dentistas, medicamentos, planos de saúde
- Lazer: cinema, teatro, streaming (Netflix, Spotify), jogos, viagens, hotéis, eventos, shows
- Educação: escolas, cursos, livros, material escolar, universidades, idiomas
- Casa: móveis, decoração, utensílios, limpeza, manutenção, reforma, jardinagem
- Tecnologia: eletrônicos, informática, celulares, apps, software, internet
- Escritório: materiais de escritório, equipamentos, móveis corporativos
- Marketing: publicidade, propaganda, mídia social, design
- Fornecedores: matéria-prima, insumos, terceirizados
- Outros: qualquer coisa que não se encaixe nas categorias acima

REGRAS IMPORTANTES:
1. Use APENAS os nomes exatos das categorias listadas acima
2. Analise cuidadosamente o nome do estabelecimento para identificar a categoria correta
3. Se não tiver certeza, use "Outros"
4. Considere o contexto brasileiro (ex: Extra, Carrefour = Alimentação; Shell, Ipiranga = Transporte)

FORMATO DE RESPOSTA (JSON):
{
  "transactions": [
    {
      "date": "2024-01-15",
      "description": "SUPERMERCADO ABC",
      "amount": 123.45,
      "category": "Alimentação",
      "installments": 1,
      "currentInstallment": 1
    }
  ],
  "invoiceMonth": "2024-01",
  "totalAmount": 1234.56,
  "cardName": "Nome do Cartão",
  "dueDate": "2024-02-10",
  "confidence": 0.95
}

Analise a imagem e retorne APENAS o JSON:`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Você é um assistente especializado em análise de faturas de cartão de crédito. IMPORTANTE: Responda APENAS com JSON válido, sem texto adicional, sem explicações, sem introdução, sem conclusão. Somente JSON."
        },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Resposta vazia da API OpenAI Vision');
    }

    try {
      // Try to extract JSON from the response with multiple strategies
      let jsonContent = content.trim();
      let result;
      
      console.log('[OpenAI Vision] Conteúdo recebido da API:', content.substring(0, 300) + '...');
      console.log('[OpenAI Vision] Verificando se é recusa da OpenAI...');
      
      // Check if OpenAI refused to process the image
      const contentLower = content.toLowerCase();
      if (contentLower.includes("i'm sorry") || contentLower.includes("i can't assist") || contentLower.includes("cannot assist")) {
        console.log('[OpenAI Vision] Detectada recusa da OpenAI');
        throw new Error('OpenAI não conseguiu processar a imagem. Verifique se é uma fatura válida de cartão de crédito.');
      }
      
      console.log('[OpenAI Vision] Não é recusa, tentando fazer parsing...');
      
      // Strategy 1: Try parsing the content directly
      try {
        result = JSON.parse(jsonContent);
        console.log('[OpenAI Vision] Strategy 1 (direct) funcionou');
      } catch (e) {
        console.log('[OpenAI Vision] Strategy 1 (direct) falhou, tentando strategy 2');
        
        // Strategy 2: Look for JSON content between curly braces
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonContent = jsonMatch[0];
          try {
            result = JSON.parse(jsonContent);
            console.log('[OpenAI Vision] Strategy 2 (regex) funcionou');
          } catch (e2) {
            console.log('[OpenAI Vision] Strategy 2 (regex) falhou, tentando strategy 3');
            
            // Strategy 3: Try to find JSON between ```json blocks
            const codeBlockMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
            if (codeBlockMatch) {
              jsonContent = codeBlockMatch[1];
              result = JSON.parse(jsonContent);
              console.log('[OpenAI Vision] Strategy 3 (code block) funcionou');
            } else {
              throw e2;
            }
          }
        } else {
          throw e;
        }
      }
      
      console.log('[OpenAI Vision] JSON extraído com sucesso:', JSON.stringify(result, null, 2).substring(0, 200) + '...');
      
      if (!result.transactions || !Array.isArray(result.transactions)) {
        throw new Error('Formato de resposta inválido: transactions não encontrado');
      }

      result.transactions = result.transactions.filter((t: any) => 
        t.date && t.description && typeof t.amount === 'number' && t.amount > 0
      );

      console.log(`[OpenAI Vision] ${result.transactions.length} transações extraídas com sucesso`);

      return {
        transactions: result.transactions,
        invoiceMonth: result.invoiceMonth || '',
        totalAmount: result.totalAmount || 0,
        cardName: result.cardName || '',
        dueDate: result.dueDate || '',
        confidence: result.confidence || 0.8
      };

    } catch (parseError) {
      console.error('Erro ao fazer parse da resposta JSON Vision:', parseError);
      console.error('Conteúdo completo recebido:', content);
      
      // Try to provide more helpful error information
      const hasOpenBrace = content.includes('{');
      const hasCloseBrace = content.includes('}');
      
      if (!hasOpenBrace || !hasCloseBrace) {
        throw new Error('Resposta não contém JSON válido (chaves não encontradas)');
      }
      
      throw new Error('Resposta da IA Vision não está em formato JSON válido');
    }

  } catch (error) {
    console.error('Erro na API OpenAI Vision:', error);
    throw new Error(`Erro ao processar imagem com IA: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

/**
 * Analisa múltiplas imagens de fatura usando GPT-4o Vision
 */
export async function analyzeMultipleInvoiceImages(imagesBase64: string[]): Promise<InvoiceAnalysisResult> {
  const prompt = `
Analise estas ${imagesBase64.length} imagens de fatura de cartão de crédito e extraia TODAS as informações em formato JSON.

INSTRUÇÕES IMPORTANTES:
1. Estas imagens fazem parte da MESMA fatura (podem ser páginas diferentes)
2. Combine as informações de todas as imagens em um único resultado
3. Extraia TODAS as transações/compras encontradas em todas as imagens
4. Evite duplicações - se a mesma transação aparecer em várias imagens, inclua apenas uma vez
5. Para cada transação, identifique: data, descrição, valor
6. Se for parcelado, identifique o número de parcelas
7. Sugira uma categoria baseada na descrição
8. Identifique o mês/ano da fatura e valor total
9. Retorne um JSON válido no formato especificado

CATEGORIAS DISPONÍVEIS (use EXATAMENTE estes nomes):
- Alimentação: supermercados, restaurantes, delivery, lanchonetes, padarias, açougues, hortifruti, bebidas
- Transporte: postos de gasolina, uber, taxi, ônibus, metrô, estacionamento, pedágios, mecânica, manutenção
- Saúde: farmácias, hospitais, clínicas, laboratórios, dentistas, medicamentos, planos de saúde
- Lazer: cinema, teatro, streaming (Netflix, Spotify), jogos, viagens, hotéis, eventos, shows
- Educação: escolas, cursos, livros, material escolar, universidades, idiomas
- Casa: móveis, decoração, utensílios, limpeza, manutenção, reforma, jardinagem
- Tecnologia: eletrônicos, informática, celulares, apps, software, internet
- Escritório: materiais de escritório, equipamentos, móveis corporativos
- Marketing: publicidade, propaganda, mídia social, design
- Fornecedores: matéria-prima, insumos, terceirizados
- Outros: qualquer coisa que não se encaixe nas categorias acima

REGRAS IMPORTANTES:
1. Use APENAS os nomes exatos das categorias listadas acima
2. Analise cuidadosamente o nome do estabelecimento para identificar a categoria correta
3. Se não tiver certeza, use "Outros"
4. Considere o contexto brasileiro (ex: Extra, Carrefour = Alimentação; Shell, Ipiranga = Transporte)

FORMATO DE RESPOSTA (JSON):
{
  "transactions": [
    {
      "date": "2024-01-15",
      "description": "SUPERMERCADO ABC",
      "amount": 123.45,
      "category": "Alimentação",
      "installments": 1,
      "currentInstallment": 1
    }
  ],
  "invoiceMonth": "2024-01",
  "totalAmount": 1234.56,
  "cardName": "Nome do Cartão",
  "dueDate": "2024-02-10",
  "confidence": 0.95
}

Analise todas as imagens e retorne APENAS o JSON, sem explicações adicionais:`;

  try {
    // Construir array de conteúdo com todas as imagens
    const content: any[] = [
      { type: "text", text: prompt }
    ];

    // Adicionar cada imagem ao conteúdo
    imagesBase64.forEach((imageBase64, index) => {
      content.push({
        type: "image_url",
        image_url: {
          url: `data:image/png;base64,${imageBase64}`,
          detail: "high"
        }
      });
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Você é um assistente especializado em análise de faturas de cartão de crédito. Sempre responda com JSON válido."
        },
        {
          role: "user",
          content: content
        }
      ],
      temperature: 0.1,
      max_tokens: 4000,
    });

    const responseContent = response.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('Resposta vazia da API OpenAI Vision para múltiplas imagens');
    }

    // Check if OpenAI refused to process the images
    if (responseContent.toLowerCase().includes("i'm sorry") || responseContent.toLowerCase().includes("i can't assist") || responseContent.toLowerCase().includes("cannot assist")) {
      throw new Error('OpenAI não conseguiu processar as imagens. Verifique se são faturas válidas de cartão de crédito.');
    }

    try {
      const result = JSON.parse(responseContent);
      
      if (!result.transactions || !Array.isArray(result.transactions)) {
        throw new Error('Formato de resposta inválido: transactions não encontrado');
      }

      result.transactions = result.transactions.filter((t: any) => 
        t.date && t.description && typeof t.amount === 'number' && t.amount > 0
      );

      return {
        transactions: result.transactions,
        invoiceMonth: result.invoiceMonth || '',
        totalAmount: result.totalAmount || 0,
        cardName: result.cardName || '',
        dueDate: result.dueDate || '',
        confidence: result.confidence || 0.8
      };

    } catch (parseError) {
      console.error('Erro ao fazer parse da resposta JSON múltiplas imagens:', parseError);
      console.error('Conteúdo recebido:', responseContent);
      throw new Error('Resposta da IA para múltiplas imagens não está em formato JSON válido');
    }

  } catch (error) {
    console.error('Erro na API OpenAI Vision múltiplas imagens:', error);
    throw new Error(`Erro ao processar múltiplas imagens com IA: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

/**
 * Sugere categoria baseada na descrição da transação
 */
export async function suggestCategory(description: string, existingCategories: string[]): Promise<string> {
  const prompt = `
Baseado na descrição da transação: "${description}"
E nas categorias existentes: ${existingCategories.join(', ')}

Sugira a categoria mais apropriada. Se nenhuma das existentes for adequada, sugira uma nova categoria.
Responda apenas com o nome da categoria, sem explicações.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "Você é um assistente que sugere categorias para transações financeiras."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 50,
    });

    return response.choices[0]?.message?.content?.trim() || 'Outros';

  } catch (error) {
    console.error('Erro ao sugerir categoria:', error);
    return 'Outros';
  }
}