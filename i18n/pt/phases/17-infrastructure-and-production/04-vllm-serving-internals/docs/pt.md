# Servidores internos do motor  PagedAttenção, Batch contínuo, Preenchimento em pedaços

> A capacidade moderna do motor de serviço baseia-se em três defeitos compostos, não num único truque. PagedAttention está sempre ligado. A batch contínua injeta novos pedidos no lote ativo entre iterações de decodificação. As fatias de preenchimento em pedaços são longas, para que os tokens de decodificação nunca morram de fome. Ligue os três e um Llama 3.3 70B FP8 em um H100 SXM5 empurra 2.200-2.400 tok/s em 128 torque simultâneo  cerca de 25% acima do próprio padrão do vLLM e 3-4x um ciclo PyTorch ingênuo. Esta lição lê o programação e o núcleo de atenção de vLLM  o motor de referência para todas as três técnicas  em um nível que você pode diagramar, e termina com um batch contínuo de brinquedo em `code/main.py`que os horários preenchem e decodificam como o VLLM faz.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy continuous batching scheduler)
**Prerequisites:** Phase 17 · 01 (Model Serving), Phase 11 (LLM Engineering)
**Time:** ~75 minutes

## Objetivos de aprendizagem

- Explique PagedAttention como um alocador de cache de KV: blocos, tabelas de blocos e por que a fragmentação permanece abaixo de 4% na carga de produção.
- Diagrama de batches contínuos no nível de iteração: como as sequências acabadas deixam o lote e as novas se juntam sem drenar.
- Descreva o preenchimento em pedaços numa frase e nomear qual métrica de latência protege (indicação: é a cauda ITL de decodificadores simultâneos, não o volume de transmissão).
- Verifique uma combinação de recursos vLLM contra a matriz de compatibilidade para a sua versão antes de habilitar todas as otimizações de uma só vez.

## O problema

Um ciclo de serviço PyTorch ingênuo executa uma solicitação por vez: tokenize, prefill, decode até EOS, retornar. Em um usuário, isto funciona. A 100 é uma fila de pacientes. A solução óbvia  batching estático  pads cada solicitação para o prompt mais longo na janela, pads cada decodificação para a saída mais longa esperada, e impede o lote inteiro na sequência mais lenta. Pagas por tampas que nunca usas, e pedidos rápidos esperam para pedidos lentos.

O vLLM resolve três problemas de uma só vez. PagedAttention impede a fragmentação do cache KV de consumir 60-80% da memória da GPU da maneira que a alocação contígua clássica faz. Batching contínuo permite que os pedidos se juntem e deixem o lote entre cada iteração de decodificação, de modo que o lote está sempre cheio de trabalho real. O preenchimento em pedaços quebra um token de 32k em ~512 tokens que se interagem com a decodificação, de modo que um longo prompt não congela cada token de decodificação na GPU.

O padrão de produção 2026 está todos os três ligados. Você precisa entender o que cada um faz porque os modos de falha estão todos no agendador, não no modelo.

## O conceito

### PagedAttention como um sistema de memória virtual

Um cache KV é `num_layers × 2 × num_heads × head_dim × seq_len × bytes_per_element`Para Llama 3.3 70B em 8192 tokens, que é aproximadamente 1,25 GB por sequência em BF16. Se você reservar 8192 slots para cada solicitação, mas a solicitação média usa apenas 1500 tokens, você desperdiça cerca de 82% do HBM reservado.

PagedAttention empresta a ideia da memória virtual do sistema operacional. O cache KV não é contiguo por sequência. É alocado em blocos de tamanho fixo (tokens 16 por defeito). Cada sequência tem uma tabela de blocos que mapeia suas posições lógicas de token para IDs de blocos físicos. Quando uma sequência cresce além dos blocos alocados, mais um bloco é adicionado. Quando termina, seus blocos retornam ao pool.

A fragmentação cai de 60-80% (clássico) para menos de 4% (Attenção Pagada).`--gpu-memory-utilization`(padrão 0.9), que indica à vLLM quanto HBM deve reservar para blocos KV após pesos de carga e ativas.

### Batchamento contínuo no nível de iteração

A velha "batchagem dinâmica" esperava uma janela (digamos 10 ms) para encher um lote, em seguida, executou prefill + decode + decode + decode + até que cada sequência terminasse.

A batchagem contínua opera entre cada etapa de decodificação.`RUNNING`Em cada iteração:

1. Qualquer sequência em `RUNNING`que apenas acerta EOS ou max_tokens é removido.
2. O programador olha para a fila de espera. Se houver blocos KV livres, ele admite novas sequências (preencher ou retomar).
3. O passe para a frente corre em qualquer coisa que esteja agora dentro .`RUNNING`, emitindo um novo token por sequência.

O tamanho do lote nunca é empolhado para um número fixo. Sequências em diferentes posições em sua saída compartilham um fundido para a frente.`V1 scheduler`. A invariante chave: o programador é executado uma vez por iteração de decodificação, não uma vez por solicitação.

### Preenchimento em pedaços protege a cauda do ITL

O prefill é computacional. Um prompt de 32k-token no Llama 3.3 70B leva ~800 ms de prefill puro em um H100. Enquanto prefill executa, decodifica tokens para cada outra sequência na bateria de espera. Em um loop de serviço, a latença de primeiro token (TTFT) de um longo prompt se torna o blip de latença inter-token (ITL) para dezenas de outros usuários.

O prefill fragmentado divide o prefill em pedaços de tamanho fixo (tokens padrão 512) e agenda cada pedaço como uma unidade. Entre pedaços o cronista pode avançar as sequências de decodificação em um token. Você troca um pequeno hit de latência de prefill absoluta (alguns ms por pedaço) por um jitter de tempo de decodificação muito menor. P99 ITL sob carga mista cai de ~ 50 ms para ~ 15 ms em benchmarks publicados.

### Os três padrões interagem

As três características assumem-se mutuamente. PagedAttention dá ao cronista um recurso KV de grãos finos para negociar contra. Batchings contínuos necessitam de esse recurso de grãos finos para que a admissão de uma nova sequência não força uma reorganização global. Preenchimento em pedaços é uma decisão que o cronista faz sobre o mesmo .`RUNNING`Lista  é mais uma política de agendamento, não um sistema separado.

Não é preciso conhecer todas as bandeiras, é preciso saber o que o programador otimiza: um bom rendimento sob o orçamento do bloco KV, sujeito a cortes de pré-enchimento em pedaços.

### Verifique a matriz de compatibilidade

Verifique cada combinação de recursos contra a matriz de compatibilidade para a sua versão exacta de vLLM antes de ativá-los todos de uma só vez, porque o que compõe muda entre as versões. Na versão 0.18.0, a matriz de recursos marca a descodificação especulativa como compatível com o preenchimento em pedaços e o caching de prefixos, e a página de descodificação especulativa lista duas incompatibilidades conhecidas: paralelismo de pipeline através da versão 0.15.0, e especulação de modelo de projeto através da versão 0.10.0. Para o próprio projecto de método, a definição padrão para 2026 é frequentemente EAGLE-3 (`"method": "eagle3"`), abrangida pela fase 17 · 05.

### Números que você deve lembrar

- Llama 3.3 70B FP8, H100 SXM5, 128 simultâneos, todos os três em: 2.200-2.400 tok/s.
- O modelo é o mesmo, vLLM padrão (sem preenchimento em pedaços): ~1.800 tok/s.
- O mesmo modelo, o ciclo PyTorch avançado ingênuo: ~600 tok/s.
- Resíduos de fragmentação de KV no âmbito da PagedAttention na carga de produção: < 4%.
- P99 ITL sob carga mista: ~ 15 ms com preenchimento em pedaços, ~ 50 ms sem.

### Como é que o cronograma

```
while True:
    finished = [s for s in RUNNING if s.is_done()]
    for s in finished: release_blocks(s); RUNNING.remove(s)

    while WAITING and have_free_blocks_for(WAITING[0]):
        s = WAITING.pop(0)
        allocate_initial_blocks(s)
        RUNNING.append(s)

    # schedule prefill chunks + decode in one batch
    batch = []
    for s in RUNNING:
        if s.in_prefill:
            batch.append(next_prefill_chunk(s))   # e.g. 512 tokens
        else:
            batch.append(decode_one_token(s))     # 1 token

    run_forward(batch)                            # one fused GPU call
```

`code/main.py`É exatamente esse ciclo no stdlib Python com contagens de tokens falsas e latência avançada falsa.

```figure
tensor-parallel
```

## Usá-lo

`code/main.py`Simula um programação de estilo vLLM com recursos com alternância.

- `NAIVE`modo: uma solicitação por vez, sem lotes.
- `STATIC`modo: pad e espera, batchagem clássica.
- `CONTINUOUS`Modo: admissão e liberação a nível de iteração.
- `CONTINUOUS + CHUNKED`modo: preencher as fatias entrelaçadas com decodificação.

A saída mostra o rendimento total (tokens por segundo virtual), média TTFT e P99 ITL.`CONTINUOUS + CHUNKED`A linha deve dominar o tráfego misto.

## Envia-o

Esta lição produz`outputs/skill-vllm-scheduler-reader.md`. Dada uma configuração de serviço ( tamanho de lote, utilização de memória KV, tamanho de preenchimento em pedaços, configuração especulativa), produz um diagnóstico de cronograma que indica quais dos três padrões são os gargalos de engarrafamento e quais a ajustar.

## Exercícios

1. Corra .`code/main.py`- Comparar .`STATIC`- Não .`CONTINUOUS`Em que se deve a diferença de rendimento entre a eficiência de preenchimento, a eficiência de decodificação ou a latência de cauda?
2. Modificar o cronograma de brinquedos para adicionar `--max-num-batched-tokens`Qual é o valor correto para um H100 com Llama 3.3 70B FP8? (Punta: é uma função do tamanho do bloco KV e do número de blocos livres, não de HBM bruto).
3. Leia novamente as notas de lançamento do vLLM v0.18.0. Que combinações de bandeiras são mutuamente exclutivas?
4. Calcule o desperdício de fragmentação do cache KV para uma traça de 1.000 solicitações com 1500 tokens de saída médias, std 600 tokens, sob (a) alocação contígua por solicitação em 8192 max, (b) PagedAttention com blocos de 16 tokens.
5. Explique num parágrafo por que o preenchimento em pedaços ajuda o P99 ITL mas não a produção isolada.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| PagedAttention | "the KV trick" | Fixed-size block allocator for KV cache; fragmentation <4% |
| Block table | "the page table" | Per-sequence map from logical token position to physical KV block |
| Continuous batching | "dynamic batching, but right" | Admit/release decisions made every decode iteration |
| Chunked prefill | "prefill splitting" | Break long prefill into 512-token slices interleaved with decode |
| TTFT | "first token time" | Prefill + queue + network; dominated by prefill at long prompts |
| ITL | "inter-token latency" | Time between consecutive decode tokens; dominated by batch size |
| Goodput | "throughput that meets SLO" | Requests/sec that still hit TTFT and ITL targets (Phase 17 · 08 reports it as the share of requests) |
| V1 scheduler | "the new scheduler" | vLLM's 2026 scheduler; runs continuous batching with chunked prefill |
| `--gpu-memory-utilization` | "the memory knob" | Fraction of HBM reserved for KV blocks after weights and activations |

## Mais leitura

- [vLLM documentation — Speculative Decoding](https://docs.vllm.ai/en/latest/features/spec_decode/) fonte oficial sobre compatibilidade com preenchimento em pedaços e decodificação especulativa.
- [vLLM Release Notes (NVIDIA)](https://docs.nvidia.com/deeplearning/frameworks/vllm-release-notes/index.html) 2026 liberação de cadência e comportamento específico de versão.
- [vLLM Blog — PagedAttention](https://blog.vllm.ai/2023/06/20/vllm.html) o texto original que ainda define como pensar sobre o alocador.
- [PagedAttention paper (arXiv:2309.06180)](https://arxiv.org/abs/2309.06180) Análise de fragmentação e projeto de programação.
- [Aleksa Gordic — Inside vLLM](https://www.aleksagordic.com/blog/vllm) A programação detalhada do V1 com gráficos de chama.
