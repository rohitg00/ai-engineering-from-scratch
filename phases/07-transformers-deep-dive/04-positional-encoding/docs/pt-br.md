# Codificação Posicional — Sinusoidal, RoPE, ALiBi

> Attention é invariante a permutação. "O gato sentou no tapete" e "tapete no sentou gato O" produzem a mesma saída sem sinal posicional. Três algoritmos corrigem — cada um com uma aposta diferente sobre o que "posição" significa.

**Tipo:** Construir
**Linguagens:** Python
**Pré-requisitos:** Fase 7 · 02 (Self-Attention), Fase 7 · 03 (Multi-Head Attention)
**Tempo:** ~45 minutos

## O Problema

Attention de produto escalar escalonado é cega à ordem. A matriz de attention `softmax(Q K^T / √d) V` é computada a partir de similaridades pareadas. Embaralhe as linhas de `X`, as linhas da saída embaralham da mesma forma. Nada dentro da attention se importa com posição.

Isso não é um bug num modelo sacola-de-palavras. Pra linguagem, código, áudio, vídeo — qualquer coisa onde a ordem carrega significado — é fatal.

A solução é injetar posição nos embeddings de alguma forma. Três eras de respostas:

1. **Sinusoidal absoluta** (Vaswani 2017). Soma `sin/cos` da posição ao embedding. Simples, sem aprendizado, extrapola mal além de comprimentos treinados.
2. **RoPE — Embeddings de Posição Rotativa** (Su 2021). Rotaciona vetores Q e K por um ângulo proporcional à posição. Codifica posição *relativa* diretamente no produto escalar. Dominante em 2026.
3. **ALiBi — Attention com Vieses Lineares** (Press 2022). Pula embeddings completamente; adiciona uma penalidade linear por head aos scores de attention baseada em distância. Excelente extrapolação de comprimento.

Em 2026, essencialmente todo modelo open source de ponta usa RoPE: Llama 2/3/4, Qwen 2/3, Mistral, Mixtral, DeepSeek-V3, Kimi. Uns poucos modelos de contexto longo usam ALiBi ou suas variantes modernas. Sinusoidal absoluta é histórica.

## O Conceito

![Sinusoidal absoluta vs rotações RoPE vs viés de distância ALiBi](../assets/positional-encoding.svg)

### Sinusoidal absoluta

Pré-calcule uma matriz fixa `PE` com shape `(max_len, d_model)`:

```
PE[pos, 2i]   = sin(pos / 10000^(2i / d_model))
PE[pos, 2i+1] = cos(pos / 10000^(2i / d_model))
```

Então `X' = X + PE[:N]` antes da attention. Cada dimensão é uma sinusóide em frequência diferente. O modelo aprende a ler posição do padrão de fase. Falha além de `max_len`: nada disse ao modelo o que acontece na posição 2048 quando só viu posições 0–2047.

### RoPE

Rotaciona os vetores Q e K (não embeddings). Pra um par de dimensões `(2i, 2i+1)`:

```
[q'_2i    ]   [ cos(pos·θ_i)  -sin(pos·θ_i) ] [q_2i   ]
[q'_2i+1  ] = [ sin(pos·θ_i)   cos(pos·θ_i) ] [q_2i+1 ]

θ_i = base^(-2i / d_head),  base = 10000 by default
```

Aplica a mesma rotação às keys com posição `pos_k`. O produto escalar `q'_m · k'_n` se torna uma função apenas de `(m - n)`. Ou seja: **o score de attention depende só da distância relativa**, mesmo que a rotação tenha sido calculada a partir de posições absolutas. Truque lindo.

Estendendo RoPE: `base` pode ser escalado (NTK-aware, YaRN, LongRoPE) pra extrapolar pra contextos mais longos sem retreinar. Llama 3 estendeu de 8K para 128K de contexto assim.

### ALiBi

Pula o truque de embedding. Aplica vieses diretamente nos scores de attention:

```
attn_score[i, j] = (q_i · k_j) / √d  -  m_h · |i - j|
```

Onde `m_h` é uma inclinação eespecificaçãoífica de head (ex: `1 / 2^(8·h/H)`). Tokens mais próximos ganham boost; tokens distantes são penalizados. Sem custo de treinamento. O paper mostra que extrapolação de comprimento vence sinusoidal e empata com RoPE no comprimento original treinado.

### O que escolher em 2026

| Variante | Extrapolação | Custo de treinamento | Usado por |
|----------|-------------|---------------------|-----------|
| Sinusoidal absoluta | ruim | grátis | transformer original, BERT antigo |
| Aprendido absoluto | nenhum | minúsculo | GPT-2, GPT-3 |
| RoPE | bom com escalonamento | grátis | Llama 2/3/4, Qwen 2/3, Mistral, DeepSeek-V3, Kimi |
| RoPE + YaRN | excelente | fine-tuning | Qwen2-1M, Llama 3.1 128K |
| ALiBi | excelente | grátis | BLOOM, MPT, Baichuan |

RoPE venceu porque se encaixa na attention sem mudar a arquitetura, codifica posição relativa, e seu hiperparâmetro `base` dá um controle limpo pra fine-tuning de contexto longo.

## Construindo

### Passo 1: codificação sinusoidal

Veja `code/main.py`. Computação de 4 linhas:

```python
def sinusoidal(N, d):
    pe = [[0.0] * d for _ in range(N)]
    for pos in range(N):
        for i in range(d // 2):
            theta = pos / (10000 ** (2 * i / d))
            pe[pos][2 * i]     = math.sin(theta)
            pe[pos][2 * i + 1] = math.cos(theta)
    return pe
```

Adicione isso à matriz de embedding antes da primeira camada de attention.

### Passo 2: RoPE aplicado a Q, K

RoPE opera inplace em Q e K. Pra cada par de dimensões:

```python
def apply_rope(x, pos, base=10000):
    d = len(x)
    out = list(x)
    for i in range(d // 2):
        theta = pos / (base ** (2 * i / d))
        c, s = math.cos(theta), math.sin(theta)
        a, b = x[2 * i], x[2 * i + 1]
        out[2 * i]     = a * c - b * s
        out[2 * i + 1] = a * s + b * c
    return out
```

Crucial: aplica a mesma função na Q na posição `m` e na K na posição `n`. O produto escalar deles pega um fator `cos((m-n)·θ_i)` em cada par de coordenadas. Attention aprende posição relativa de graça.

### Passo 3: inclinações e viés ALiBi

```python
def alibi_bias(n_heads, seq_len):
    # slope_h = 2 ** (-8 * h / n_heads) for h = 1..n_heads
    slopes = [2 ** (-8 * (h + 1) / n_heads) for h in range(n_heads)]
    bias = []
    for m in slopes:
        row = [[-m * abs(i - j) for j in range(seq_len)] for i in range(seq_len)]
        bias.append(row)
    return bias  # add to attention scores before softmax
```

Adicione `bias[h]` à matriz de scores de attention `(seq_len, seq_len)` da head `h`, depois softmax.

### Passo 4: verificar a propriedade de distância relativa do RoPE

Escolha dois vetores aleatórios `a, b`. Rotacione por `(pos_a, pos_b)`. Depois por `(pos_a + k, pos_b + k)`. Ambos os produtos escalares devem combinar dentro de erro de ponto flutuante. Essa propriedade é o objetivo do RoPE — é invariante ao offset absoluto, só a diferença relativa importa.

## Usando

PyTorch 2.5+ vem com utilitários de RoPE em `torch.nn.functional`. A maioria do código de produção usa `flash_attn` ou `xformers` onde RoPE é aplicada dentro do kernel de attention.

```python
from transformers import AutoModel
model = AutoModel.from_pretrained("meta-llama/Llama-3.2-3B")
# model.config.rope_scaling → {"type": "yarn", "factor": 32.0, "original_max_position_embeddings": 8192}
```

**Truques de contexto longo em 2026:**

- **Interpolação NTK-aware.** Redimensiona `base` para `base * (scale_factor)^(d/(d-2))` ao estender de 4K para 16K+.
- **YaRN.** Interpolação mais inteligente que preserva entropia da attention em contextos longos. Llama 3.1 128K usa.
- **LongRoPE.** Método da Microsoft de 2024 que usa busca evolutiva pra escolher fatores de escala por dimensão. Phi-3-Long usa.
- **Interpolação de posição + fine-tuning.** Simplesmente encolhe posições pelo fator de extensão e faz fine-tuning por 1–5B tokens. Surpreendentemente eficaz.

## Entregando

Veja `outputs/skill-positional-encoding-picker.md`. A skill escolhe uma estratégia de codificação pra um novo modelo dado comprimento alvo de contexto, necessidades de extrapolação e orçamento de treinamento.

## Exercícios

1. **Fácil.** Plote a matriz `PE` sinusoidal como mapa de calor pra `max_len=512, d=128`. Confirme o padrão de "listras ficam mais largas conforme o índice de dimensão cresce".
2. **Médio.** Implemente escalonamento NTK-aware de RoPE. Treine um tiny LM em sequências de comprimento 256, depois teste em comprimento 1024 com e sem escalonamento. Meça perplexidade.
3. **Difícil.** Implemente ALiBi e RoPE no mesmo módulo de attention. Treine um transformer de 4 camadas numa tarefa de cópia com sequências de comprimento 512. Extrapole para 2048 no teste. Compare a degradação.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|------------------------|--------------------------|
| Codificação posicional | "Diz à attention sobre a ordem" | Qualquer sinal adicionado a embeddings ou attention que codifica posição. |
| Sinusoidal | "A original" | `sin/cos` em frequências geométricas adicionadas a embeddings; não extrapola. |
| RoPE | "Embeddings rotativos" | Rotaciona Q, K por ângulo dependente da posição; produto escalar codifica distância relativa. |
| ALiBi | "Truque de viés linear" | Adiciona `-m·\|i-j\|` aos scores de attention; sem embedding, grande extrapolação. |
| base | "O controle do RoPE" | O escalador de frequência no RoPE; aumenta pra estender contexto na inferência. |
| NTK-aware | "Um truque de escalonamento RoPE" | Redimensiona `base` pra que dimensões de alta frequência não sejam comprimidas quando contexto expande. |
| YaRN | "A sofisticada" | Interpolação + extrapolação por dimensão que preserva entropia da attention. |
| Extrapolação | "Funciona além do comprimento treinado" | O esquema de posição consegue servir saída correta além de `max_len` visto no treinamento? |

## Leituras Complementares

- [Vaswani et al. (2017). Attention Is All You Need §3.5](https://arxiv.org/abs/1706.03762) — sinusoidal original.
- [Su et al. (2021). RoFormer: Enhanced Transformer with Rotary Position Embedding](https://arxiv.org/abs/2104.09864) — paper de RoPE.
- [Press, Smith, Lewis (2021). Train Short, Test Long: Attention with Linear Biases Enables Input Length Extrapolation](https://arxiv.org/abs/2108.12409) — ALiBi.
- [Peng et al. (2023). YaRN: Efficient Context Window Extension of Large Language Models](https://arxiv.org/abs/2309.00071) — estado da arte em escalonamento RoPE.
- [Chen et al. (2023). Extending Context Window of Large Language Models via Positional Interpolation](https://arxiv.org/abs/2306.15595) — paper de contexto longo do Meta pra Llama 2.
- [Ding et al. (2024). LongRoPE: Extending LLM Context Window Beyond 2 Million Tokens](https://arxiv.org/abs/2402.13753) — o método da Microsoft usado por Phi-3-Long e citado na seção Usando.
- [HuggingFace Transformers — `modeling_rope_utils.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/modeling_rope_utils.py) — implementações de produção de todos os esquemas de escalonamento RoPE (padrão, linear, dinâmico, YaRN, LongRoPE, Llama-3).
