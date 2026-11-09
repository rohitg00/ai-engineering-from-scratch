# Atenção Nativa de Esparça (DepSeek NSA)

> Com 64k tokens, a atenção consome 70-80% da latência de decodificação. Todos os laboratórios abertos têm um plano para consertá-lo. A NSA do DeepSeek (melhor documento ACL 2025) é aquela que ficou preso: três ramos paralelas de atenção  tokens com grãos grosseiros comprimidos, tokens com grãos finos retidos seletivamente, e janelas deslizantes para contexto local  combinadas através de um portão aprendido. É alinhado com hardware (friendly-kernel), nativamente treinável (funciona em pré-treino, não ligado à inferência), e em 64k decodificações ele funciona mais rápido do que FlashAttention enquanto combina ou supera a qualidade de atenção total. Esta lição constrói os três ramos de ponta a ponta e mostra por que a esparsia é diferenciável de ponta a ponta.

**Type:** Build
**Languages:** Python (stdlib), Rust
**Prerequisites:** Phase 7 · 12 (KV cache, flash-attention), Phase 7 · 15 (attention variants), Phase 10 · 16 (differential attention)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Diga os três serviços de atenção da NSA e o que cada um capta.
- Explique por que a NSA é "naturalmente treinável" onde os métodos anteriores de atenção escassa eram apenas inferência.
- Calcule a economia de atenção computacional da NSA versus atenção total em contexto de 64k como função do tamanho do bloco de compressão e da seleção top-k.
- Implementar a combinação de três ramos no stdlib Python em uma curta sequência sintética e verificar o comportamento dos pesos de gating.

## O problema

Atenção total no comprimento da sequência N custos `O(N^2)`tempo e`O(N)`O cache KV por camada. Em tokens 64k, os números de computação e largura de banda de memória são catastróficos. Estimação teórica medida do papel da NSA: a atenção representa 70-80% da latência total de decodificação em 64k. Tudo no downstream  TTFT, tokens / sec, custo por milhão de tokens  é dominado pelo custo da atenção.

Pouca atenção é a resposta óbvia. As tentativas anteriores caem em dois baldes. A esparcidade de padrão fixo (janela deslizante, passo, bloco local) descarta informações e falha em tarefas de recall de longo alcance. A esparcidade de tempo de inferência (KV cache pruning, H2O, StreamingLLM) é aplicada a um modelo pré-treinado em atenção densa e recupera apenas uma fração do potencial aceleramento porque o modelo nunca foi solicitado a encaminhar informações através do padrão esparso.

Native Sparse Attention (Yuan et al., DeepSeek + PKU + UW, ACL 2025 best paper, arXiv:2502.11089) faz ambas as coisas: um padrão de esparcidade que o modelo aprende durante o pré-treino, implementado como um algoritmo alinhado ao kernel que realmente fornece as economias de computação na inferência.

## O conceito

### Três ramos paralelas

Para cada consulta, a NSA corre a atenção três vezes, contra três visualizações diferentes do cache KV:

1. **Compressed branch.**Os tokens são agrupados em blocos de tamanho `l`Cada bloco é comprimido em um único token de resumo através de um pequeno MLP aprendido.

2. **Selected branch.**Usando pontuações de atenção do ramo comprimido, os blocos top-k mais relevantes para a consulta atual são identificados. Tokens de grãos finos (não comprimidos) desses blocos são lidos e a consulta atende a todos eles. Pense na atenção do ramo comprimido como o sinal de roteamento para a seleção.

3. **Sliding-window branch.**A consulta atende aos mais recentes `W`Tokens (tipicamente 512) para contexto local. Este ramo capta os padrões de curto alcance de estrutura pesada (sintaxa, coreferência local) que os outros dois podem perder.

As três saídas de ramificação são combinadas através de um portão de posição aprendido:

```math
\text{out} = g_{\text{cmp}} \cdot \text{out}_{\text{cmp}} + g_{\text{sel}} \cdot \text{out}_{\text{sel}} + g_{\text{win}} \cdot \text{out}_{\text{win}}
```

`g_cmp, g_sel, g_win`Não é necessário somar a 1  podem pesar ramos de forma independente.

### Por que isso é "naturalmente treinável"

O passo de seleção (blocos de topo-k) é discreto. Operações discretas quebram fluxo de gradiente. O trabalho anterior de atenção escassa ou saltou o backprop através da seleção (treino limitante) ou usou relaxações contínuas que não deram escassez real na inferência.

A NSA evita isto: a atenção de ramo comprimido é uma atenção grosseira diferenciável sobre toda a sequência. A operação top-k apenas reutiliza as pontuações de atenção mais altas do ramo comprimido para escolher quais blocos de grãos finos carregar. Os gradientes atingem as pontuações de ramos comprimidos através da própria saída do ramos comprimido, não através da escolha de blocos. Dentro dos blocos escolhidos, a atenção sobre as chaves e valores selecionados é atenção comum, de modo que a sua contribuição para a saída final também é diferenciável. O `top_k`A selecção do índice não obtém nenhum gradiente: só controla quais blocos são carregados da memória.

É por isso que a NSA pode ser usada em pré-treino de ponta a ponta. O modelo aprende a encaminhar informações através dos três ramos em conjunto, produzindo um padrão escasso que, na inferência, realmente entrega a velocidade prometida.

### Núcleo alinhado com hardware

O kernel da NSA é projetado para hierarquias de memória GPU modernas. O kernel carrega consultas por grupos GQA (loop externo), traz os blocos de KV esparsos correspondentes por grupo (loop interno) e dirige a atenção para SRAM. Como cada grupo de consulta vê os mesmos blocos selecionados (a seleção é por grupo de consulta, não por cabeça de consulta), as cargas de KV são amortizadas em todo o grupo.

O artigo relata que os kernels de Triton executam 9 vezes mais rápido do que o FlashAttention em 64k decodificadores, com a taxa de aceleração crescendo com o comprimento da sequência.

### Orçamento de cálculo

Deixe-me .`N`ser o comprimento da sequência, `l`O tamanho do bloco de compressão, `k`o número de seleções de cima-k, `w`a janela deslizante, `b`O tamanho do bloco selecionado (normalmente é igual `l`)).

- Arco comprimido: `O(N/l)`Chaves por consulta, então `O(N * N / l)`- Total.
- Ramo selecionado: `O(k * b)`Chaves por consulta, então `O(N * k * b)`- Não .
- Arranho deslizante: `O(w)`Chaves por consulta, então `O(N * w)`- Não .

Total: `O(N * (N/l + k*b + w))`- Não .

Com o`N = 64k, l = 64, k = 16, b = 64, w = 512`: custo por consulta é `1000 + 1024 + 512 = 2536 keys`- Atenção total é ...`64000 keys`- 25 vezes a redução de cálculo.

Com o`N = 128k, l = 64, k = 16, b = 64, w = 512`: custo por consulta é `2000 + 1024 + 512 = 3536 keys`- Atenção total é ...`128000 keys`O benefício aumenta com o comprimento da sequência, que é o ponto principal.

### Como é que se compara

| Method | Differentiable | Real inference speedup | Long-range recall |
|--------|---------------|----------------------|-------------------|
| Sliding window only | yes | yes | fails |
| Strided / block-sparse | yes | yes | partial |
| KV pruning (H2O, StreamingLLM) | N/A (inference-time) | yes | partial |
| MoBA (Moonshot) | partial | yes | good |
| NSA | yes (natively) | yes (9x at 64k) | matches full attention |

MoBA (Moonshot, arXiv:2502.13189) foi publicado simultaneamente e adota uma abordagem similar de três é melhor do que um, aplicando o princípio de MoE aos blocos de atenção. NSA e MoBA são as duas arquiteturas para saber para 2026 pré-treinamento de longo contexto.

```figure
sliding-window-attention
```

## Construí-lo

`code/main.py`Implementa os três ramos numa curta sequência sintética e mostra:

- A MLP de compressão (uma linha de base simples de média é usada para clareza pedagógica; a NSA real usa uma MLP aprendida).
- A selecção de blocos de cima-k, impulsionada por pontuações de ramos comprimidas.
- A atenção da janela deslizante na última.`w`- Os tokens.
- A combinação fechada.
- Uma impressão de contagem computacional comparada à atenção total.

### Passo 1: comprimir os tokens em blocos

```python
def compress(K, l):
    n = len(K)
    n_blocks = (n + l - 1) // l
    out = []
    for b in range(n_blocks):
        start, end = b * l, min((b + 1) * l, n)
        block = K[start:end]
        summary = [sum(row[d] for row in block) / len(block) for d in range(len(K[0]))]
        out.append(summary)
    return out
```

### Passo 2: Atenção a ramificação comprimida

Execute a atenção de softmax da consulta contra as teclas comprimidas.

### Passo 3: Seleção do bloco superior

Escolha os índices do `k`Blocos comprimidos com maior pontuação. Carregue os tokens originais não comprimidos desses blocos e dê atenção a eles.

### Passo 4: Atenção à janela deslizante

Tome o último .`w`- E a atenção estática contra eles.

### Passo 5: porta + combinação

Uma pequena MLP na consulta produz três pesos de porta. A saída final é uma soma ponderada das três saídas de ramo.

### Passo 6: contagem computacional

Imprimir o número de teclas atendidas por consulta para cada ramo e o total.`N`Em uma sintética com 1024 tokens com`l = 32, k = 4, w = 128`A NSA vê .`32 + 128 + 128 = 288`As chaves por consulta versus 1024 para atenção total  3,5 vezes menos.

## Usá-lo

A NSA está a enviar no próprio DeepSeek de longo contexto de pré-treinamento pipeline.

- **DeepSeek internal**: pesos nativos e publicados utilizam a NSA ou o seu sucessor DSA (Deepseek Sparse Attention).
- **vLLM**: apoio experimental da NSA no desenvolvimento de pesos DeepSeek-V3.x.
- **SGLang**: Os índices de referência da NSA publicados; o caminho de produção segue o VLLM.
- **llama.cpp / CPU**: não suportado; o custo de decomposição do kernel não vale a pena na capacidade de CPU.

Quando contactar a NSA:

- Cursos de pré-formação ou de formação contínua destinados a contextos superiores a 64 000 e com um orçamento de cálculo sério.
- Inferência dos próprios pontos de controlo de longo contexto da DeepSeek.

Quando não:

- Não se pode modernizar a NSA sem treinamento.
- O custo superior de três ramos domina as poupanças.
- Chat interativo de batch 1. Benefícios de decodificação sensível à latência, mas apenas em contextos longos.

## Envia-o

Esta lição produz`outputs/skill-nsa-integrator.md`. Dada uma especificação de execução pré-treinamento de longo contexto, produz um plano de integração NSA: tamanho de bloco de compressão, top-k, janela deslizante, largura de porta MLP, escolha do kernel e as avaliações específicas de longo contexto que justificariam a mudança de arquitetura.

## Exercícios

1. Corra .`code/main.py`- Em um token sintético de 1024 .`(l, k, w)`Identificar o pré-conto que atinge o menor número de chaves por consulta, mantendo 95% de recall contra a atenção total em um teste de agulha-em-pacote de feno.

2. Substitua o compressor de média com um pequeno MLP aprendido (2 camadas, escondidas 32). Treine-o em uma tarefa sintética onde o sinal é a média de um bloco. Mese a diferença de perplexidade contra a linha de base do mean pool em dados mantidos.

3. Implementar o gate MLP. Ele toma a consulta como entrada e sai três escalares. Mostre que o gate se comporta sensatamente: ponderação quase uniforme em consultas aleatórias, peso pesado no ramo selecionado quando a consulta atinge um bloco de trás distante.

4. Calcule o orçamento de memória do cache KV para um modelo 70B habilitado pela NSA em contexto de 128k. Cabeças KV são 8, cabeça dim 128, BF16. Compare com atenção plena e MLA (Fase 10 · 14 mostrou os números do MLA). Identifique o comprimento da sequência onde o cache KV de ramo fino da NSA é igual à atenção completa.

5. Leia a Seção 4 do documento da NSA (arXiv:2502.11089) e explique em três frases por que as pontuações de atenção do ramo comprimido são reutilizadas para a seleção top-k em vez de calcular uma pontuação de roteamento separada.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Compressed branch | "Coarse view" | Attention over block-averaged keys that provides global context in $O(N/l)$ keys per query |
| Selected branch | "Top-k blocks" | Fine-grained attention over the `k` blocks with highest compressed-branch scores |
| Sliding window | "Local context" | Attention over the last `W` tokens for short-range patterns |
| Native trainability | "Pre-train with the sparsity on" | The sparsity pattern is learned during pre-training, not bolted on at inference |
| Compression block size l | "Group size for coarse view" | How many tokens get merged into one summary; 32-64 typical |
| Top-k | "Blocks to keep" | Number of compressed blocks whose uncompressed tokens get read; 16 typical |
| Sliding window W | "Local attention radius" | Typically 512; shorter hurts local coherence, longer wastes compute |
| Branch gate | "How to mix the three" | Per-position MLP output that weights the three branches' contributions |
| Hardware alignment | "Kernel-friendly sparsity" | Sparse pattern chosen so that the actual GPU kernel achieves the theoretical speedup |
| DSA | "NSA's successor" | Deepseek Sparse Attention, the architecture that followed NSA in DeepSeek's lineage |

## Mais leitura

- [Yuan et al. — Native Sparse Attention: Hardware-Aligned and Natively Trainable Sparse Attention (arXiv:2502.11089, ACL 2025 Best Paper)](https://arxiv.org/abs/2502.11089)O papel
- [DeepSeek-V3 Technical Report (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437) os alvos da família de arquiteturas da NSA
- [Moonshot AI — MoBA: Mixture of Block Attention for Long-Context LLMs (arXiv:2502.13189)](https://arxiv.org/abs/2502.13189) Trabalho simultâneo, atenção ao estilo MoE sobre blocos
- [Beltagy et al. — Longformer: The Long-Document Transformer (arXiv:2004.05150)](https://arxiv.org/abs/2004.05150) Origens de janelas deslizantes
- [Xiao et al. — StreamingLLM: Efficient Streaming Language Models with Attention Sinks (arXiv:2309.17453)](https://arxiv.org/abs/2309.17453) A linha de base da escarsidade no tempo de inferência
- [Dao et al. — FlashAttention-2 (arXiv:2307.08691)](https://arxiv.org/abs/2307.08691) a linha de base de atenção completa os núcleos NSA bater em 64k
