# Function Calling em Profundidade — OpenAI, Anthropic, Gemini

> Os três provedores frontier convergiram no mesmo loop de chamada de ferramenta em 2024 e depois divergiram em tudo o mais. O OpenAI usa `tools` e `tool_calls`. O Anthropic usa blocos `tool_use` e `tool_result`. O Gemini usa `functionDeclarations` e correlação por id único. Esta aula compara os três lado a lado pra que código que roda num provedor não quebre quando você portar ele.

**Tipo:** Construir
**Linguagens:** Python (stdlib, tradutores de schema)
**Pré-requisitos:** Fase 13 · 01 (a interface de ferramentas)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Apontar as três diferenças de forma nos payloads de function calling entre OpenAI, Anthropic e Gemini (declaração, chamada, resultado).
- Traduzir uma declaração de ferramenta nos três formatos de provedor e prever onde as restrições do modo strict vão diferir.
- Usar `tool_choice` em cada provedor pra forçar, proibir ou escolher automaticamente chamadas de ferramenta.
- Conhecer os limites rígidos por provedor (quantidade de ferramentas, profundidade do schema, tamanho dos argumentos) e as assinaturas de erro que cada um emite quando esses limites são violados.

## O Problema

A forma de um request de function calling varia por provedor. Três exemplos concretos de stacks de produção em 2026:

**OpenAI Chat Completions / Responses API.** Você passa `tools: [{type: "function", function: {name, description, parameters, strict}}]`. A resposta do modelo contém `choices[0].message.tool_calls: [{id, type: "function", function: {name, arguments}}]` onde `arguments` é uma string JSON que você precisa fazer parse. Modo strict (`strict: true`) aplica conformidade com o schema via decoding restrito.

**Anthropic Messages API.** Você passa `tools: [{name, description, input_schema}]`. A resposta volta como `content: [{type: "text"}, {type: "tool_use", id, name, input}]`. `input` já é parseado (um objeto, não uma string). Você responde com uma nova mensagem `user` contendo um bloco `{type: "tool_result", tool_use_id, content}`.

**Google Gemini API.** Você passa `tools: [{functionDeclarations: [{name, description, parameters}]}]` (aninhado sob `functionDeclarations`). A resposta chega como `candidates[0].content.parts: [{functionCall: {name, args, id}}]` onde `id` é único no Gemini 3 e acima pra correlação de chamadas paralelas. Você responde com `{functionResponse: {name, id, response}}`.

Mesmo loop. Nomes de campos diferentes, aninhamento diferente, convenções de string vs. objeto diferentes, mecanismos de correlação diferentes. Uma equipe que escreve um agente de clima no OpenAI gasta dois dias portando pro Anthropic e mais um dia pro Gemini só pra infraestrutura.

Esta aula constrói um tradutor que unifica os três formatos em uma declaração canônica de ferramenta e roteia na borda. Fase 13 · 17 generaliza esse mesmo padrão num gateway de LLM.

## O Conceito

### A estrutura comum

Todo provedor precisa de cinco coisas:

1. **Lista de ferramentas.** Nome, descrição e schema de entrada por ferramenta.
2. **Escolha de ferramenta.** Forçar uma ferramenta eespecificaçãoífica, proibir ferramentas ou deixar o modelo decidir.
3. **Emissão da chamada.** Saída estruturada nomeando a ferramenta e os argumentos.
4. **Id da chamada.** Correlacionar a resposta com a chamada correta (importa pra paralelo).
5. **Injeção do resultado.** Uma mensagem ou bloco que liga o resultado de volta à chamada.

### Diferenças de forma, campo por campo

| Aespecificaçãoto | OpenAI | Anthropic | Gemini |
|---------|--------|-----------|--------|
| Envelope da declaração | `{type: "function", function: {...}}` | `{name, description, input_schema}` | `{functionDeclarations: [{...}]}` |
| Campo do schema | `parameters` | `input_schema` | `parameters` |
| Container da resposta | `tool_calls[]` na mensagem do assistant | `content[]` do tipo `tool_use` | `parts[]` do tipo `functionCall` |
| Tipo dos argumentos | JSON stringificado | Objeto parseado | Objeto parseado |
| Formato do id | `call_...` (OpenAI gera) | `toolu_...` (Anthropic) | UUID (Gemini 3+) |
| Bloco do resultado | role `tool`, `tool_call_id` | `user` com `tool_result`, `tool_use_id` | `functionResponse` com `id` correspondente |
| Forçar uma ferramenta | `tool_choice: {type: "function", function: {name}}` | `tool_choice: {type: "tool", name}` | `tool_config: {function_calling_config: {mode: "ANY"}}` |
| Proibir ferramentas | `tool_choice: "none"` | `tool_choice: {type: "none"}` | `mode: "NONE"` |
| Schema strict | `strict: true` | schema é schema (sempre aplicado) | `responseSchema` no nível do request |

### Limites que você vai atingir de verdade

- **OpenAI.** 128 ferramentas por request. Profundidade de schema 5. String de argumento <= 8192 bytes. Modo strict não aceita `$ref`, não aceita `oneOf`/`anyOf`/`allOf` com sobreposição, e toda propriedade precisa estar em `required`.
- **Anthropic.** 64 ferramentas por request. Profundidade de schema efetivamente ilimitada mas limite prático de 10. Sem flag de modo strict; o schema é um contrato e o modelo tende a cumprir.
- **Gemini.** 64 funções por request. Tipos do schema são subconjunto do OpenAPI 3.0 (leve divergência do JSON Schema 2020-12). Chamadas paralelas com id único desde o Gemini 3.

### Comportamento de `tool_choice`

Três modos que todos suportam, nomeados diferente.

- **Auto.** Modelo escolhe ferramenta ou texto. Padrão.
- **Required / Any.** Modelo precisa chamar pelo menos uma ferramenta.
- **None.** Modelo não pode chamar ferramentas.

Mais um modo único de cada provedor:

- **OpenAI.** Forçar uma ferramenta eespecificaçãoífica por nome.
- **Anthropic.** Forçar uma ferramenta eespecificaçãoífica por nome; a flag `disable_parallel_tool_use` separa single vs. multi.
- **Gemini.** `mode: "VALIDATED"` roda toda resposta por um validador de schema independente da intenção do modelo.

### Chamadas paralelas

O `parallel_tool_calls: true` da OpenAI (padrão) emite múltiplas chamadas numa mensagem do assistant. Você roda todas e responde com uma mensagem em lote de role ferramenta com uma entrada por `tool_call_id`. Anthropic historicamente fazia chamada única; `disable_parallel_tool_use: false` (padrão desde Claude 3.5) habilita multi. Gemini 2 permitia chamadas paralelas mas não dava ids estáveis; Gemini 3 adiciona UUIDs pra que respostas fora de ordem sejam correlacionadas limpo.

### Streaming

Os três suportam chamadas de ferramenta com streaming. O formato na rede difere:

- **OpenAI.** Chunks delta de `tool_calls[i].function.arguments` chegam incrementalmente. Você acumula até `finish_reason: "tool_calls"`.
- **Anthropic.** Eventos block-start / block-delta / block-stop. Chunks `input_json_delta` carregam argumentos parciais.
- **Gemini.** `streamFunctionCallArguments` (novo no Gemini 3) emite chunks com um `functionCallId` pra que múltiplas chamadas paralelas possam se entrelaçar.

Fase 13 · 03 aprofunda em reassembly de paralelo + streaming. Esta aula foca nas formas de declaração e chamada única.

### Erros e reparo

Erros de argumento inválido também parecem diferentes.

- **OpenAI (não strict).** Modelo retorna `arguments: "{\"bad json\"}`, seu parse de JSON falha, você injeta uma mensagem de erro e chama de novo.
- **OpenAI (strict).** Validação acontece durante o decoding; JSON inválido é impossível mas `refusal` pode aparecer.
- **Anthropic.** `input` pode conter campos inesperados; schema é apenas orientação. Valide do lado do servidor.
- **Gemini.** Peculiaridade do OpenAPI 3.0: `enum` em campos de objeto é silenciosamente ignorado; valide por conta própria.

### O padrão de tradutor

Uma declaração canônica de ferramenta no seu código se parece com isso (você escolhe a forma):

```python
Tool(
    name="get_weather",
    description="Use when ...",
    input_schema={"type": "object", "properties": {...}, "required": [...]},
    strict=True,
)
```

Três funções pequenas traduzem pra três formas de provedor. O harness em `code/main.py` faz exatamente isso, depois faz o round-trip de uma chamada de ferramenta falsa através da forma de resposta de cada provedor. Sem necessidade de rede — esta aula ensina as formas, não o HTTP.

Equipes de produção embrulham esse tradutor em `AbstractToolset` (Pydantic AI), `UniversalToolNode` (LangGraph) ou `BaseTool` (LlamaIndex). Fase 13 · 17 entrega um gateway que expõe uma API no estilo OpenAI na frente de qualquer um dos três.

## Use

`code/main.py` define um `Tool` dataclass canônico e três tradutores que emitem o JSON de declaração do OpenAI, Anthropic e Gemini. Depois faz o parse de uma resposta de provedor feita à mão de cada forma no mesmo objeto canônico de chamada, demonstrando que as semânticas são idênticas por baixo. Rode e compare as três declarações lado a lado.

O que conferir:

- Os três blocos de declaração diferem apenas no envelope e nos nomes dos campos.
- Os três blocos de resposta diferem no lugar onde a chamada vive (`tool_calls` no nível superior, bloco em `content[]`, entrada em `parts[]`).
- Uma função `canonical_call()` extrai `{id, name, args}` das três formas de resposta.

## Entregue

Esta aula produz `outputs/skill-provider-portability-audit.md`. Dada uma integração de function calling contra um provedor, a skill produz uma auditoria de portabilidade: quais limites de provedor ela depende, quais campos precisam ser renomeados, e o que quebra quando portado pra cada outro provedor.

## Exercícios

1. Rode `code/main.py` e verifique que os três JSONs de declaração de provedor serializam o mesmo objeto `Tool` subjacente. Modifique a ferramenta canônica pra adicionar um parâmetro enum e confirme que só o tradutor do Gemini precisa lidar com a peculiaridade do OpenAPI.

2. Adicione um parser `ListToolsResponse` pra cada provedor que extrai a lista de ferramentas que o modelo retorna após uma chamada `list_tools` ou de descoberta. OpenAI não tem uma nativamente; anote essa assimetria.

3. Implemente a conversão de `tool_choice`: mapeie um `ToolChoice(mode="force", tool_name="x")` canônico nas três formas de provedor. Depois mapeie `mode="any"` e `mode="none"`. Consulte a tabela de diferenças da aula.

4. Escolha um dos três provedores e leia seu guia de function calling de ponta a ponta. Encontre um campo na eespecificaçãoificação do schema que os outros dois não suportam. Candidatos: `strict` da OpenAI, `disable_parallel_tool_use` do Anthropic, `function_calling_config.allowed_function_names` do Gemini.

5. Escreva um vetor de teste: uma chamada de ferramenta cujos argumentos violam o schema declarado. Execute pelo validador de cada provedor (o da stdlib da Aula 01 serve como proxy) e registre quais erros disparam. Documente qual provedor você usaria em produção pra rigor.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Function calling | "Uso de ferramentas" | API de nível de provedor pra emissão estruturada de chamadas de ferramenta |
| Declaração de ferramenta | "Eespecificaçãoificação da ferramenta" | Nome + descrição + payload de entrada JSON Schema |
| `tool_choice` | "Forçar / proibir" | Modos auto / required / none / nome eespecificaçãoífico |
| Modo strict | "Aplicação de schema" | Flag da OpenAI que restringe decoding pra corresponder ao schema |
| Bloco `tool_use` | "Forma de chamada do Anthropic" | Bloco de conteúdo inline com id, name, input |
| Part `functionCall` | "Forma de chamada do Gemini" | Uma entrada em `parts[]` contendo name, args e id |
| Arguments-as-string | "JSON stringificado" | OpenAI retorna args como string JSON, não como objeto |
| Parallel ferramenta calls | "Fan-out num turno" | Múltiplas chamadas de ferramenta numa mensagem do assistant |
| Refusal | "Modelo se recusa" | Bloco de recusa exclusivo do modo strict em vez de uma chamada |
| Subconjunto OpenAPI 3.0 | "Peculiaridade do schema do Gemini" | Gemini usa um dialeto similar a JSON Schema com pequenas diferenças |

## Leituras Complementares

- [OpenAI — Function calling guide](https://platform.openai.com/docs/guides/function-calling) — referência canônica incluindo modo strict e chamadas paralelas
- [Anthropic — Tool use overview](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview) — semântica de blocos `tool_use` e `tool_result`
- [Google — Gemini function calling](https://ai.google.dev/gemini-api/docs/function-calling) — chamadas paralelas, ids únicos e subconjunto OpenAPI
- [Vertex AI — Function calling reference](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/function-calling) — superfície empresarial do Gemini
- [OpenAI — Structured outputs](https://platform.openai.com/docs/guides/structured-outputs) — detalhes de aplicação de schema em modo strict
