# Chamadas paralelas e transmissão com ferramentas

> Três pesquisas meteorológicas independentes são três viagens de ida e volta. Execute-as em paralelo e o tempo total desabre para a chamada única mais lenta. Cada fornecedor de fronteira agora emite várias chamadas de ferramentas em uma única volta. O pagamento é real; a canalização é sutil. Esta lição percorre ambas as metades: o fan-out paralelo e a reensembleia de argumentos transmitidos, com ênfase na armadilha de correlação de id.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, thread pool + streaming harness)
**Prerequisites:** Phase 13 · 02 (function calling deep dive)
**Time:** ~75 minutes

## Objetivos de aprendizagem

- Explique por que .`parallel_tool_calls: true`Existe e quando desativar.
- Correlação de blocos de argumento fluídos para a identificação de chamada de ferramenta certa durante o fan-out paralelo.
- Reassemblar parcial `arguments`As cadeias em JSON completo sem análise precoce.
- Execute um índice meteorológico de três cidades que demonstre latência sequencial vs paralela.

## O problema

Sem chamadas paralelas, um agente respondendo a "o que é o tempo em Bengaluru, Tóquio e Zurique" faz o seguinte:

```
user -> LLM
LLM -> call get_weather(Bengaluru)
host -> run executor, reply with result
LLM -> call get_weather(Tokyo)
host -> run executor, reply with result
LLM -> call get_weather(Zurich)
host -> run executor, reply with result
LLM -> final text answer
```

Três viagens de ida e volta para o LLM, cada uma das quais também paga a latência do executor.

Com chamadas paralelas:

```
user -> LLM
LLM -> call get_weather(Bengaluru); call get_weather(Tokyo); call get_weather(Zurich)
host -> run all three executors concurrently, reply with three results
LLM -> final text answer
```

Uma viagem de ida e volta de LLM. O tempo de execução é o máximo dos três, não a soma. Os índices de produção em OpenAI, Anthropic e Gemini mostram uma redução de 60 a 70 por cento no relógio de parede nas cargas de trabalho de ventilador.

Quando as três chamadas forem completas, os resultados devem ser iguais.`tool_call_id`O modelo pode alinhá-los. Quando os resultados são transmitidos, você deve montar fragmentos de argumento parciais em JSON completo antes de executar. Gemini 3 adicionou ids únicos em parte para resolver um problema do mundo real onde duas chamadas paralelas para a mesma ferramenta eram indistinguíveis.

## O conceito

### Atividade paralela

- **OpenAI.** `parallel_tool_calls: true`ligado por padrão.`false`Para forçar a série.
- **Anthropic.**Paralelamente através de`disable_parallel_tool_use: false`(por defeito em Claude 3.5 e superior).`true`Para série.
- **Gemini.**Sempre paralelas .`tool_config.function_calling_config.mode = "AUTO"`Deixa o modelo decidir.

Desativar o paralelo quando as ferramentas têm dependências de ordem (`create_file`Então ...`write_file`), quando a saída de uma chamada informa a entrada de outra, ou quando o limitador de taxa não pode lidar com o ventilador.

### Correlação Id

Cada chamada que o modelo emite tem um`id`Cada resultado que o anfitrião retorna deve incluir a mesma identificação.

- **OpenAI.** `tool_call_id`em cada mensagem de papel de ferramenta.
- **Anthropic.** `tool_use_id`em cada um`tool_result`Bloco.
- **Gemini.** `id`em cada um`functionResponse`(Gêmeos 3 e acima; Gêmeos 2 correspondido pelo nome que rompeu para chamadas paralelas do mesmo nome).

### A execução de chamadas simultâneas

O host executa o executor de cada chamada em seu próprio fio, coroutine ou operador remoto.`asyncio.gather`O número de identificação é o número de identificação.

Um erro comum: responder com resultados na ordem da lista de chamadas em vez de ordem de conclusão.`tool_call_id`, mas se um resultado for retirado ou duplicado, uma lista de respostas que é reordenada longe da ordem em que os resultados chegaram torna a lacuna mais difícil de encontrar nos registros.

### Chamadas de ferramentas de streaming

Quando o modelo fluir,`arguments`Três fluxos separados de pedaços para três chamadas paralelas se interceptam no fio.

Forma por fornecedor:

- **OpenAI.**Cada pedaço é`choices[0].delta.tool_calls[i].function.arguments`O pedaço carrega .`index`(posição na lista de chamadas).`id`quando aparece pela primeira vez, e analisar JSON quando `finish_reason = "tool_calls"`- Não .
- **Anthropic.**Os eventos de streaming são`message_start`, depois um .`content_block_start`por bloco com tipo `tool_use`(conteendo identificação, nome, entrada vazia). `content_block_delta`eventos de transporte `input_json_delta`pedaços.`content_block_stop`fecha cada quarteirão.
- **Gemini.** `streamFunctionCallArguments`(Gêmeos 3 e acima) emite pedaços com um `functionCallId`Antes do Gemini 3, o streaming devolvia uma chamada completa de cada vez.

### JSON parcial e a armadilha de análise precoce

Não consegues analisar .`arguments`Até que seja completo.`{"city": "Beng`O portão correto é o sinal de final de chamada do prestador: o OpenAI `finish_reason = "tool_calls"`, Anthropic's `content_block_stop`Só depois tentamos.`json.loads`. Uma abordagem mais robusta usa um parser JSON incremental que produz eventos à medida que a estrutura completa; o guia de streaming da OpenAI recomenda isso para UX que mostra um indicador de "pensamento" ao vivo. A contagem de braces não é confiável como um teste de integridade (braces dentro de strings citadas ou conteúdo escapado causam falsos positivos) e só deve ser usada como uma heurística de defeito informal.

### Conclusão fora de ordem

```
call_A: fast API, returns first
call_B: slow API, returns second
call_C: median API, returns third
```

A resposta do anfitrião deve ainda citar os ids:

```
[{role: "tool", tool_call_id: "call_A", content: ...},
 {role: "tool", tool_call_id: "call_B", content: ...},
 {role: "tool", tool_call_id: "call_C", content: ...}]
```

A ordem na resposta não importa para a corretão na OpenAI ou na Anthropic.

### Indicador de referência: sequencial vs paralelo

O arame está dentro .`code/main.py`Simula três executores com latência de 400, 600 e 800 ms. Sequencial executa em 1800 ms total. Paralelamente executa em max ((400, 600, 800) = 800 ms. A diferença é constante, não proporcional, então as economias crescem com a contagem de ferramentas.

A advertência do mundo real: chamadas paralelas estressam APIs para baixo. Um ventilador de 10 vias para um serviço limitado de taxa falhará. Fase 13 · 17 cobre a pressão de volta ao nível do gateway; semântica de retest é planejada para uma fase futura.

### O relógio de parede de ventilador em streaming

Se o modelo em si transmite, você pode começar a executar assim que os argumentos de uma chamada estiverem completos, em vez de esperar que todas as chamadas sejam finalizadas. Este é um documento de otimização OpenAI, mas nem todos os SDKs expõem. O arsenal desta lição o faz: assim que o fluxo simulado produz um objeto de argumento completo, o host inicia essa chamada.

```figure
tp-parallel-fanout
```

## Usá-lo

`code/main.py`A primeira opera três chamadas meteorológicas simuladas sequencialmente e em paralelo usando`concurrent.futures.ThreadPoolExecutor`A segunda metade reproduz uma resposta de streaming falsa  pedaços de `arguments`para três chamadas paralelas intercaladas em um fluxo  e reassemble-las por id com `StreamAccumulator`Sem LLM, sem rede, apenas a lógica de reensamblagem.

O que ver:

- O temporizador sequencial atinge 1,8 segundos. O temporizador paralelo atinge 0,8 segundos nas mesmas latências falsas.
- O acumulador lida com pedaços que chegam fora de ordem, tampando por ID e analisando apenas quando o JSON de cada chamada está completo.
- O executor começa assim que os argumentos de um ID terminam, não depois de todos os fluxos acabarem.

## Envia-o

Esta lição produz`outputs/skill-parallel-call-safety-check.md`. Tendo em conta um registo de ferramentas, as auditorias de competências que permitem parallelizar as ferramentas, que têm dependências de ordem e que ultrapassam os limites de taxas a jusante  devolver um registo revisto com ferramentas `parallel_safe`- As bandeiras.

## Exercícios

1. Corra .`code/main.py`Confirme que a relação paralelo-sequencial é aproximadamente `max/sum`(as corridas reais desviam ligeiramente do ideal devido à programação de fios, serialização e sobrecarga de arremesso).

2. Extender o acumulador para lidar com um caso de "chamada foi cancelada no meio do fluxo" deixando cair o seu tampão e emitindo um `cancelled`Qual fornecedor documenta este caso explicitamente?`content_block_stop`Semântica e OpenAI `finish_reason: "length"`- Comportamento.

3. Substitua a piscina de fios por `asyncio.gather`Você deve ver pequenas vitórias em async por causa do menor custo de comutação de contexto, mas apenas se os executores fazem I / O real.

4. Escolha duas ferramentas que NÃO devem ser paralelas (por exemplo `create_file`Então ...`write_file`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             `ordering_dependency`O sistema de programação de dependência é o mínimo que uma futura fase de engenharia de agentes formaliza.

5. Leia a seção de chamadas para funções paralelas da OpenAI e a Anthropic `disable_parallel_tool_use`Docs. Identificar o tipo de ferramenta do mundo real em que a Anthropic recomenda desativar o paralelismo.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Parallel tool calls | "Fan-out in one turn" | Model emits multiple tool calls in a single assistant message |
| `parallel_tool_calls` | "OpenAI's flag" | Enable or disable multi-call emission |
| `disable_parallel_tool_use` | "Anthropic's inverse" | Opt-out flag; default is parallel enabled |
| Tool call id | "Correlation handle" | Per-call identifier the result message must echo |
| Accumulator | "Stream buffer" | Per-id string buffer for partial `arguments` chunks |
| Out-of-order completion | "Fastest first" | Parallel calls finish in unpredictable order; ids are the glue |
| Dependency graph | "Ordering constraints" | Tools whose outputs feed into inputs of other tools; cannot parallelize |
| Parse-early trap | "JSON.parse exploded" | Attempting to parse an incomplete `arguments` string |
| `streamFunctionCallArguments` | "Gemini 3 feature" | Streamed argument chunks with unique id per call |
| Completion-order reply | "Don't wait for all" | Reply with results as they arrive, keyed by id |

## Mais leitura

- [OpenAI — Parallel function calling](https://platform.openai.com/docs/guides/function-calling#parallel-function-calling) comportamento padrão e a bandeira de exclusão
- [Anthropic — Parallel tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use)- Não .`disable_parallel_tool_use`e batchagem de resultados
- [Google — Gemini function calling parallel section](https://ai.google.dev/gemini-api/docs/function-calling)- Chamadas paralelas de Gemini 3
- [OpenAI — Streaming responses with tools](https://platform.openai.com/docs/api-reference/responses-streaming) reassembly de argumentos em pedaços para fluxos OpenAI
- [Anthropic — Streaming messages](https://docs.anthropic.com/en/api/messages-streaming)- Não .`content_block_delta`com`input_json_delta`
