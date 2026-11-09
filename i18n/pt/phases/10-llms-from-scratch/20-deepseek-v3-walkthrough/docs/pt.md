# Processo de Arquitetura DeepSeek-V3

> Fase 10 · Lição 14 nomeou os seis botões arquitetônicos que cada modelo aberto vira. DeepSeek-V3 (dezembro de 2024, 671B parâmetros totais, 37B ativo) vira todos os seis e adiciona mais quatro: Atenção Latente Multi-Head, equilíbrio de carga auxiliar sem perda, Predicção Multi-Token e treinamento DualPipe. Esta lição lê a arquitetura do DeepSeek-V3 de cima para baixo e deriva cada contagem de parâmetros da configuração publicada. No final, você pode explicar por que a taxa 671B/37B é a aposta certa e por que MLA + MoE juntos vencem sozinhos na fronteira.

**Type:** Learn
**Languages:** Python (stdlib, parameter calculator), Rust
**Prerequisites:** Phase 10 · 14 (open-model walkthroughs), Phase 10 · 17 (NSA), Phase 10 · 18 (MTP), Phase 10 · 19 (DualPipe)
**Time:** ~75 minutes

## Objetivos de aprendizagem

- Leia a configuração DeepSeek-V3 de cima para baixo e explique cada campo em termos dos seis botões GPT-2 mais quatro adições específicas do DeepSeek.
- Derivar a contagem total de parâmetros (671B), a contagem de parâmetros ativos (37B) e os componentes que contribuem para cada um.
- Calcule a pegada de cache KV do MLA em contexto de 128k e compare com o que um modelo denso de paramétricos com GQA paga.
- Indique as quatro inovações específicas do DeepSeek (MLA, MTP, roteamento auxiliar sem perda, DualPipe) e nomear qual parte da pilha de arquitetura/formação é alvo de cada uma delas.

## O problema

DeepSeek-V3 é o primeiro modelo aberto de fronteira cuja arquitetura é significativamente diferente da família Llama. Llama 3 405B é "GPT-2 com seis botões girados". DeepSeek-V3 é GPT-2 com todos os seis botões mais quatro. Ler a configuração Llama 3 é um aquecimento para ler a configuração DeepSeek, mas a estrutura profunda  a forma do bloco de atenção, a lógica de roteamento, o objetivo de treinamento  é diferente o suficiente para que você precise de uma passagem separada.

A rede de treinamento de 2026 está copiando a arquitetura. Entender que é uma mesa de apostas para qualquer papel que toque treinamento de LLM de fronteira ou inferência.

## O conceito

### O núcleo invariante, novamente

DeepSeek-V3 ainda é autoregressivo. Ele ainda apila blocos de decodificador. Cada bloco ainda tem atenção mais MLP mais dois RMSNorms. Ele ainda usa SwiGLU no MLP. Ele ainda usa RoPE. Pre-norma. Embedings ligados ao peso. A mesma linha de base como todos os Llama ou Mistral.

### A mudança: MLA em vez de GQA

A partir da fase 10 · 14 você sabe que o GQA reduz o cache KV dividindo K e V entre grupos de cabeças Q. A atenção latente multi-cabeça (MLA) vai mais longe: K e V são comprimidos em uma representação latente de baixo nível compartilhada (a `kv_lora_rank`O cache KV armazena apenas o latente  normalmente 512 flutuantes por token por camada, não 8 x 128 = 1024 flutuantes.

Em contexto de 128k, DeepSeek-V3 com MLA (um latente compartilhado `c^{KV}`por token por camada; K e V são ambos derivados deste latente através de projeções ascendentes que podem ser absorvidas no matmul subsequente):

```
kv_cache = num_layers * kv_lora_rank * max_seq_len * bytes_per_element
         = 61 * 512 * 131072 * 2
         = 7.6 GB
```

Uma linha de base hipotética de GQA (forma de Llama 3 70B, cabeças de 8 KV, cabeças de 128) pagaria:

```
kv_cache = 2 * 61 * 8 * 128 * 131072 * 2
         = 30.5 GB
```

O MLA é 4 vezes menor do que um cache GQA de estilo Llama-3-70B em contexto de 128k.

O tradeoff: MLA adiciona um passo de descompressão por computação de atenção (por cabeça). O cálculo extra é pequeno em comparação com a largura de banda salvada.

### A rota: equilíbrio de carga sem perda auxiliar

Os roteadores MoE decidem quais especialistas top-k processam cada token. Um roteador ingênuo concentra muito trabalho em alguns especialistas, deixando outros inativos.

O DeepSeek-V3 introduz um esquema auxiliar sem perdas.`e`- O que é o problema?`bias_e`Se estiver subcarregado, aumenta-o. Sem perdas adicionais. O treino permanece limpo.

Efeito sobre a perda principal: nenhuma medível. Efeito sobre a arquitetura do MoE: limpar, sem hiperparâmetro auxiliar de perda para ajustar.

### O MTP: formação mais densa + projecto livre

A partir da fase 10 · 18 você sabe que DeepSeek-V3 adiciona o módulo D=1 MTP que prevê o token duas posições à frente. Na inferência, o módulo treinado é reutilizado como um rascunho de decodificação especulativa com aceitação de 80%+.

Parâmetros: 14B em cima do 671B principal.

### O treinamento: DualPipe

A partir da fase 10 · 19 você sabe que DualPipe é um pipeline bidirecional que se sobrepõe para frente e para trás com pedaços de comunicações transversais. Na escala 2,048-H800 do DeepSeek-V3, ele recupera aproximadamente 245k horas de GPU que 1F1B teria perdido para bolhas de pipeline.

### A configuração, campo por campo

Aqui está a configuração DeepSeek-V3 (simplificada):

```
hidden_size: 7168
intermediate_size: 18432   (dense MLP hidden size, used on first few layers)
moe_intermediate_size: 2048 (expert MLP hidden size)
num_hidden_layers: 61
first_k_dense_layers: 3    (first 3 layers use dense MLP)
num_attention_heads: 128
num_key_value_heads: 128   (formally equal to num_heads under MLA, but
                           the real compression is in kv_lora_rank)
kv_lora_rank: 512          (MLA latent dimension)
num_experts: 256            (MoE expert count per block)
num_experts_per_tok: 8      (top-8 routing)
shared_experts: 1           (always-on shared expert per block)
max_position_embeddings: 163840
rope_theta: 10000.0
vocab_size: 129280
mtp_module: 1               (1 MTP module at depth 1)
```

Partilha:

- `hidden_size=7168`: dimensão de inserção.
- `num_hidden_layers=61`: profundidade total do bloco.
- `first_k_dense_layers=3`Os primeiros 3 blocos utilizam um MLP denso de tamanho 18432.
- `num_attention_heads=128`: 128 cabeças de consulta.
- `kv_lora_rank=512`: K e V são comprimidos para esta dimensão latente e descomprimidos por cabeça.
- `num_experts=256, num_experts_per_tok=8`Cada bloco do MoE tem 256 especialistas, rotas no topo-8.
- `shared_experts=1`Para além dos 256 especialistas enrutados, um especialista sempre presente contribui para cada token.
- `moe_intermediate_size=2048`A maior parte dos casos de PMA é de um tipo de PMA, mas o maior número de PMA é de um tipo de PMA.

### Contabilidade de parâmetros

O cálculo completo está em`code/main.py`O título:

- Incorporar: `vocab * hidden = 129280 * 7168 = ~0.93B`- Não .
- Os primeiros 3 blocos densos: atenção com MLA (~84M por bloco na contagem simplificada da calculadora) + MLP SwiGLU denso (`3 * 7168 * 18432 = ~396M`- a taxa de redução de custos de produção,
- 58 blocos de MoE: atenção com MLA (~84M) + 256 especialistas encaminhados (`3 * 7168 * 2048 = ~44M`A taxa de referência é de 1,00%, a taxa de referência é de 2,0%, a taxa de referência é de 2,0%, a taxa de referência é de 2,0%, a taxa de referência é de 3,0%, a taxa de referência é de 4,0%, a taxa de referência é de 4,0%, a taxa de referência é de 4,0%, a taxa de referência é de 4,0%, a taxa de referência é de 4,0%, a taxa de referência é de 4,0%, a taxa de referência é de 4,0%, a taxa de referência é de 4,0%, a taxa de referência é de 4,0%, a taxa de referência é de 4,0%, a taxa de referência é de 4,0%, a taxa de referência é de 4,0%, a taxa de referência é de 5,0%, a taxa de referência é de 5,0%, a taxa de 0,0%, a taxa de 0,0%, a taxa de 0,0%, a taxa de 0,0%, a taxa de 0,0%, a taxa de 0,0%, a taxa de 0,0%, a taxa de 0,0%, a taxa de 0,0%, a taxa de 0,9%.
- MTP: o módulo publicado é 14B. A calculadora utiliza um stand-in denso de ~0,8B.

O ponto de controle Hugging Face é 685B porque adiciona o módulo 14B MTP no topo do 671B. A diferença restante de ~1% vem de simplificações: a calculadora salta as dimensões RoPE descopladas em MLA, a cabeça de saída desligada e alguns pequenos tensores.

Parâmetros ativos por forward:

- Atenção: 84M por camada * 61 = ~5,1B (todas as camadas de fogo).
- MLP ativo: as primeiras 3 camadas densas (`3 * 396M = ~1.2B`), 58 camadas de MoE cada uma activa com 8 roteados + 1 especialista compartilhado (`9 * 44M = ~396M`Por camada, cerca de 23B no total.
- Embed + normas: ~ 0,9B.
- Total ativo: ~30B da calculadora em relação ao 37B publicado. A maior parte da lacuna é atenção: MLA completo, com suas dimensões RoPE e cabeças de consulta e chave mais amplas, é maior do que a contagem simplificada. O módulo MTP não conta para o 37B.

### A relação 671B / 37B

O DeepSeek-V3 é o modelo de MoE de fronteira mais escassa que tenha enviado pesos abertos. Mixtral 8x7B com a proporção 13/47 (28%) é muito mais denso. Llama 4 Maverick com a proporção 17B/400B (4.25%) é comparável. A aposta do DeepSeek: em escala de fronteira, mais especialistas com menor taxa de ativação produzem melhor qualidade por FLOP ativo.

### Onde fica o DeepSeek-V3

| Model | Total | Active | Ratio | Attention | Novel ideas |
|-------|------|-------|-------|-----------|-------------|
| Llama 3 70B | 70B | 70B | 100% | GQA 64/8 | — |
| Llama 4 Maverick | 400B | 17B | 4.25% | GQA | — |
| Mixtral 8x22B | 141B | 39B | 27% | GQA | — |
| DeepSeek V3 | 671B | 37B | 5.5% | MLA 512 | MLA + MTP + aux-free + DualPipe |
| Qwen 2.5 72B | 72B | 72B | 100% | GQA 64/8 | YaRN extension |

### A seguir: R1, V4

DeepSeek-R1 (2025) é uma corrida de treinamento de raciocínio na espinha dorsal V3. R1 usa a mesma arquitetura. O que mudou é a receita pós-treino (RL em grande escala em tarefas verificáveis), não a arquitetura pré-treino.

O DeepSeek-V4 (se for enviado) deve manter MLA + MoE + MTP e adicionar DSA (DeepSeek Sparse Attention), o sucessor da NSA da Fase 10 · 17.

```figure
moe-routing
```

## Usá-lo

`code/main.py`É a calculadora de parâmetros especializada na forma do DeepSeek-V3.

O que ver:

- Contagem total de parâmetros vs. 671B publicado.
- Contagem de parâmetros ativos vs. publicado 37B.
- O cache KV em contexto de 128k  a comparação MLA vs GQA.
- Desagregação por camada para ver onde o orçamento de parâmetros realmente vai.

## Envia-o

Esta lição produz`outputs/skill-deepseek-v3-reader.md`. Dado um modelo da família DeepSeek (V3, R1 ou qualquer variante futura), ele produz uma leitura de arquitetura componente por componente que nomeia cada campo da configuração, deriva os números de parâmetros por componente e identifica quais das quatro inovações específicas do DeepSeek o modelo usa.

## Exercícios

1. Corra .`code/main.py`- Compare a estimativa do parâmetro total da calculadora com a 671B publicada e identifique a origem do delta.

2. Modifique a configuração para usar MLA rank 256 em vez de 512. Calcule o tamanho do cache KV resultante em contexto de 128k. Que redução percentual compra e a que custo para a expressividade por cabeça?

3. Compare o roteamento do DeepSeek-V3 (256 especialistas, top-8) com uma variante hipotética (512 especialistas, top-8). Os parâmetros totais crescem; os parâmetros ativos permanecem iguais. O que a capacidade de especialistas extra compra em teoria, e quanto custa na inferência?

4. Leia a Seção 2.1 do relatório técnico DeepSeek-V3 (arXiv:2412.19437) sobre MLA. Explique em três frases por que as matrizes de descompressão K e V podem ser "absorvidas" no matmul subsequente para a eficiência de tempo de inferência.

5. DeepSeek-V3 usa treinamento FP8 para a maioria das operações. Calcule a economia de memória de FP8 vs BF16 para armazenar os pesos 671B. Como isso se cruza com o orçamento de treinamento de tokens 14.8T?

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MLA | "Multi-Head Latent Attention" | Compress K and V into a shared low-rank latent (kv_lora_rank, typically 512), decompress per head on-the-fly; KV cache stores only the latent |
| kv_lora_rank | "MLA compression dim" | The size of the shared latent for K and V; DeepSeek-V3 uses 512 |
| First k dense layers | "Early layers stay dense" | The first few MoE-model layers skip the MoE router and run a dense MLP for stability |
| num_experts_per_tok | "Top-k routing" | How many routed experts fire per token; DeepSeek-V3 uses 8 |
| Shared experts | "Always-on experts" | Experts that process every token regardless of routing; DeepSeek-V3 uses 1 |
| Auxiliary-loss-free routing | "Bias-adjusted load balance" | Per-expert bias terms adjusted during training to keep expert load balanced without adding a loss term |
| MTP module | "Extra prediction head" | Transformer block predicting $t+2$ from $h^{(1)}$ and $E(t+1)$; denser training, free speculative-decoding draft |
| DualPipe | "Bidirectional pipeline" | Training schedule that overlaps forward/backward compute with cross-node all-to-all |
| Active parameter ratio | "Sparsity" | active_params / total_params; DeepSeek-V3 hits 5.5% |
| FP8 training | "8-bit training" | Training storage and many compute ops in FP8; roughly halves memory vs BF16 at a small quality cost |

## Mais leitura

- [DeepSeek-AI — DeepSeek-V3 Technical Report (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437) o documento completo de arquitetura, formação e resultados
- [DeepSeek-V3 model card on Hugging Face](https://huggingface.co/deepseek-ai/DeepSeek-V3) arquivos de configuração e notas de implantação
- [DeepSeek-V2 paper (arXiv:2405.04434)](https://arxiv.org/abs/2405.04434) o antecessor que introduziu MLA
- [DeepSeek-R1 paper (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) o sucessor de formação de raciocínio na arquitetura do V3
- [Native Sparse Attention (arXiv:2502.11089)](https://arxiv.org/abs/2502.11089) a direcção futura da atenção da família DeepSeek
- [DualPipe repository](https://github.com/deepseek-ai/DualPipe) a referência ao calendário de formação
