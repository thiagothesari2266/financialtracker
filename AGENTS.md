## COMPORTAMENTO
- PT-BR sempre, técnico e direto
- **PASSO A PASSO**: Uma instrução por vez; confirmar apenas ações que alteram estado (install, deploy, kill, escrita). Consultas e diagnósticos read-only podem seguir direto, informando antes o comando.
- **LIMPEZA PROATIVA**: Remover logs temporários automaticamente
- **SEM EMOJIS**: Nunca usar exceto quando solicitado
- **UTF-8 SEMPRE**: Salvar arquivos utilizando codificação UTF-8 (sem BOM)
- **TIMEOUT COMANDOS**: Interromper comandos interativos após 2 minutos (ex.: `npm run dev`).

## REGRAS CRÍTICAS

### OVER-ENGINEERING - SEMPRE questionar complexidade
- **KISS**: Solução mais simples que funciona
- **YAGNI**: Não implementar "pode ser útil"
- **Regra de Ouro**: "Se não tem 3 casos reais HOJE, não abstraia"

### TROUBLESHOOTING
- **INVESTIGAR causa raiz primeiro** (não soluções paliativas)
- **AGUARDAR comandos** (`npm install` pode demorar 10+ min)
- **COMPREENDER erros** (não pular diagnóstico)

## Comandos usados
Build - npm run build
