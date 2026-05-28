# Variantes de Attention — Sliding Window, Sparse, Differential

> Full attention é um círculo. Cada token vê cada token, e a memória paga o preço. Quatro variantes dobram a forma do círculo e recuperam metade do custo.

**Tipo:** Construir
**Linguagens:** Python
**Pré-requisitos:** Fase 7 · 02 (Self-Attention), Fase 7 · 03 (Multi-Head), Fase 7 · 12 (KV Cache / Flash Attention)
**Tempo:** ~60 minutos

## O Problema

Full attention custa `O(N²)` de memória e `O(N²)` de computação em comprimento de sequência. Para um Llama 3 70B com contexto de 128K, isso são 16 bilhões de entradas de attention por camada, vezes 80 camadas. Flash Attention (Aula 12) esconde a memória de ativação `O(N²)` mas não muda o custo aritmético — cada token ainda attend a todos os outros tokens.

Três classes de variantes mudam a topologia da própria matriz de attention:

1. **Sliding window attention (SWA).** Cada token attend a uma janela fixa de vizinhos, não a todo o prefixo. Memória e computação caem pra `O(N · W)` onde `W` é a janela. Gemma 2/3, primeiras camadas do Mistral 7B, Phi-3-Long.
2. **Sparse / block attention.** Só pares `(i, j)` selecionados recebem score; o resto é forçado a peso zero. Longformer, BigBird, OpenAI sparse transformer.
3. **Differential attention.** Computa dois mapas de attention com projeções Q/K separadas, subtrai um do outro. Elimina o "attention sink" que joga peso nos primeiros tokens. O DIFF Transformer da Microsoft (2024).

Essas coexistem. Um modelo frontier em 2026 frequentemente mistura elas: a maioria das camadas são SWA-1024, cada quinta é full attention global, e umas poucas são differential heads que limpam a recuperação. A proporção 5:1 SWA:global do Gemma 3 é o padrão didático atual.

## O Conceito

### Sliding Window Attention (SWA)

Cada consulta na posição `i` attend só a posições em `[i - W, i]` (SWA causal) ou `[i - W/2, i + W/2]` (bidirecional). Tokens fora da janela recebem `-inf` na matriz de scores.

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

Para `N = 8192` e `W = 1024`, a matriz de scores tem 1024 × 8192 linhas não-zero em média — uma redução de 8×.

**O KV cache encolhe com SWA.** Só os últimos `W` tokens de K e V precisam ser mantidos por camada. Para uma config tipo Gemma-3 (janela 1024, contexto 128K), o KV cache cai 128×.

**Custo em qualidade.** Transformers só com SWA sofrem com recuperação de longo alcance. A solução: intercalar camadas SWA com camadas de full attention. Gemma 3 usa 5:1 SWA:global. Mistral 7B usou uma pilha causal-SWA onde a informação "flui pra frente" através de janelas sobrepostas — cada camada estende o campo receptivo efetivo em `W`, e depois de `L` camadas o modelo pode attend `L × W` tokens pra trás.

### Sparse / Block Attention

Escolha um padrão de esparsidade `N × N` antecipadamente. Três formas canônicas:

- **Local + strided (OpenAI sparse transformer).** Attend aos últimos `W` tokens mais cada token a cada `stride` posições antes disso. Captura tanto local quanto longo alcance em `O(N · sqrt(N))` de computação.
- **Longformer / BigBird.** Janela local + um pequeno conjunto de tokens globais (ex: `[CLS]`) que attend a todos e são attendidos por todos + links aleatórios-sparse. Contexto 2× empírico com qualidade equivalente.
- **Native Sparse Attention (DeepSeek, 2025).** Aprende quais blocos de `(Q, K)` importam; pula os blocos zero no nível de kernel. Compatível com FlashAttention.

Sparse attention é uma história de engenharia de kernel. A matemática é simples (mascarar a matriz de scores); o ganho vem de nunca carregar as entradas zero no SRAM. FlashAttention-3 e a API FlexAttention de 2026 tornam padrões de esparsidade customizados cidadãos de primeira classe no PyTorch.

### Differential Attention (DIFF Transformer, 2024)

Attention regular tem um problema de "attention sink": o softmax força cada linha a somar 1, então tokens que não querem attend a nada em particular jogam peso no primeiro token (ou nos primeiros). Isso rouba capacidade que deveria ir pro conteúdo real.

Differential attention corrige isso computando **dois** mapas de attention e subtraindo:

```
A1 = softmax(Q1 K1^T / √d)
A2 = softmax(Q2 K2^T / √d)
DiffAttn = (A1 - λ · A2) V
```

onde `λ` é um escalar aprendido (tipicamente 0.5–0.8). A1 captura os pesos reais do conteúdo; A2 captura o sink. A subtração cancela o sink, realocando peso pra tokens relevantes.

Resultados reportados (Microsoft 2024): 5–10% de perplexity menor, contexto efetivo 1.5–2× maior no mesmo comprimento treinado, recuperação needle-in-haystack mais precisa.

### Comparação de Variantes

| Variante | Computação | KV cache | Qualidade vs full | Uso em produção |
|---------|---------|----------|-----------------|----------------|
| Full attention | O(N²) | O(N) por camada | baseline | camada padrão de todo modelo |
| SWA (janela 1024) | O(N·W) | O(W) por camada | -0.1 ppl, bom com camadas globais | Gemma 2/3, Phi-3-Long |
| Local + strided sparse | O(N·√N) | misturado | similar a SWA | OpenAI sparse transformer, Longformer |
| BigBird (local + global + random) | O(N) aprox | misturado | equivale a full em 2× contexto | BERT de longo contexto inicial |
| Native Sparse (DeepSeek-V3.2) | O(N · fração ativa) | O(N) | dentro de 0.05 ppl | DeepSeek-V3.2, 2025 |
| Differential | O(2·N²) | O(2N) | -5 a -10% ppl | DIFF Transformer, modelos iniciais de 2026 |

## Construindo

Veja `code/main.py`. Implementamos um comparador de máscaras causais que mostra full, SWA, local+strided, e differential attention lado a lado em uma sequência de exemplo.

### Passo 1: máscara causal full (baseline)

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

Baseline da Aula 07. Triangular inferior; peso zero acima da diagonal.

### Passo 2: máscara causal sliding window

```python
def swa_mask(n, window):
    M = [[float("-inf")] * n for _ in range(n)]
    for i in range(n):
        lo = max(0, i - window + 1)
        for j in range(lo, i + 1):
            M[i][j] = 0.0
    return M
```

Um parâmetro — `window`. Para `window >= n`, você recupera full attention causal. Para `window = 1`, cada token attend só a si mesmo.

### Passo 3: máscara local + strided sparse

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

Janela local densa mais cada token a cada `stride` posições de volta ao início da sequência. Campo receptivo cresce em passos logarítmicos com camadas adicionais.

### Passo 4: differential attention

```python
def diff_attention(Q1, K1, Q2, K2, V, lam):
    A1 = softmax_causal(Q1 @ K1.T / sqrt_d)
    A2 = softmax_causal(Q2 @ K2.T / sqrt_d)
    return (A1 - lam * A2) @ V
```

Duas passes de attention, subtraindo com um coeficiente de mixagem aprendido. No código comparamos o heatmap de attention-sink de single vs differential e vemos o sink colapsar.

### Passo 5: tamanhos do KV cache

Imprima o tamanho do cache por camada em `N = 131072` para cada variante. Variantes SWA e sparse caem 10–100×. Differential dobra. Pague sua conta de memória conscientemente.

## Usando

Padrões de produção em 2026:

```python
from transformers import AutoModelForCausalLM
# Gemma 3 mistura SWA (window=1024) e camadas globais em 5:1.
model = AutoModelForCausalLM.from_pretrained("google/gemma-3-27b-it")
# print(model.config.sliding_window, model.config.layer_types)
```

FlexAttention no PyTorch 2.5+ aceita uma função de máscara:

```python
from torch.nn.attention.flex_attention import flex_attention, create_block_mask

def swa_pattern(b, h, q_idx, kv_idx):
    return (q_idx - kv_idx < 1024) & (q_idx >= kv_idx)

mask = create_block_mask(swa_pattern, B=batch, H=heads, Q_LEN=n, KV_LEN=n)
out = flex_attention(q, k, v, block_mask=mask)
```

Isso compila pra um kernel Triton customizado. Dentro de 10% da velocidade do FlashAttention-3 pra padrões comuns, e a função de máscara é um callable Python.

**Quando escolher cada uma:**

- **Full attention pura** — toda camada até contexto de ~16K, ou quando qualidade de recuperação é primordial.
- **Mistura SWA + global** — contexto longo (>32K), treinamento e inferência com limite de memória. O padrão de 2026 acima de 32K.
- **Sparse block attention** — kernel customizado, padrão customizado. Reservado pra workloads eespecificaçãoializados (recuperação, áudio).
- **Differential attention** — qualquer workload onde contaminação por attention-sink prejudica (RAG de longo contexto, needle-in-haystack).

## Entregando

Veja `outputs/skill-attention-variant-picker.md`. A skill escolhe uma topologia de attention pra um novo modelo dado o comprimento de contexto alvo, demandas de recuperação, e perfil de computação treinamento/inferência.

## Exercícios

1. **Fácil.** Rode `code/main.py`. Verifique que SWA com `window=4` zera tudo fora dos últimos 4 tokens por linha. Verifique que `window=n` reproduz full attention causal bit-identicamente.
2. **Médio.** Implemente SWA causal com `window=1024` sobre o capstone da Aula 07. Treine por 1.000 steps no tinyshakespeare. Quanto a val loss degrada vs full attention? Quanto a memória máxima cai?
3. **Difícil.** Implemente uma mistura de camadas estilo Gemma-3 com proporção 5:1 (5 SWA, 1 global) no modelo capstone. Compare loss, memória, e qualidade de geração contra baselines puro-SWA e puro-global com parâmetros equivalentes.
4. **Difícil.** Implemente differential attention com `λ` aprendido por head. Treine em uma tarefa de recuperação sintética (uma agulha, 2.000 distratores). Meça acurácia de recuperação vs um baseline de attention simples com parâmetros equivalentes.

## Termos-Chave

| Termo | O que dizem | O que realmente significa |
|------|-------------|-----------------------|
| Sliding window attention (SWA) | "Local attention" | Cada consulta attend aos seus últimos `W` tokens; KV cache encolhe pra `O(W)`. |
| Effective receptive field | "Quão longe o modelo enxerga" | Em uma pilha SWA de `L` camadas com janela `W`, até `L × W` tokens. |
| Longformer / BigBird | "Local + global + random" | Padrões esparsos com alguns tokens globais sempre-attendidos; abordagem inicial de longo contexto. |
| Native Sparse Attention | "Truque de kernel do DeepSeek" | Aprende esparsidade em nível de bloco; pula blocos zero no nível de kernel mantendo qualidade. |
| Differential attention | "Dois mapos, um subtrai" | DIFF Transformer: subtrai um segundo mapa de attention multiplicado por `λ` aprendido do primeiro pra cancelar attention sinks. |
| Attention sink | "Peso despeja no token 0" | Normalização por softmax força linhas a somarem 1; queries sem informação jogam peso na posição 0. |
| FlexAttention | "Máscara-como-Python" | API do PyTorch 2.5+ que compila funções de máscara arbitrárias em kernels no estilo FlashAttention. |
| Mistura de tipos de camada | "5:1 SWA:global" | Intercala camadas esparsas e de full attention numa pilha pra manter qualidade com menos memória.

## Leitura Complementar

- [Beltagy, Peters, Cohan (2020). Longformer: The Long-Document Transformer](https://arxiv.org/abs/2004.05150) — o paper canônico de sliding-window + global-token.
- [Zaheer et al. (2020). Big Bird: Transformers for Longer Sequences](https://arxiv.org/abs/2007.14062) — local + global + random.
- [Child et al. (2019). Generating Long Sequences with Sparse Transformers](https://arxiv.org/abs/1904.10509) — o padrão local+strided do OpenAI.
- [Gemma Team (2024). Gemma 2: Improving Open Language Models at a Practical Size](https://arxiv.org/abs/2408.00118) — a mistura 1:1 SWA:global.
- [Gemma Team (2025). Gemma 3 technical report](https://arxiv.org/abs/2503.19786) — a mistura 5:1 com window=1024 que é agora o padrão didático.
- [Ye et al. (2024). Differential Transformer](https://arxiv.org/abs/2410.05258) — paper do DIFF Transformer.
- [Yuan et al. (2025). Native Sparse Attention](https://arxiv.org/abs/2502.11089) — attention de esparsidade aprendida do DeepSeek-V3.2.
- [PyTorch — FlexAttention blog and docs](https://pytorch.org/blog/flexattention/) — referência da API do padrão mask-as-callable na seção Usando.
