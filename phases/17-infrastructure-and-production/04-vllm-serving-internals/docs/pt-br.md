# Internals de Serving do vLLM: PagedAttention, Continuous Batching, Chunked Prefill

> A dominância do vLLM em 2026 se sustenta em três defaults compostos, não em um truque solitário. PagedAttention está sempre ligado. Continuous batching injeta novos requests no batch ativo entre iterações de decode. Chunked prefill fatia prompts longos para que tokens de decode nunca passem fome. Ligue os três e um Llama 3.3 70B FP8 em uma H100 SXM5 empurra 2.200-2.400 tok/s a 128 concorrentes — cerca de 25% acima do default próprio do vLLM e 3-4x de um loop PyTorch ingênuo. Esta aula lê o scheduler e o kernel de attention a um nível que você pode diagramar, e termina com um continuous batcher toy em `code/main.py` que agenda prefill e decode do jeito que o vLLM faz.

**Tipo:** Aprendizado
**Linguagens:** Python (stdlib, scheduler de continuous batching toy)
**Pré-requisitos:** Fase 17 · 01 (Model Serving), Fase 11 (Engenharia de LLM)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Explicar PagedAttention como um alocador de KV cache: blocos, block tables e por que a fragmentação fica abaixo de 4% em carga de produção.
- Diagramar continuous batching no nível de iteração: como sequências terminadas saem do batch e novas entram sem esvaziar.
- Descrever chunked prefill em uma frase e nomear qual métrica de latência ele protege (dica: é a cauda de TTFT, não a média de throughput).
- Nomear o bug do vLLM v0.18.0 de 2026 que pega equipes que ligam todas as otimizações ao mesmo tempo.

## O Problema

Um loop de serving PyTorch ingênuo roda um request por vez: tokenizar, prefill, decode até EOS, retornar. Para um usuário isso funciona. Para cem, é uma fila de pessoas pacientes. A correção óbvia — batch estático — preenche cada request até o prompt mais longo na janela, preenche cada decode até a saída mais longa esperada, e trava todo o batch na sequência mais lenta. Você paga por padding que nunca usa e requests rápidos esperam pelos lentos.

vLLM resolve três problemas ao mesmo tempo. PagedAttention impede que a fragmentação de KV cache consuma 60-80% da memória GPU da forma que a alocação contígua clássica faz. Continuous batching permite que requests entram e saiam do batch entre cada iteração de decode, então o batch sempre está cheio de trabalho real. Chunked prefill quebra um prompt de 32k tokens em fatias de ~512 tokens que se alternam com decode, então um prompt longo não congela cada token de decode na GPU.

O default de produção em 2026 é ligar os três. Você precisa entender o que cada um faz porque os modos de falha estão todos no scheduler, não no modelo.

## O Conceito

### PagedAttention como sistema de memória virtual

Um KV cache é `num_layers × 2 × num_heads × head_dim × seq_len × bytes_per_element` por sequência. Para Llama 3.3 70B a 8192 tokens, são cerca de 1,25 GB por sequência em BF16. Se você pré-reserva 8192 slots para cada request mas o request médio só usa 1500 tokens, você desperdiça cerca de 82% do HBM que reservou. Batching clássico paga esse desperdício.

PagedAttention empresta a ideia da memória virtual do SO. O KV cache não é contíguo por sequência. Ele é alocado em blocos de tamanho fixo (padrão 16 tokens). Cada sequência tem uma block table que mapeia suas posições lógicas de token para IDs de blocos físicos. Quando uma sequência cresce além de seus blocos alocados, mais um bloco é adicionado. Quando termina, seus blocos voltam para o pool.

A fragmentação cai de 60-80% (clássico) para menos de 4% (PagedAttention). Você não ativa PagedAttention com uma flag — ele é o único alocador que o vLLM entrega. A chave é `--gpu-memory-utilization` (padrão 0.9), que diz ao vLLM quanto HBM reservar para blocos KV depois de carregar pesos e ativações.

### Continuous batching no nível de iteração

O antigo "dynamic batching" esperava uma janela (digamos 10 ms) para preencher um batch, rodava prefill + decode + decode + decode até cada sequência terminar. Sequências rápidas saíam cedo e ficavam ociosas enquanto a GPU terminava as lentas.

Continuous batching opera entre cada passo de decode. Chame o conjunto de sequências rodando de lista `RUNNING`. A cada iteração:

1. Qualquer sequência em `RUNNING` que acabou de atingir EOS ou max_tokens é removida.
2. O scheduler olha a fila de espera. Se houver blocos KV livres, ele admite novas sequências (prefill ou retomadas).
3. O forward pass roda em o que está em `RUNNING`, emitindo um novo token por sequência.

O tamanho do batch nunca é preenchido para um número fixo. Sequências em diferentes posições de saída compartilham um forward fundido. No vLLM de 2026 isso se chama `V1 scheduler`. O invariante chave: o scheduler roda uma vez por iteração de decode, não uma vez por request.

### Chunked prefill protege a cauda de TTFT

Prefill é limitado por compute. Um prompt de 32k tokens no Llama 3.3 70B leva ~800 ms de puro prefill em uma H100. Enquanto o prefill roda, tokens de decode para cada outra sequência no batch esperam. Em um loop de serving, a latência do primeiro token (TTFT) de um prompt longo se torna o pico de latência entre tokens (ITL) para dezenas de outros usuários.

Chunked prefill divide o prefill em blocos de tamanho fixo (padrão 512 tokens) e agenda cada bloco como uma unidade. Entre blocos, o scheduler pode avançar sequências de decode em um token. Você troca um pequeno golpe absoluto de latência de prefill (alguns ms por bloco) por muito menos jitter de tempo de decode. P99 ITL em carga mista cai de ~50 ms para ~15 ms em benchmarks publicados.

### Os três defaults interagem

As três funcionalidades pressupõem uma à outra. PagedAttention dá ao scheduler um recurso KV de granulação fina para negociar. Continuous batching precisa desse recurso de granulação fina para que admitir uma nova sequência não force uma reorganização global. Chunked prefill é uma decisão que o scheduler toma na mesma lista `RUNNING` — é mais uma política de scheduler, não um sistema separado.

Você não precisa conhecer cada flag. Você precisa saber o que o scheduler otimiza: goodput sob orçamento de blocos KV, sujeito à fatiamento de chunked prefill.

### O bug do v0.18.0 de 2026

No vLLM v0.18.0 você não pode combinar `--enable-chunked-prefill` com speculative decoding por draft model (`--speculative-model`). A exceção documentada é o N-gram GPU speculative decoding no V1 scheduler. Equipes que ligam cada flag sem ler os release notes pegam um erro em tempo de startup, não uma regressão suave. Se seu ganho de speculative valia habilitar chunked prefill, repense a escolha — a resposta certa em 2026 costuma ser EAGLE-3 sem chunked prefill, não um draft model mais chunked prefill que não compila.

### Números que você deve memorizar

- Llama 3.3 70B FP8, H100 SXM5, 128 concorrentes, todos os três ligados: 2.200-2.400 tok/s.
- Mesmo modelo, vLLM padrão (sem chunked prefill): ~1.800 tok/s.
- Mesmo modelo, loop forward PyTorch ingênuo: ~600 tok/s.
- Fragmentação de KV com PagedAttention em carga de produção: <4%.
- P99 ITL em carga mista: ~15 ms com chunked prefill, ~50 ms sem.

### Como o scheduler parece

```
while True:
    finished = [s for s in RUNNING if s.is_done()]
    for s in finished: release_blocks(s); RUNNING.remove(s)

    while WAITING and have_free_blocks_for(WAITING[0]):
        s = WAITING.pop(0)
        allocate_initial_blocks(s)
        RUNNING.append(s)

    # agendar prefill chunks + decode em um batch
    batch = []
    for s in RUNNING:
        if s.in_prefill:
            batch.append(next_prefill_chunk(s))   # ex. 512 tokens
        else:
            batch.append(decode_one_token(s))     # 1 token

    run_forward(batch)                            # uma chamada GPU fundida
```

`code/main.py` é exatamente esse loop em Python stdlib com contagens de tokens fake e latência de forward fake. Rodá-lo mostra como chunked prefill mantém sequências de decode vivas durante um prefill longo.

## Use

`code/main.py` simula um scheduler estilo vLLM com funcionalidades alternáveis. Execute para ver:

- Modo `NAIVE`: um request por vez, sem batching.
- Modo `STATIC`: preencher e esperar, batching clássico.
- Modo `CONTINUOUS`: admissão e liberação no nível de iteração.
- Modo `CONTINUOUS + CHUNKED`: fatias de prefill alternando com decode.

A saída mostra throughput total (tokens por segundo virtual), TTFT médio e P99 ITL. A linha `CONTINUOUS + CHUNKED` deve dominar em tráfego misto.

## Entregue

Esta aula produz `outputs/skill-vllm-scheduler-reader.md`. Dada uma config de serving (tamanho de batch, utilização de memória KV, tamanho de chunked prefill, config de speculative), produz um diagnóstico do scheduler que nomeia qual dos três defaults está criando gargalo e o que ajustar.

## Exercícios

1. Execute `code/main.py`. Compare `STATIC` com `CONTINUOUS` em um workload com requests curtos e longos misturados. De onde vem o gap de throughput — eficiência de prefill, eficiência de decode ou latência de cauda?
2. Modifique o scheduler toy para adicionar `--max-num-batched-tokens`. Qual é o valor certo para uma H100 rodando Llama 3.3 70B FP8? (Dica: é função do tamanho do bloco KV e do número de blocos livres, não do HBM bruto.)
3. Re-leia os release notes do vLLM v0.18.0. Quais combinações de flags são mutualmente exclusivas? Liste-as.
4. Calcule o desperdício de fragmentação de KV cache para um trace de 1.000 requests com média de 1.500 tokens de saída, std de 600 tokens, sob (a) alocação contígua por request a 8192 máximo, (b) PagedAttention com blocos de 16 tokens.
5. Explique em um parágrafo por que chunked prefill ajuda o P99 ITL mas não o throughput isoladamente. De onde vem o ganho de throughput na prática?

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| PagedAttention | "o truque de KV" | Alocador de blocos de tamanho fixo para KV cache; fragmentação <4% |
| Block table | "a page table" | Mapa por sequência de posição lógica de token para bloco KV físico |
| Continuous batching | "dynamic batching, mas certo" | Decisões de admissão/liberação feitas a cada iteração de decode |
| Chunked prefill | "partição de prefill" | Quebrar prefill longo em fatias de 512 tokens alternando com decode |
| TTFT | "tempo até o primeiro token" | Prefill + fila + rede; dominado por prefill em prompts longos |
| ITL | "latência entre tokens" | Tempo entre tokens de decode consecutivos; dominado por tamanho do batch |
| Goodput | "throughput que cumpre SLO" | Tokens/sec onde cada request ainda bateu nos alvos de TTFT e ITL |
| V1 scheduler | "o novo scheduler" | Scheduler do vLLM de 2026; N-gram spec decode é o caminho compatível com chunked prefill |
| `--gpu-memory-utilization` | "a chave de memória" | Fração de HBM reservada para blocos KV após pesos e ativações |

## Leitura Complementar

- [vLLM documentation — Speculative Decoding](https://docs.vllm.ai/en/latest/features/spec_decode/) — fonte oficial sobre compatibilidade de chunked-prefill e speculative-decoding.
- [vLLM Release Notes (NVIDIA)](https://docs.nvidia.com/deeplearning/frameworks/vllm-release-notes/index.html) — cadência de releases de 2026 e comportamento específico por versão.
- [vLLM Blog — PagedAttention](https://blog.vllm.ai/2023/06/20/vllm.html) — o artigo original que ainda define como pensar sobre o alocador.
- [PagedAttention paper (arXiv:2309.06180)](https://arxiv.org/abs/2309.06180) — análise de fragmentação e design do scheduler.
- [Aleksa Gordic — Inside vLLM](https://www.aleksagordic.com/blog/vllm) — walkthrough detalhado do V1 scheduler com flame graphs.
