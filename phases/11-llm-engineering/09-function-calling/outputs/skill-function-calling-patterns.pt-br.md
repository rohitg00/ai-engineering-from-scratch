---
name: skill-function-calling-patterns
description: Decision framework for implementing function calling in production -- tool design, error handling, security, and provider patterns
version: 1.0.0
phase: 11
lesson: 09
tags: [function-calling, tool-use, agents, mcp, security, openai, anthropic]
---
---
name: skill-function-calling-patterns
description: Decision framework for implementing function calling in production -- tool design, error handling, security, and provider patterns
version: 1.0.0
phase: 11
lesson: 09
tags: [function-calling, tool-use, agents, mcp, security, openai, anthropic]
---

# Padrões de chamada de função

Ao construir um aplicativo LLM que utiliza ferramentas, aplique esta estrutura de decisão.

## Quando usar chamada de função

**Use chamada de função quando:**
- O modelo precisa de dados em tempo real (clima, preços de ações, consultas ao banco de dados)
- A tarefa requer efeitos colaterais (envio de e-mails, criação de registros, implantação de código)
- O modelo deve escolher entre múltiplas ações com base na intenção do usuário
- Você está construindo um agente que interage com sistemas externos

**Use saídas estruturadas quando:**
- Você precisa de extração de dados de texto (sem necessidade de chamadas externas)
- A saída é o produto final, não uma etapa intermediária
- Você tem um único esquema, não várias ferramentas para escolher

**Use ambos quando:**
- O modelo chama uma ferramenta e depois estrutura o resultado da ferramenta em um formato de saída específico

## Diretrizes de design de ferramentas

1. **Uma ferramenta, uma ação.** Uma ferramenta chamada `manage_database` que lida com consultas, inserções, atualizações e exclusões é muito ampla. Dividido em `query_records`, `insert_record`, `update_record`. O modelo seleciona melhor com ferramentas específicas.

2. **As descrições são prompts.** O modelo lê as descrições das ferramentas para decidir a seleção. Escreva-os como escreveria instruções para um desenvolvedor júnior. Inclua o que a ferramenta retorna, não apenas o que ela faz.

3. **Restringir com enums.** Se um parâmetro tiver de 3 a 10 valores válidos, use um enum. O modelo irá inventar strings - "celsius", "Celsius", "C", "metric" - a menos que você o restrinja.

4. **Menos ferramentas é melhor.** O GPT-4o lida bem com 5 a 10 ferramentas. Com mais de 20 ferramentas, a precisão da seleção cai. Com mais de 50 ferramentas, espere 10-15% de seleção errada de ferramentas. Funcionalidade relacionada ao grupo ou use uma camada de roteamento.

5. **Requerido significa necessário.** Marque um parâmetro como necessário apenas se a ferramenta literalmente não puder funcionar sem ele. Parâmetros opcionais com bons padrões reduzem falhas de chamada de ferramenta.

## Padrões específicos do provedor

### OpenAI (GPT-4o, o3, GPT-4o-mini)

```python
tools=[{"type": "function", "function": {"name": ..., "parameters": ...}}]
tool_choice="auto"       # model decides
tool_choice="required"   # must call at least one tool
tool_choice={"type": "function", "function": {"name": "specific_tool"}}
```

- Suporta chamadas de ferramentas paralelas (vários `tool_calls` em uma resposta)
- IDs de chamada de ferramenta devem ser devolvidos com resultados
- `gpt-4o-mini` é 10x mais barato e lida bem com o roteamento simples de ferramentas
- O modo de saídas estruturadas funciona com parâmetros de ferramenta para garantir a conformidade do esquema

### Antrópico (Soneto de Claude 3.5, Claude 4 Opus)

```python
tools=[{"name": ..., "description": ..., "input_schema": ...}]
tool_choice={"type": "auto"}     # model decides
tool_choice={"type": "any"}      # must call at least one tool
tool_choice={"type": "tool", "name": "specific_tool"}
```

- As chamadas de ferramentas aparecem como blocos de conteúdo com `type: "tool_use"`
- Os resultados vão nas mensagens do usuário com `type: "tool_result"`
- O nome do campo é `input_schema`, não `parameters` (bug de migração comum)
- Suporta múltiplas chamadas de ferramentas por resposta

### Google (Gemini 2.0 Flash, Gemini 2.0 Pro)

```python
function_declarations=[{"name": ..., "description": ..., "parameters": ...}]
function_calling_config={"mode": "AUTO"}   # or "ANY" or "NONE"
```

- Usa `function_declarations` no nível superior
- Resultados retornados por meio de partes `function_response`
- Suporta chamada de função paralela

### Modelos de código aberto (Llama 3, Hermes, Qwen)

- Nenhum formato padronizado – varia de acordo com o modelo e estrutura de serviço
- O formato Hermes (NousResearch) é a convenção ajustada mais comum
- vLLM suporta chamada de ferramenta compatível com OpenAI para modelos suportados
- Ollama oferece suporte a chamadas de ferramentas básicas com modelos compatíveis
- Teste a precisão da seleção da ferramenta antes da produção - os modelos abertos são 15-30% menos precisos que o GPT-4o no Berkeley Function Calling Leaderboard

## Padrões de tratamento de erros

### Retorna erros estruturados

```json
{"error": true, "message": "City 'Toky' not found. Did you mean 'Tokyo'?", "code": "NOT_FOUND", "suggestions": ["Tokyo"]}
```

Inclua informações acionáveis. "Não encontrado" é ruim. "Não encontrado, você quis dizer X?" é bom. O modelo usa mensagens de erro para autocorreção.

### Estratégia de nova tentativa

1. A chamada da ferramenta falha com um erro corrigível (erro de digitação, valor enum incorreto)
2. Envie o erro de volta ao modelo como resultado da ferramenta
3. O modelo se ajusta e tenta novamente
4. Máximo de 3 tentativas por chamada de ferramenta
5. Após 3 falhas, retorne o erro ao usuário

### Tratamento de tempo limite

Defina tempos limite em todas as execuções de ferramentas. 30 segundos é um padrão razoável. Se o tempo limite de uma ferramenta expirar, retorne um erro de tempo limite estruturado para que o modelo possa informar o usuário em vez de travar.

## Lista de verificação de segurança

| Verifique | Por que | Como |
|-------|-----|-----|
| Funções da lista de permissões | Impedir a execução arbitrária de código | Cadastre apenas as ferramentas que o usuário necessita |
| Validar tipos de argumentos | Evitar ataques de confusão de tipos | Verifique os tipos antes da execução |
| Limpar argumentos de string | Evitar injeção | Rejeitar ou escapar de caracteres especiais |
| Parametrizar consultas ao banco de dados | Impedir injeção de SQL | Nunca transmita SQL gerado por modelo diretamente |
| Filtrar resultados da ferramenta | Evitar vazamento de dados | Remover chaves de API, PII, erros internos |
| Chamadas de ferramenta de limite de taxa | Evitar loops descontrolados | Máximo de 10 a 20 chamadas por conversa |
| Registrar todas as chamadas de ferramentas | Trilha de auditoria | Armazenar nome da ferramenta, argumentos, resultado, carimbo de data/hora |
| Travessia de caminho de bloco | Impedir o acesso ao sistema de arquivos | Rejeitar `..` e caminhos absolutos em ferramentas de arquivo |
| Execução de código sandbox | Impedir o acesso ao sistema | Use contêineres ou recursos internos restritos |
| Validar tamanho de retorno | Evitar preenchimento de contexto | Truncar resultados acima de 10 KB |

## Otimização de desempenho

- **Chamadas paralelas:** Quando o modelo solicitar múltiplas ferramentas independentes, execute-as simultaneamente com `asyncio.gather()` ou `concurrent.futures`
- **Cache:** Resultados da ferramenta de cache para argumentos idênticos na mesma sessão (o clima não muda em 60 segundos)
- **Streaming:** Transmita a resposta final do modelo enquanto os resultados da ferramenta estão sendo buscados
- **Remoção de ferramentas:** se o contexto for restrito, inclua apenas definições de ferramentas relevantes para a consulta atual (use um classificador para filtrar)
- **Modelos menores para roteamento:** Use `gpt-4o-mini` ou `claude-3-5-haiku` para seleção de ferramentas e, em seguida, passe os resultados para um modelo mais forte para síntese

## Padrões de falha comuns

| Falha | Causa | Correção |
|--------|-------|-----|
| Ferramenta errada selecionada | Descrições ambíguas | Reescrever descrições com palavras-gatilho específicas |
| Argumentos obrigatórios ausentes | Modelo esqueceu um parâmetro | Adicione exemplos claros nas descrições dos parâmetros |
| Loop infinito de ferramentas | Modelo continua chamando a mesma ferramenta | Defina o máximo de iterações (5-10) e detecte chamadas repetidas |
| Argumentos alucinados | Modelo inventa valores plausíveis, mas errados | Use enums, valide em relação a valores conhecidos |
| Resultado da ferramenta muito grande | API retornou 100 KB de dados | Truncar ou resumir antes de dar feedback |
| Modelo ignora resultado da ferramenta | Formato do resultado confuso | Retornar JSON limpo com nomes de campo claros |