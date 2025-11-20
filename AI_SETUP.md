# 🤖 Configuração do Assistente Financeiro IA

## 📋 Pré-requisitos

1. **Conta OpenAI**: Crie uma conta em [platform.openai.com](https://platform.openai.com)
2. **API Key**: Gere uma chave API no dashboard da OpenAI
3. **Créditos**: Certifique-se de ter créditos suficientes na sua conta

## ⚙️ Configuração

### 1. Variável de Ambiente

Adicione sua chave API no arquivo `.env`:

```bash
OPENAI_API_KEY=sk-sua-chave-openai-aqui
```

### 2. Verificar Instalação

A dependência `openai` já está incluída no `package.json`. Se precisar reinstalar:

```bash
npm install openai
```

## 🚀 Como Usar

### 1. Acesso ao Chat

- Abra a **Dashboard**
- Clique no **botão flutuante** com ícone de mensagem (canto inferior direito)
- O chat abrirá em modal

### 2. Funcionalidades Disponíveis

**📊 Análises:**
- "Analise meus gastos deste mês"
- "Qual categoria consome mais dinheiro?"
- "Compare com o mês passado"

**💰 Consultas de Saldo:**
- "Como está meu saldo atual?"
- "Qual é minha previsão de saldo?"
- "Meu saldo está negativo?"

**💡 Sugestões:**
- "Dê dicas para economizar"
- "Como posso reduzir gastos?"
- "Posso comprar um carro de R$ 50.000?"

**📈 Planejamento:**
- "Crie um plano para economizar R$ 1.000/mês"
- "Quanto posso gastar com lazer?"

### 3. Contexto Automático

O assistente tem acesso aos seus dados:
- ✅ Saldos atuais e projetados
- ✅ Receitas e despesas do mês
- ✅ Categorias e gastos por categoria
- ✅ Transações recentes
- ✅ Cartões de crédito
- ✅ Contas bancárias

## 🛡️ Segurança e Limites

### Rate Limiting
- **10 mensagens por minuto** por conta
- Limite automático para evitar uso excessivo

### Validações
- **Máximo 500 caracteres** por mensagem
- Sanitização automática de entrada
- Verificação de conta válida

### Logs
- Todas as consultas são logadas para auditoria
- Mensagens são truncadas nos logs (50 caracteres)

## 🐛 Troubleshooting

### Chat não aparece
1. Verifique se `OPENAI_API_KEY` está configurada
2. Reinicie o servidor após configurar a variável
3. Verifique os logs do servidor para erros

### Erro "Serviço de IA não disponível"
- A chave API não está configurada ou é inválida
- Verifique se a chave começa com `sk-`

### Rate limit atingido
- Aguarde 1 minuto antes de tentar novamente
- O limite é de 10 mensagens por minuto

### Respostas de baixa qualidade
- Seja mais específico nas perguntas
- Use contexto financeiro (valores, períodos)
- Exemplo: "Analise meus gastos de dezembro" em vez de "Como estão meus gastos?"

## 📊 Custos Estimados

**Modelo**: GPT-4o-mini
**Custo médio por consulta**: ~$0.01 - $0.05 USD
**Tokens por contexto**: ~2000-3000 tokens
**Tokens por resposta**: ~500-1000 tokens

### Exemplo de Uso Mensal:
- **100 consultas/mês**: ~$3-5 USD
- **500 consultas/mês**: ~$15-25 USD

## 🔄 Manutenção

### Monitoramento
- Acompanhe o uso através do dashboard OpenAI
- Configure alertas de billing se necessário
- Monitore logs de erro no servidor

### Atualizações
- A OpenAI frequentemente melhora os modelos
- Mantenha a biblioteca `openai` atualizada
- Teste periodicamente as funcionalidades

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs do servidor
2. Confirme a configuração da API key
3. Teste com mensagens simples primeiro
4. Verifique se há saldo na conta OpenAI