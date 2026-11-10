# Função chamada Deep Dive  OpenAI, Antropic, Gemini

> Os três provedores de fronteira convergiram no mesmo ciclo de chamada de ferramentas em 2024 e depois divergiram em tudo o resto.`tools`E ...`tool_calls`Utilizações antropológicas`tool_use`E ...`tool_result`Os Gémeos usam...`functionDeclarations`Esta lição diferencia os três lado a lado para que o código que é enviado em um provedor não quebre quando você o porta.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, schema translators)
**Prerequisites:** Phase 13 · 01 (the tool interface)
**Time:** ~75 minutes

## Objetivos de aprendizagem

- Explique as três diferenças de forma entre as cargas úteis que chamam a função OpenAI, Anthropic e Gemini (declaração, chamada, resultado).
- Traduzir uma declaração de ferramenta para todos os três formatos do fornecedor e prever onde as restrições de modo rigoroso diferirão.
- Utilização`tool_choice`em cada fornecedor para forçar, proibir ou escolher automaticamente as chamadas de ferramentas.
- Conheça os limites de duração por fornecedor (contação de ferramentas, profundidade de esquema, comprimento de argumento) e as assinaturas de erro emitidas quando os limites são violados.

## O problema

A forma de uma solicitação de chamada de função difere de um prestador para outro.

**OpenAI Chat Completions / Responses API.**Passas .`tools: [{type: "function", function: {name, description, parameters, strict}}]`A resposta do modelo contém `choices[0].message.tool_calls: [{id, type: "function", function: {name, arguments}}]`onde`arguments`é uma cadeia JSON que você deve analisar.`strict: true`) impõe a conformidade com o esquema através de decodificação restrita.

**Anthropic Messages API.**Passas .`tools: [{name, description, input_schema}]`A resposta é:`content: [{type: "text"}, {type: "tool_use", id, name, input}]`- Não .`input`já foi analisado (um objeto, não uma cadeia).`user`mensagem contendo um `{type: "tool_result", tool_use_id, content}`Bloco.

**Google Gemini API.**Passas .`tools: [{functionDeclarations: [{name, description, parameters}]}]`(nesteado sob `functionDeclarations`A resposta é:`candidates[0].content.parts: [{functionCall: {name, args, id}}]`onde`id`É único em Gemini 3 e acima para correlação de chamadas paralelas.`{functionResponse: {name, id, response}}`- Não .

O mesmo ciclo. nomes de campos diferentes, nidificação diferente, convenções diferentes de cadeia contra objeto, diferentes mecanismos de correlação. Uma equipe que escreve um agente meteorológico na OpenAI paga um porto de dois dias para Anthropic e outro dia para Gemini apenas pela instalação de encanamento.

Esta lição constrói um tradutor que unifica os três formatos em uma declaração canônica de ferramenta e rotas na borda.

## O conceito

### A estrutura comum

Cada fornecedor precisa de cinco coisas:

1. **Tool list.**Nome, descrição e esquema de entrada por ferramenta.
2. **Tool choice.**Forçar uma ferramenta específica, proibir ferramentas, ou deixar o modelo decidir.
3. **Call emission.**Output estruturado nomeando a ferramenta e os argumentos.
4. **Call id.**Correlação da resposta à chamada correta (matéria paralela).
5. **Result injection.**Uma mensagem ou bloqueio que liga o resultado à chamada.

### Diferenças de forma, campo por campo

| Aspect | OpenAI | Anthropic | Gemini |
|--------|--------|-----------|--------|
| Declaration envelope | `{type: "function", function: {...}}` | `{name, description, input_schema}` | `{functionDeclarations: [{...}]}` |
| Schema field | `parameters` | `input_schema` | `parameters` |
| Response container | `tool_calls[]` on assistant message | `content[]` of type `tool_use` | `parts[]` of type `functionCall` |
| Arguments type | stringified JSON | parsed object | parsed object |
| Id format | `call_...` (OpenAI generates) | `toolu_...` (Anthropic) | UUID (Gemini 3+) |
| Result block | role `tool`, `tool_call_id` | `user` with `tool_result`, `tool_use_id` | `functionResponse` with matching `id` |
| Force-a-tool | `tool_choice: {type: "function", function: {name}}` | `tool_choice: {type: "tool", name}` | `tool_config: {function_calling_config: {mode: "ANY"}}` |
| Forbid tools | `tool_choice: "none"` | `tool_choice: {type: "none"}` | `mode: "NONE"` |
| Strict schema | `strict: true` | `strict: true` per tool (opt-in) | `responseSchema` at request level |

### Limite que você vai realmente atingir

- **OpenAI.**128 ferramentas por pedido. profundidade de esquema 5. cadeia de argumentos <= 8192 bytes.`$ref`Não , não .`oneOf`- Não .`anyOf`- Não .`allOf`com sobreposição, todas as propriedades enumeradas em `required`- Não .
- **Anthropic.**64 ferramentas por pedido. Profundidade do esquema efetivamente ilimitada mas limite prático 10.`strict: true`O esquema é um contrato que o modelo tende a seguir, não uma garantia.
- **Gemini.**64 funções por solicitação. Os tipos de esquema são um subconjunto OpenAPI 3.0 (uma pequena divergência do JSON Schema 2020-12).

### `tool_choice`comportamento

Três modos que todos suportam, nomeados de forma diferente.

- **Auto.**O modelo escolhe ferramenta ou texto.
- **Required / Any.**O modelo deve chamar pelo menos uma ferramenta.
- **None.**O modelo não deve chamar ferramentas.

Além de um modo único para cada fornecedor:

- **OpenAI.**Forçar uma ferramenta específica pelo nome.
- **Anthropic.**Forçar uma ferramenta específica por nome; `disable_parallel_tool_use`A bandeira separa o único contra o múltiplo.
- **Gemini.** `mode: "VALIDATED"`Roteia cada resposta através de um validador de esquema, independentemente da intenção do modelo.

### Chamadas paralelas

O OpenAI `parallel_tool_calls: true`(default) emite várias chamadas em uma mensagem assistente.`tool_call_id`Historicamente , o Anthropic fez um único telefonema .`disable_parallel_tool_use: false`(default em Claude 3.5) permite multi. Gemini 2 permitiu chamadas paralelas, mas não deu ids estáveis; Gemini 3 adiciona UUIDs para que as respostas fora de ordem se correlacionem limpa.

### Transmissão

As três chamadas de ferramenta de suporte são transmitidas.

- **OpenAI.**- Fragmentos de Delta de`tool_calls[i].function.arguments`Acumulam-se até que`finish_reason: "tool_calls"`- Não .
- **Anthropic.**Eventos de bloqueio de início / bloqueio de delta / bloqueio de parada. `input_json_delta`Os pedaços contêm argumentos parciais.
- **Gemini.** `streamFunctionCallArguments`(novo em Gemini 3) emite pedaços com um `functionCallId`para que várias chamadas paralelas possam intercalar-se.

A fase 13 · 03 é uma fase de análise profunda da montagem paralela + de streaming.

### Erros e reparação

Os erros de argumento inválido também parecem diferentes.

- **OpenAI (non-strict).**Reto de modelo `arguments: "{bad json}"`Se o seu JSON falhar, injetam uma mensagem de erro e chamam novamente.
- **OpenAI (strict).**A validação ocorre durante a decodificação; JSON inválido é impossível, mas `refusal`Pode aparecer.
- **Anthropic (non-strict).** `input`O esquema é de aconselhamento. Validação do lado do servidor.`strict: true`A amostragem é limitada ao esquema.
- **Gemini.**A peculiaridade da OpenAPI 3.0: `enum`em campos objetos silenciosamente ignorados; validar-se.

### O padrão de tradutor

Uma declaração canônica de ferramenta no seu código parece assim (você escolhe a forma):

```python
Tool(
    name="get_weather",
    description="Use when ...",
    input_schema={"type": "object", "properties": {...}, "required": [...]},
    strict=True,
)
```

Três pequenas funções traduzem-no para as três formas do provedor.`code/main.py`Não é necessário nenhuma rede. esta lição ensina as formas, não o HTTP.

As equipes de produção envolvem este tradutor em `AbstractToolset`(AI da Pidantica),`UniversalToolNode`(LangGraph), ou `BaseTool`(LlamaIndex). Fase 13 · 17 envia um gateway que expõe uma API em forma de OpenAI na frente de qualquer um dos três.

```figure
function-call-args
```

## Usá-lo

`code/main.py`define um canônico `Tool`Dataclass e três tradutores que emitem a declaração OpenAI, Anthropic e Gemini JSON. Ele então analisa uma resposta feita à mão de cada forma de cada provedor no mesmo objeto de chamada canônica, demonstrando que a semântica é idêntica sob a pele.

O que ver:

- Os três blocos de declaração diferem apenas em termos de envelopes e de nomes de campos.
- Os três blocos de resposta diferem em que a chamada vive (nível superior `tool_calls`- Não .`content[]`Bloco,`parts[]`(entrada).
- Um .`canonical_call()`Extracto de função `{id, name, args}`de todas as três formas de resposta.

## Envia-o

Esta lição produz`outputs/skill-provider-portability-audit.md`- Tendo em conta uma integração de chamadas de função contra um prestador, a competência produz uma auditoria de portabilidade: quais os limites de que o prestador depende, quais os campos que precisam ser renomeados e quais os rompimentos quando são portados para cada outro prestador.

## Exercícios

1. Corra .`code/main.py`e verificar que as três declarações de fornecedor JSONs todos serializam o mesmo subjacente `Tool`Modificar a ferramenta canônica para adicionar um parâmetro enum e confirmar que apenas o tradutor Gemini precisa para lidar com a peculiaridade do OpenAPI.

2. Adicionar um`ListToolsResponse`parser para cada fornecedor que extrai a lista de ferramentas um modelo retorna após um `list_tools`O OpenAI não tem um nativo; note esta assimetria.

3. Implementação `tool_choice`conversion: mapa de um canônico `ToolChoice(mode="force", tool_name="x")`Em todas as três formas do provedor.`mode="any"`E ...`mode="none"`Verifique a tabela de diferença da lição.

4. Escolha um dos três provedores e leia o seu guia de chamadas de função de ponta a ponta. Encontre um campo em sua especificação de esquema que os outros dois não suportam.`strict`, Antropico `disable_parallel_tool_use`, Gémeos .`function_calling_config.allowed_function_names`- Não .

5. Escreva um vetor de teste: uma chamada de ferramenta cujos argumentos violam o esquema declarado. Execute-o através do validador de cada fornecedor (o stdlib na lição 01 fará como um proxy) e registre quais erros são causados. Documentar qual fornecedor você usaria na produção para rigor.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Function calling | "Tool use" | Provider-level API for structured tool-call emission |
| Tool declaration | "Tool spec" | Name + description + JSON Schema input payload |
| `tool_choice` | "Force / forbid" | Auto / required / none / specific-name modes |
| Strict mode | "Schema enforcement" | OpenAI flag that constrains decoding to match schema |
| `tool_use` block | "Anthropic's call shape" | Inline content block with id, name, input |
| `functionCall` part | "Gemini's call shape" | A `parts[]` entry containing name, args, and id |
| Arguments-as-string | "Stringified JSON" | OpenAI returns args as a JSON string, not an object |
| Parallel tool calls | "Fan-out in one turn" | Multiple tool calls in one assistant message |
| Refusal | "Model declines" | Strict-mode-only refusal block instead of a call |
| OpenAPI 3.0 subset | "Gemini schema quirk" | Gemini uses a JSON-Schema-like dialect with minor differences |

## Mais leitura

- [OpenAI — Function calling guide](https://platform.openai.com/docs/guides/function-calling) Referência canónica, incluindo o modo rigoroso e as chamadas paralelas
- [Anthropic — Tool use overview](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview)- Não .`tool_use`E ...`tool_result`semântica de blocos
- [Google — Gemini function calling](https://ai.google.dev/gemini-api/docs/function-calling) chamadas paralelas, ids únicos e subconjunto OpenAPI
- [Vertex AI — Function calling reference](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/function-calling) Superfície empresarial de Gémeos
- [OpenAI — Structured outputs](https://platform.openai.com/docs/guides/structured-outputs) Detalhes sobre a aplicação de esquemas de modo rigoroso
