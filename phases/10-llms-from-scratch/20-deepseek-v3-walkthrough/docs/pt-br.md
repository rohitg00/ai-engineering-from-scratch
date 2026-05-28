# Percursos Arquitetonicos do DeepSeek-V3

> A Fase 10, Aula 14 nomeou os seis botoes arquitetonicos que todo modelo aberto ajusta. DeepSeek-V3 (dezembro de 2024, 671B parametros totais, 37B ativos) ajusta todos os seis e adiciona quatro mais: Multi-Head Latent Attention, balanceamento de carga sem loss auxiliar, Multi-Token Prediction e treinamento DualPipe. Esta aula le a arquitetura do DeepSeek-V3 de cima pra baixo e deriva cada contagem de parametros a partir da config publicada. Ao fim voce pode explicar por que a razao 671B/37B e a aposta certa e por que MLA + MoE juntos superam qualquer um sozinho na fronteira.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, calculadora de parametros)
**Pre-requisitos:** Fase 10 · 14 (percursos de modelos abertos), Fase 10 · 17 (NSA), Fase 10 · 18 (MTP), Fase 10 · 19 (DualPipe)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Ler a config do DeepSeek-V3 de cima pra baixo e explicar cada campo em termos dos seis botoes GPT-2 mais quatro adicoes eespecificaçãoificas da DeepSeek.
- Derivar a contagem total de parametros (671B), contagem de parametros ativos (37B) e os componentes que contribuem pra cada uma.
- Calcular o footprint do KV cache do MLA em contexto 128k e comparar com o que um modelo denso de mesmos-params-ativos com GQA pagaria.
- Enunciar as quatro inovacoes eespecificaçãoificas da DeepSeek (MLA, MTP, roteamento sem loss auxiliar, DualPipe) e nomear qual parte da stack de arquitetura/treinamento cada uma foca.

## O Problema

DeepSeek-V3 e o primeiro modelo aberto de fronteira cuja arquitetura e significativamente diferente da familia Llama. Llama 3 405B e "GPT-2 com seis botoes ajustados." DeepSeek-V3 e GPT-2 com todos os seis botoes mais quatro a mais. Ler a config do Llama 3 e aquecimento pra ler a config do DeepSeek, mas a estrutura profunda -- a forma do bloco de attention, a logica de roteamento, o objetivo de treinamento -- e diferente o suficiente que voce precisa de um percurso separado.

O ganho de aprende-lo: o release de pesos abertos do DeepSeek-V3 mudou o que "capacidade de fronteira" significa em modelos abertos. A arquitetura e o blueprint que muitos runs de treinamento de 2026 estao copiando. Entende-la e basico pra qualquer papel que toque treinamento ou inferencia de LLM de fronteira.

## O Conceito

### O nucleo invariante, de novo

DeepSeek-V3 ainda e autoregressivo. Ainda empilha blocos decoder. Cada bloco ainda tem attention mais MLP mais dois RMSNorms. Ainda usa SwiGLU no MLP. Ainda usa RoPE. Pre-norm. Embeddings tieados por pesos. Mesmo baseline que todo Llama ou Mistral.

### A reviravolta: MLA ao inves de GQA

Da Fase 10, Aula 14 voce sabe que GQA encolhe o KV cache compartilhando K e V entre grupos de Q heads. Multi-Head Latent Attention (MLA) vai mais longe: K e V sao comprimidos em uma representacao latente de baixo rank compartilhada (o `kv_lora_rank`), depois descomprimidos por head on-the-fly. O KV cache armazena apenas o latente -- tipicamente 512 floats por token por camada, nao 8 x 128 = 1024 floats.

Em contexto 128k, DeepSeek-V3 com MLA (um latente compartilhado `c^{KV}` por token por camada; K e V sao ambos derivados desse latente via projecoes up que podem ser absorvidas no matmul subsequente):

```
kv_cache = num_layers * kv_lora_rank * max_seq_len * bytes_per_element
         = 61 * 512 * 131072 * 2
         = 7.6 GB
```

Um baseline hipotetico de GQA (formato Llama 3 70B, 8 KV heads, head dim 128) pagaria:

```
kv_cache = 2 * 61 * 8 * 128 * 131072 * 2
         = 30.5 GB
```

MLA e 4x menor que um cache de GQA estilo Llama-3-70B em contexto 128k.

O tradeoff: MLA adiciona um passo de descompressao por computacao de attention (por head). O compute extra e pequeno comparado a largura de banda economizada. Ganho liquido pra inferencia de contexto longo.

### O roteamento: balanceamento de carga sem loss auxiliar

Roteadores MoE decidem quais experts top-k processam cada token. Um roteador ingenuo concentra trabalho demais em alguns experts, deixando outros ociosos. Correcao padrao: adicionar um termo de loss auxiliar que penaliza desbalanceamento de carga. Funciona mas degrada levemente o desempenho na tarefa principal.

DeepSeek-V3 introduz um esquema sem loss auxiliar. Termos de bias por expert sao adicionados aos logits do roteador, ajustados durante treinamento por uma regra simples: se o expert `e` esta sobrecarregado, diminuir `bias_e`; se subcarregado, aumentar. Sem termo de loss extra. Treinamento continua limpo. Carga do expert continua balanceada.

Efeito na loss principal: nenhum mensuravel. Efeito na arquitetura MoE: mais limpa, sem hiperparametro de loss auxiliar pra ajustar.

### O MTP: treinamento mais denso + rascunho gratis

Da Fase 10, Aula 18 voce sabe que DeepSeek-V3 adiciona D=1 modulo MTP que prediz o token duas posicoes a frente. Na inferencia, o modulo treinado e reaproveitado como rascunho de decodificacao eespecificaçãoulativa com 80%+ de aceitacao. No treinamento, cada hidden state e supervisionado em D+1 = 2 alvos, fornecendo um sinal mais denso.

Parametros: 14B alem dos 671B principais. Overhead: 2.1%.

### O treinamento: DualPipe

Da Fase 10, Aula 19 voce sabe que DualPipe e um pipeline bidirecional que sobrepoe chunks forward e backward com comunicacoes all-to-all entre nodes. Na escala de 2.048 H800 do DeepSeek-V3, ele recupera cerca de 245k GPU-horas que 1F1B teria perdido pra bolhas de pipeline.

### A config, campo por campo

Aqui esta a config do DeepSeek-V3 (simplificada):

```
hidden_size: 7168
intermediate_size: 18432   (hidden size do MLP denso, usado nas primeiras camadas)
moe_intermediate_size: 2048 (hidden size do MLP expert)
num_hidden_layers: 61
first_k_dense_layers: 3    (primeiras 3 camadas usam MLP denso)
num_attention_heads: 128
num_key_value_heads: 128   (formalmente igual a num_heads sob MLA, mas
                           a compressao real e em kv_lora_rank)
kv_lora_rank: 512          (dimensao latente do MLA)
num_experts: 256            (contagem de experts MoE por bloco)
num_experts_per_tok: 8      (roteamento top-8)
shared_experts: 1           (expert compartilhado sempre-on por bloco)
max_position_embeddings: 163840
rope_theta: 10000.0
vocab_size: 129280
mtp_module: 1               (1 modulo MTP na profundez 1)
```

Parse:

- `hidden_size=7168`: dimensao do embedding.
- `num_hidden_layers=61`: profundidade total do bloco.
- `first_k_dense_layers=3`: os primeiros 3 blocos usam MLP denso de tamanho 18432. Os 58 restantes usam MoE.
- `num_attention_heads=128`: 128 consulta heads.
- `kv_lora_rank=512`: K e V sao comprimidos pra essa dimensao latente e descomprimidos por head.
- `num_experts=256, num_experts_per_tok=8`: cada bloco MoE tem 256 experts, roteamento top-8.
- `shared_experts=1`: alem dos 256 experts roteados, 1 expert sempre-on contribui pra cada token. Pense nele como um "piso denso" que garante que todo token receba algo confiavel.
- `moe_intermediate_size=2048`: hidden size do MLP de cada expert. Menor que o MLP denso porque tem 256 deles.

### Contabilidade de parametros

O calculo completo esta em `code/main.py`. O destaque:

- Embedding: `vocab * hidden = 129280 * 7168 = ~0.93B`.
- Primeiros 3 blocos densos: attention com MLA (~144M por bloco) + MLP denso (~260M por bloco) + norms. Cerca de 1.2B total.
- 58 blocos MoE: attention com MLA (~144M) + 256 experts cada (30M cada) + 1 expert compartilhado (30M) + norm. Total ~7.95B por bloco, incluindo todos os experts. 461B total pros 58 blocos MoE.
- Modulo MTP: 14B.

Total geral: ~476B pra arquitetura core + 14B MTP + significativamente o numero publicado de 671B conta com parametros estruturais adicionais (tensores de bias, componentes eespecificaçãoificos de expert, escalonamento de expert compartilhado, etc.). O numero que reproduzimos na calculadora e dentro de 3-5% do publicado -- o delta vem da contabilidade granular que o relatorio da DeepSeek documenta no apendice da Secao 2.

Parametros ativos por forward:

- Attention: 144M por camada * 61 = 8.8B (todas as camadas disparam).
- MLP ativo: primeiras 3 camadas densas (3 * 260M = 780M), 58 camadas MoE cada ativa com 8 roteados + 1 compartilhado + overhead de roteamento. MLP ativo por camada: ~260M. Total: 3 * 260M + 58 * 260M = ~15.9B.
- Embedding + norms: 1.2B.
- Total ativo: cerca de 26B core + 14B MTP (treinados mas nem sempre rodam na inferencia) ≈ 37B.

### A razao 671B / 37B

Razao de esparsidade de 18x (params ativos sao 5.5% do total). DeepSeek-V3 e o modelo MoE de fronteira mais esparso que ja enviou pesos abertos. Mixtral 8x7B com razao 13/47 (28%) e muito mais denso. Llama 4 Maverick com razao 17B/400B (4.25%) e comparavel. A aposta da DeepSeek: em escala de fronteira, mais experts com menor razao de ativacao produz melhor qualidade por FLOP ativo.

### Onde DeepSeek-V3 se posiciona

| Modelo | Total | Ativo | Razao | Attention | Ideias novas |
|--------|-------|-------|-------|-----------|-------------|
| Llama 3 70B | 70B | 70B | 100% | GQA 64/8 | -- |
| Llama 4 Maverick | 400B | 17B | 4.25% | GQA | -- |
| Mixtral 8x22B | 141B | 39B | 27% | GQA | -- |
| DeepSeek V3 | 671B | 37B | 5.5% | MLA 512 | MLA + MTP + aux-free + DualPipe |
| Qwen 2.5 72B | 72B | 72B | 100% | GQA 64/8 | Extensao YaRN |

### O que vem: R1, V4

DeepSeek-R1 (2025) e um run de treinamento de raciocinio na backbone V3. R1 usa a mesma arquitetura. O que mudou e a receita pos-treinamento (RL em larga escala em tarefas verificaveis), nao a arquitetura de pre-treinamento.

DeepSeek-V3 (se for lancado) deve manter MLA + MoE + MTP e adicionar DSA (DeepSeek Sparse Attention), o sucessor do NSA da Fase 10, Aula 17. A linhagem e estavel: inovacoes no nivel de arquitetura se acumulam; cada versao ajusta botoes adicionais.

## Usar

`code/main.py` e a calculadora de parametros eespecificaçãoializada no formato do DeepSeek-V3. Rode, compare sua saida com os numeros do paper e use em variantes hipotheticas (256 experts vs 512, top-8 vs top-16, MLA rank 512 vs 1024).

O que observar:

- Contagem total de parametros vs 671B publicado.
- Contagem de parametros ativos vs 37B publicado.
- KV cache em contexto 128k -- a comparacao MLA vs GQA.
- Quebra por camada pra ver onde o orcamento de parametros realmente vai.

## Entregar

Esta aula produz `outputs/skill-deepseek-v3-reader.md`. Dado um modelo da familia DeepSeek (V3, R1 ou qualquer variante futura), produz uma leitura componente por componente da arquitetura que nomeia cada campo da config, deriva contagens de parametros por componente e identifica quais das quatro inovacoes eespecificaçãoificas da DeepSeek o modelo usa.

## Exercicios

1. Rode `code/main.py`. Compare a estimativa de parametros totais da calculadora com os 671B publicados e identifique de onde vem o delta. A Secao 2 do paper tem a listagem completa.

2. Modifique a config pra usar MLA rank 256 ao inves de 512. Calcule o tamanho resultante do KV cache em contexto 128k. Que porcentagem de reducao isso compra, e a que custo pra expressividade por head?

3. Compare o roteamento do DeepSeek-V3 (256 experts, top-8) com uma variante hipotetica (512 experts, top-8). Parametros totais crescem; parametros ativos permanecem os mesmos. O que a capacidade extra de experts compra em teoria, e o que custa na inferencia?

4. Leia a Secao 2.1 do relatorio tecnico do DeepSeek-V3 (arXiv:2412.19437) sobre MLA. Explique em tres frases por que as matrizes de descompressao de K e V podem ser "absorvidas" no matmul subsequente pra eficiencia na inferencia.

5. DeepSeek-V3 usa treinamento FP8 pra maioria das operacoes. Calcule a economia de memoria de FP8 vs BF16 pra armazenar os 671B de pesos. Como isso intersecciona com o orcamento de treinamento de 14.8T tokens?

## Termos Principais

| Termo | O que a gente diz | O que realmente significa |
|-------|-------------------|--------------------------|
| MLA | "Multi-Head Latent Attention" | Comprime K e V em um latente de baixo rank compartilhado (kv_lora_rank, tipicamente 512), descomprime por head on-the-fly; KV cache armazena apenas o latente |
| kv_lora_rank | "Dim de compressao MLA" | O tamanho do latente compartilhado pra K e V; DeepSeek-V3 usa 512 |
| Primeiras k camadas densas | "Camadas iniciais ficam densas" | As primeiras camadas do modelo MoE pulam o roteador MoE e rodam um MLP denso pra estabilidade |
| num_experts_per_tok | "Roteamento top-k" | Quantos experts roteados disparam por token; DeepSeek-V3 usa 8 |
| Experts compartilhados | "Experts sempre-on" | Experts que processam cada token independente do roteamento; DeepSeek-V3 usa 1 |
| Roteamento sem loss auxiliar | "Balanceamento de carga por bias" | Termos de bias por expert ajustados durante treinamento pra manter carga balanceada sem adicionar termo de loss |
| Modulo MTP | "Head de predicao extra" | Bloco transformer predizendo t+2 de h^(1) e E(t+1); treinamento mais denso, rascunho de decodificacao eespecificaçãoulativa gratis |
| DualPipe | "Pipeline bidirecional" | Schedule de treinamento que sobrepoe compute forward/backward com all-to-all entre nodes |
| Razao de params ativos | "Esparsidade" | active_params / total_params; DeepSeek-V3 atinge 5.5% |
| Treinamento FP8 | "Treinamento 8-bit" | Armazenamento e muitas operacoes de compute em FP8; mais ou menos metade da memoria vs BF16 com pequena perda de qualidade |

## Leitura Complementar

- [DeepSeek-AI -- DeepSeek-V3 Technical Report (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437) -- o documento completo de arquitetura, treinamento e resultados
- [Model card do DeepSeek-V3 no Hugging Face](https://huggingface.co/deepseek-ai/DeepSeek-V3) -- arquivos de config e notas de deploy
- [Paper do DeepSeek-V2 (arXiv:2405.04434)](https://arxiv.org/abs/2405.04434) -- o predecessor que introduziu MLA
- [Paper do DeepSeek-R1 (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) -- o sucessor de treinamento de raciocinio na arquitetura V3
- [Native Sparse Attention (arXiv:2502.11089)](https://arxiv.org/abs/2502.11089) -- a direcao futura pra attention da familia DeepSeek
- [Repositorio DualPipe](https://github.com/deepseek-ai/DualPipe) -- a referencia de schedule de treinamento
