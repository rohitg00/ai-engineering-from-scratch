# Chamadas Paralelas de Ferramenta e Streaming com Ferramentas

> Três consultas independentes de clima serializadas são três round trips. Roda em paralelo e o tempo total despenca pro pior chamada individual. Todo provedor frontier agora emite múltiplas chamadas de ferramenta num único turno. O benefício é real; a infraestrutura é sutil. Esta aula caminha pelas duas metades: o fan-out paralelo e o reassembly de argumentos em streaming, com ênfase na armadilha de correlação por id.

**Tipo:** Construir
**Linguagens:** Python (stdlib, thread pool + harness de streaming)
**Pré-requisitos:** Fase 13 · 02 (function calling em profundidade)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Explicar por que `parallel_tool_calls: true` existe e quando desabilitá-lo.
- Correlacionar chunks de argumentos em streaming com o id correto da chamada de ferramenta durante fan-out paralelo.
- Remontar strings de `arguments` parciais em JSON completo sem fazer parse cedo demais.
- Rodar um benchmark de clima em três cidades que demonstra latência sequencial vs. paralela.

## O Problema

Sem chamadas paralelas, um agente respondendo "qual o tempo em Bengaluru, Tóquio e Zurique" faz assim:

```
user -> LLM
LLM -> call get_weather(Bengaluru)
host -> roda executor, responde com resultado
LLM -> call get_weather(Tokyo)
host -> roda executor, responde com resultado
LLM -> call get_weather(Zurich)
host -> roda executor, responde com resultado
LLM -> resposta final em texto
```

Três round trips de LLM, cada um também pagando a latência do executor. Aproximadamente 4x o tempo de clock ideal.

Com chamadas paralelas:

```
user -> LLM
LLM -> call get_weather(Bengaluru); call get_weather(Tokyo); call get_weather(Zurich)
host -> roda os três executores concorrentemente, responde com três resultados
LLM -> resposta final em texto
```

Um round trip do LLM. O tempo do executor é o máximo dos três, não a soma. Benchmarks de produção no OpenAI, Anthropic e Gemini mostram redução de 60 a 70 por cento no tempo de clock em cargas de fan-out.

O preço é a complexidade de correlação. Quando as três chamadas completam fora de ordem, seus resultados devem carregar o `tool_call_id` correspondente pra que o modelo possa alinhar. Quando os resultados em streaming, você deve montar fragmentos de argumentos parciais em JSON completo antes de executar. Gemini 3 adicionou ids únicos em parte pra resolver um problema real onde duas chamadas paralelas pra mesma ferramenta eram indistinguíveis.

## O Conceito

### Habilitando o paralelo

- **OpenAI.** `parallel_tool_calls: true` por padrão. Coloque `false` pra forçar serial.
- **Anthropic.** Paralelo via `disable_parallel_tool_use: false` (padrão no Claude 3.5 e acima). Coloque `true` pra serial.
- **Gemini.** Sempre com capacidade paralela; `tool_config.function_calling_config.mode = "AUTO"` deixa o modelo decidir.

Desabilite o paralelo quando ferramentas têm dependências de ordenação (`create_file` antes de `write_file`), quando a saída de uma chamada alimenta a entrada de outra, ou quando o rate limiter não aguenta o fan-out.

### Correlação por id

Toda chamada que o modelo emite tem um `id`. Todo resultado que o host retorna deve incluir o mesmo id. Sem isso, resultados são ambíguos.

- **OpenAI.** `tool_call_id` em cada mensagem de role tool.
- **Anthropic.** `tool_use_id` em cada bloco `tool_result`.
- **Gemini.** `id` em cada `functionResponse` (Gemini 3 e acima; Gemini 2 correspondia por nome o que quebrava pra chamadas paralelas com mesmo nome).

### Rodando chamadas concorrentemente

O host roda o executor de cada chamada em sua própria thread,协程 ou worker remoto. O harness mais simples usa uma thread pool; produção usa asyncio com `asyncio.gather` ou concorrência estruturada. A ordem de conclusão é imprevisível — o id é o identificador.

Um bug comum: responder com resultados na ordem da lista de chamadas em vez da ordem de conclusão. Geralmente funciona porque o modelo só se importa com `tool_call_id`, mas se um resultado é perdido ou duplicado, a submissão fora de ordem dificulta o debug. Prefira responder na ordem de conclusão com ids explícitos.

### Streaming de chamadas de ferramenta

Quando o modelo faz streaming, `arguments` chegam em pedaços. Três streams separados de chunks pra três chamadas paralelas se entrelaçam na rede. Você precisa de um acumulador por id.

Forma por provedor:

- **OpenAI.** Cada chunk é `choices[0].delta.tool_calls[i].function.arguments` (string parcial). O chunk carrega `index` (posição na lista de chamadas). Você acumula por index, lê `id` quando aparece pela primeira vez, e faz parse do JSON quando `finish_reason = "tool_calls"`.
- **Anthropic.** Eventos de stream são `message_start`, depois um `content_block_start` por bloco com tipo `tool_use` (contendo id, name, input vazio). Eventos `content_block_delta` carregam chunks `input_json_delta`. `content_block_stop` fecha cada bloco.
- **Gemini.** `streamFunctionCallArguments` (Gemini 3 e acima) emite chunks com um `functionCallId` pra que chamadas se entrelacem limpo. Antes do Gemini 3, streaming retornava uma chamada completa por vez.

### JSON parcial e a armadilha do parse cedo

Você não pode fazer parse de `arguments` até que esteja completo. JSON parcial como `{"city": "Beng` não é válido e vai levantar exceção. O gate correto é o sinal de fim de chamada do provedor: `finish_reason = "tool_calls"` da OpenAI, `content_block_stop` do Anthropic ou o evento de fim de stream do Gemini. Só então tente `json.loads`. Uma abordagem mais robusta usa um parser JSON incremental que emite eventos conforme a estrutura completa; o guia de streaming da OpenAI recomenda isso pra UX que mostra um indicador ao vivo de "pensando". Contagem de chaves é não confiável como teste de completude (chaves dentro de strings entre aspas ou conteúdo escapado causam falsos positivos) e só deve ser usada como heurística informal de debug.

### Conclusão fora de ordem

```
call_A: API rápida, retorna primeiro
call_B: API lenta, retorna segundo
call_C: API mediana, retorna terceiro
```

A resposta do host ainda precisa citar os ids:

```
[{role: "tool", tool_call_id: "call_A", content: ...},
 {role: "tool", tool_call_id: "call_B", content: ...},
 {role: "tool", tool_call_id: "call_C", content: ...}]
```

A ordem na resposta não importa pra correção no OpenAI ou Anthropic. Gemini aceita qualquer ordem desde que os ids correspondam.

### Benchmark: sequencial vs. paralelo

O harness em `code/main.py` simula três executores com latências de 400, 600 e 800 ms. Sequencial roda em 1800 ms no total. Paralelo roda em max(400, 600, 800) = 800 ms. A diferença é constante, não proporcional, então a economia cresce com o número de ferramentas.

Caveat do mundo real: chamadas paralelas sobrecarregam APIs downstream. Um fan-out de 10x pra um serviço com rate limit vai falhar. Fase 13 · 17 cobre backpressure em nível de gateway; semânticas de retry estão planejadas pra uma fase futura.

### Wall-clock de fan-out em streaming

Se o modelo em streaming, você pode começar a executar assim que os argumentos de uma chamada estiverem completos, em vez de esperar todas as chamadas finalizarem. Isso é uma otimização que a OpenAI documenta mas nem todos os SDKs expõem. O harness desta aula faz isso: assim que o stream simulado produz um objeto de argumento completo, o host dispara aquela chamada.

## Use

`code/main.py` tem duas metades. A primeira roda três chamadas simuladas de clima sequencialmente e em paralelo usando `concurrent.futures.ThreadPoolExecutor` e imprime o tempo de clock. A segunda parte reproduz uma resposta falsa em streaming — chunks de `arguments` pra três chamadas paralelas entrelaçados num stream — e os remonta por id com `StreamAccumulator`. Sem LLM, sem rede, só a lógica de remontagem.

O que conferir:

- O timer sequencial chega a 1,8 segundos. O timer paralelo chega a 0,8 segundos nas mesmas latências simuladas.
- O acumulador lida com chunks chegando fora de ordem fazendo buffer por id e parseando só quando o JSON de cada chamada estiver completo.
- O executor dispara assim que os argumentos de um id finalizam, não quando todos os streams terminam.

## Entregue

Esta aula produz `outputs/skill-parallel-call-safety-check.md`. Dado um registry de ferramentas, a skill audita quais ferramentas são seguras pra paralelizar, quais têm dependências de ordenação e quais sobrecarregariam rate limits downstream — retornando um registry revisado com flags `parallel_safe` por ferramenta.

## Exercícios

1. Rode `code/main.py` e varie as latências simuladas. Confirme que a razão paralelo/sequencial é aproximadamente `max/som` (execuções reais desviam levemente do ideal por causa de agendamento de threads, serialização e overhead do harness). Em que distribuição de latência o paralelo para de importar?

2. Estenda o acumulador pra lidar com um caso de "chamada cancelada no meio do stream" descartando seu buffer e emitindo um evento `cancelled`. Qual provedor documenta esse caso explicitamente? Consulte a semântica de `content_block_stop` do Anthropic e o comportamento de `finish_reason: "length"` do OpenAI.

3. Substitua a thread pool por `asyncio.gather`. Faça o benchmark dos dois. Você deveria ver pequenas vitórias no async por custo menor de troca de contexto, mas só se os executores fizerem I/O real.

4. Escolha duas ferramentas que NÃO devem ser paralelizadas (por exemplo `create_file` e depois `write_file`). Adicione um grafo de `ordering_dependency` ao registry e controle o fan-out paralelo por esse grafo. Essa é a infraestrutura mínima pra agendamento com consciência de dependências, que uma fase futura de engenharia de agentes formaliza.

5. Leia a seção de function calling paralela da OpenAI e os docs de `disable_parallel_tool_use` do Anthropic. Identifique o único tipo de ferramenta do mundo real onde o Anthropic recomenda desabilitar o paralelismo. (Dica: mutações consequentes no mesmo recurso.)

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Parallel ferramenta calls | "Fan-out num turno" | Modelo emite múltiplas chamadas de ferramenta numa mensagem do assistant |
| `parallel_tool_calls` | "Flag da OpenAI" | Habilitar ou desabilitar emissão multi-chamada |
| `disable_parallel_tool_use` | "Inverso do Anthropic" | Flag de opt-out; padrão é paralelo habilitado |
| Id da chamada de ferramenta | "Handle de correlação" | Identificador por chamada que a mensagem resultado deve ecoar |
| Acumulador | "Buffer de stream" | Buffer de string por id pra chunks parciais de `arguments` |
| Conclusão fora de ordem | "Mais rápido primeiro" | Chamadas paralelas terminam em ordem imprevisível; ids são a cola |
| Grafo de dependência | "Restrições de ordenação" | Ferramentas cujas saídas alimentam entradas de outras; não pode paralelizar |
| Armadilha do parse cedo | "JSON.parse explodiu" | Tentar parsear uma string `arguments` incompleta |
| `streamFunctionCallArguments` | "Feature do Gemini 3" | Chunks de argumentos em streaming com id único por chamada |
| Resposta em ordem de conclusão | "Não espere todos" | Responder com resultados conforme chegam, indexados por id |

## Leituras Complementares

- [OpenAI — Parallel function calling](https://platform.openai.com/docs/guides/function-calling#parallel-function-calling) — comportamento padrão e flag de opt-out
- [Anthropic — Tool use: implementing ferramenta use](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implementing-tool-use) — `disable_parallel_tool_use` e resultado em lote
- [Google — Gemini function calling parallel section](https://ai.google.dev/gemini-api/docs/function-calling) — chamadas paralelas com correlação por id desde Gemini 3
- [OpenAI — Streaming responses with tools](https://platform.openai.com/docs/api-reference/responses-streaming) — reassembly de argumentos em chunks pra streams da OpenAI
- [Anthropic — Streaming messages](https://docs.anthropic.com/en/api/messages-streaming) — `content_block_delta` com `input_json_delta`
