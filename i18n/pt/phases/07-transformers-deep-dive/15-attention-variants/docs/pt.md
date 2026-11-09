# Atenção Variantes  Janela deslizante, Sparse, Diferencial

> A atenção total é um círculo. Cada token vê cada token, e a memória paga o preço.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 03 (Multi-Head), Phase 7 · 12 (KV Cache / Flash Attention)
**Time:** ~60 minutes

## O problema

Custos de atenção total $O(N^2)$Memória e $O(N^2)$Para um Llama 3 70B de 128K de contexto que é 16 bilhões de entradas de atenção por camada, vezes 80 camadas.$O(N^2)$Memória de ativação, mas não altera o custo aritmético  cada token ainda atende a cada outro token.

Três classes de variantes mudam a topologia da própria matriz de atenção:

1. **Sliding window attention (SWA).**Cada token atende a uma janela fixa de vizinhos, não o prefixo completo.$O(N \cdot W)$onde$W$Gemma 2/3, as primeiras camadas do Mistral 7B, Phi-3-Long.
2. **Sparse / block attention.**Apenas pares selecionados `(i, j)`O resto é forçado a zero peso. Longformer, BigBird, OpenAI transformador esparso.
3. **Differential attention.**Compute dois mapas de atenção com projeções Q/K separadas, subtraia um do outro. Mata o "sink de atenção" que sangra o peso dos primeiros tokens.

Estes coexistem. Um modelo de fronteira de 2026 muitas vezes os mistura: a maioria das camadas são SWA-1024, cada quinta é atenção global completa, e um punhado são cabeças diferenciais que limpam a recuperação.

## O conceito

### Atenção à janela deslizante (SWA)

Cada consulta em posição $i$Assegura apenas posições em $[i - W, i]$(SWA causal) ou $[i - W/2, i + W/2]$Os tokens fora da janela vão ficar$-\infty$na matriz de pontuação.

```
full causal:           sliding window (W=4):
positions 0-7          positions 0-7, W=4
    0 1 2 3 4 5 6 7        0 1 2 3 4 5 6 7
0 | x                0 |  x
1 | x x              1 |  x x
2 | x x x            2 |  x x x
3 | x x x x          3 |  x x x x
4 | x x x x x        4 |    x x x x
5 | x x x x x x      5 |      x x x x
6 | x x x x x x x    6 |        x x x x
7 | x x x x x x x x  7 |          x x x x
```

Para o$N = 8192$E ...$W = 1024$, a matriz de pontuação tem 1024 × 8192 linhas não-zero na expectativa  uma redução de 8 ×.

**KV cache shrinks with SWA.**Só o último .$W$Para uma configuração Gemma-3-ish (1024 janela, contexto 128K), o cache KV cai 128x.

**Quality cost.**Os transformadores SWA-somente lutam com a recuperação de longo alcance. A solução: intercalar camadas SWA com camadas de atenção plena. Gemma 3 usa 5:1 SWA: global. Mistral 7B usou uma pilha de SWA causal onde a informação "flui para a frente" através de janelas sobrepostas  cada camada estende o campo receptivo efetivo por $W$, e depois`L`camadas que o modelo pode participar `L × W`- Os tokens de volta.

### Atenção de pouca / bloqueio

Escolha um .`N × N`Patrão de esparcia antecipado.

- **Local + strided (OpenAI sparse transformer).**Atender ao último .$W$Tokens mais cada `stride`- O símbolo anterior, capta tanto local como de longo alcance.$O(N \cdot \sqrt{N})$Computação.
- **Longformer / BigBird.**Janela local + um pequeno conjunto de tokens globais (por exemplo `[CLS]`O conteúdo empírico 2x com qualidade correspondente.
- **Native Sparse Attention (DeepSeek, 2025).**Saiba quais blocos de `(Q, K)`- Não há bloqueio zero no núcleo.

A atenção escassa é uma história de engenharia de kernel. A matemática é simples (mascarar a matriz de pontuação); a vitória vem de nunca carregar as entradas zero no SRAM. FlashAttention-3 e a API 2026 FlexAttention fazem padrões escassos personalizados de primeira classe no PyTorch.

### Atenção Diferencial (Transformador DIFF, 2024)

A atenção regular tem um problema de "desintoxicação da atenção": softmax força cada linha a somar a 1, então os tokens que não querem atender a nada em particular despejam peso no primeiro token (ou os primeiros).

A atenção diferencial corrige isto computacional .**two**mapas de atenção e subtração:

```math
\begin{aligned}
A_1 &= \mathop{\mathrm{softmax}}(Q_1 K_1^T / \sqrt{d}) \\
A_2 &= \mathop{\mathrm{softmax}}(Q_2 K_2^T / \sqrt{d}) \\
\text{DiffAttn} &= (A_1 - \lambda \cdot A_2) V
\end{aligned}
```

onde$\lambda$A1 capta pesos reais de conteúdo; A2 capta o lavatório. A subtração cancela o lavatório, realoca o peso para tokens relevantes.

Resultados relatados (Microsoft 2024): 510% menor perplexidade, contexto eficaz 1,52× mais longo no mesmo comprimento treinado, recuperação mais nítida de agulha em palha de feno.

### Comparação variável

| Variant | Compute | KV cache | Quality vs full | Production use |
|---------|---------|----------|-----------------|----------------|
| Full attention | $O(N^2)$ | $O(N)$ per layer | baseline | every model's default layer |
| SWA (window 1024) | $O(N \cdot W)$ | $O(W)$ per layer | -0.1 ppl, good with global layers | Gemma 2/3, Phi-3-Long |
| Local + strided sparse | $O(N \cdot \sqrt{N})$ | mixed | similar to SWA | OpenAI sparse transformer, Longformer |
| BigBird (local + global + random) | $O(N)$ approx | mixed | matches full at 2× context | early long-context BERT |
| Native Sparse (DeepSeek-V3.2) | $O(N \cdot \text{active fraction})$ | $O(N)$ | within 0.05 ppl | DeepSeek-V3.2, 2025 |
| Differential | $O(2 \cdot N^2)$ | $O(2N)$ | -5 to -10% ppl | DIFF Transformer, early 2026 models |

```figure
gqa-kv-sharing
```

## Construí-lo

Veja .`code/main.py`, ou seu porto de Rust `code/main.rs`Para executar a versão Rust:`rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson`Implementamos um comparador de máscaras causais que mostra atenção completa, SWA, local+strided e diferencial lado a lado numa sequência de brinquedos.

### Passo 1: máscara causal completa (linha de base)

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

Linha de base da lição 07. Triangular inferior; peso zero acima da diagonal.

### Passo 2: Máquina de deslizar a janela

```python
def swa_mask(n, window):
    M = [[float("-inf")] * n for _ in range(n)]
    for i in range(n):
        lo = max(0, i - window + 1)
        for j in range(lo, i + 1):
            M[i][j] = 0.0
    return M
```

Um parâmetro  `window`- Para o ...`window >= n`Recuperamos a atenção causal completa.`window = 1`Cada token serve apenas a si mesmo.

### Passo 3: local + mascarinha esporádica

```python
def strided_mask(n, window, stride):
    M = [[float("-inf")] * n for _ in range(n)]
    for i in range(n):
        lo = max(0, i - window + 1)
        for j in range(lo, i + 1):
            M[i][j] = 0.0
        for j in range(0, i + 1, stride):
            M[i][j] = 0.0
    return M
```

Janela local densa mais cada `stride`O campo receptor cresce em etapas de registro com camadas adicionais.

### Passo 4: atenção diferenciada

```python
def diff_attention(Q1, K1, Q2, K2, V, lam):
    A1 = softmax_causal(Q1 @ K1.T / sqrt_d)
    A2 = softmax_causal(Q2 @ K2.T / sqrt_d)
    return (A1 - lam * A2) @ V
```

Em dois passos de atenção, subtrair com um coeficiente de mistura aprendido. No código comparamos o mapa de calor de atenção-sincação de único versus diferencial e observamos o colapso do sinca.

### Passo 5: Tamanhos do cache KV

Imprimir o tamanho do cache por camada em $N = 131072$A diferença é de 10 a 100 vezes, o que significa que a diferença é de 2 a 5 vezes, e que a diferença é de 2 a 5 vezes.

## Usá-lo

Padrões de produção de 2026:

```python
from transformers import AutoModelForCausalLM
# Gemma 3 mixes SWA (window=1024) and global layers at 5:1.
model = AutoModelForCausalLM.from_pretrained("google/gemma-3-27b-it")
# print(model.config.sliding_window, model.config.layer_types)
```

FlexAttention em PyTorch 2.5+ aceita uma função de máscara:

```python
from torch.nn.attention.flex_attention import flex_attention, create_block_mask

def swa_pattern(b, h, q_idx, kv_idx):
    return (q_idx - kv_idx < 1024) & (q_idx >= kv_idx)

mask = create_block_mask(swa_pattern, B=batch, H=heads, Q_LEN=n, KV_LEN=n)
out = flex_attention(q, k, v, block_mask=mask)
```

Isso se compilou para um kernel Triton personalizado. Dentro de 10% da velocidade FlashAttention-3 para padrões comuns, e a função de máscara é um Python chamada.

**When to pick each:**

- **Pure full attention** cada camada até ~ 16K contexto, ou quando a qualidade de recuperação é primordial.
- **SWA + global mix** longo contexto (> 32K), formação e inferência ligada à memória.
- **Sparse block attention** kernel personalizado, padrão personalizado. Reservado para cargas de trabalho especializadas (recuperar, áudio).
- **Differential attention** qualquer carga de trabalho em que a contaminação do sumidouro de atenção dói (RAG de longo contexto, agulha em manto de feno).

## Envia-o

Veja .`outputs/skill-attention-variant-picker.md`A competência seleciona uma topologia de atenção para um novo modelo, dada a extensão do contexto-alvo, as exigências de recuperação e o perfil de computação de formação/inferência.

## Exercícios

1. **Easy.**Corra .`code/main.py`Verificar o SWA em`window=4`- Verifica tudo fora dos últimos 4 tokens por linha.`window=n`Reproduz a atenção causal completa de forma bit-identical.
2. **Medium.**Implementar a SWA causal com `window=1024`Treinar por 1000 passos no Tinyshakespeare, quanto é a perda de valor contra a atenção plena?
3. **Hard.**Implemente uma mistura de camadas 5:1 de estilo Gemma-3 (5 SWA, 1 global) no modelo de pedra angular. Comparar perda, memória e qualidade de geração contra linhas de base de SWA pura e global pura em parâmetros correspondentes.
4. **Hard.**Implementar a atenção diferenciada com um aprendiz $\lambda$A formação de um trabalho de recuperação sintética (uma agulha, 2.000 distractores).

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Sliding window attention (SWA) | "Local attention" | Each query attends to its last $W$ tokens; KV cache shrinks to $O(W)$. |
| Effective receptive field | "How far back the model sees" | In an $L$-layer SWA stack with window $W$, up to $L \times W$ tokens. |
| Longformer / BigBird | "Local + global + random" | Sparse patterns with a few always-attending global tokens; early long-context approach. |
| Native Sparse Attention | "DeepSeek's kernel trick" | Learn block-level sparsity; skip zero blocks at the kernel level while keeping quality. |
| Differential attention | "Two maps, one subtracts" | DIFF Transformer: subtract a learned $\lambda$ times a second attention map from the first to cancel attention sinks. |
| Attention sink | "Weight bleeds to token 0" | Softmax normalization forces rows to sum to 1; uninformative queries dump weight on position 0. |
| FlexAttention | "Mask-as-Python" | PyTorch 2.5+ API that compiles arbitrary mask functions into FlashAttention-shape kernels. |
| Layer type mix | "5:1 SWA-to-global" | Interleave sparse and full attention layers in a stack to keep quality at lower memory. |

## Mais leitura

- [Beltagy, Peters, Cohan (2020). Longformer: The Long-Document Transformer](https://arxiv.org/abs/2004.05150) o papel de janela de deslizamento canônico + global-token.
- [Zaheer et al. (2020). Big Bird: Transformers for Longer Sequences](https://arxiv.org/abs/2007.14062)Local + global + aleatório.
- [Child et al. (2019). Generating Long Sequences with Sparse Transformers](https://arxiv.org/abs/1904.10509) Modelo local+passo do OpenAI.
- [Gemma Team (2024). Gemma 2: Improving Open Language Models at a Practical Size](https://arxiv.org/abs/2408.00118) a combinação global de 1:1 SWA.
- [Gemma Team (2025). Gemma 3 technical report](https://arxiv.org/abs/2503.19786) a mistura de 5:1 com a janela =1024 que é agora o manual padrão.
- [Ye et al. (2024). Differential Transformer](https://arxiv.org/abs/2410.05258) papel transformador DIFF.
- [Yuan et al. (2025). Native Sparse Attention](https://arxiv.org/abs/2502.11089) A atenção de disparidade aprendida do DeepSeek-V3.2.
- [PyTorch — FlexAttention blog and docs](https://pytorch.org/blog/flexattention/) Referência API para o padrão de mascaras como chamáveis em Use It.
