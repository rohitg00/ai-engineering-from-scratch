# Multi-Head Attention

> Uma head de attention aprende uma relação de cada vez. Oito heads aprendem oito. Heads são grátis. Pega mais.

**Tipo:** Construir
**Linguagens:** Python
**Pré-requisitos:** Fase 7 · 02 (Self-Attention do Zero)
**Tempo:** ~75 minutos

## O Problema

Uma única head de self-attention calcula uma matriz de attention. Essa matriz captura um tipo de relação — geralmente a que minimiza a perda no sinal de treinamento disponível. Se seus dados têm concordância sujeito-verbo, coreferência, discurso de longo alcance e chunking sintático todos entrelaçados, uma única head mistura tudo numa distribuição softmax única e perde metade do sinal.

A solução do paper Vaswani de 2017: rodar várias funções de attention em paralelo, cada uma com suas próprias projeções Q, K, V, e concatenar as saídas. Cada head opera em um subespaço menor de dimensão `d_model / n_heads`. Número total de parâmetros fica igual. Poder expressivo sobe.

Multi-head attention é o padrão que todo transformer em 2026 usa. A única discussão é *quantas* heads e se keys e valores compartilham projeções (Grouped-Query Attention, Multi-Query Attention, Multi-head Latent Attention).

## O Conceito

![Multi-head attention separa, atende, concatena](../assets/multi-head-attention.svg)

**Separar.** Pegue `X` com shape `(N, d_model)`. Projete para Q, K, V cada um com shape `(N, d_model)`. Reformule para `(N, n_heads, d_head)` onde `d_head = d_model / n_heads`. Transponha para `(n_heads, N, d_head)`.

**Atender em paralelo.** Rode attention de produto escalar escalonado dentro de cada head. Cada head produz `(N, d_head)`. As heads operam em subespaços diferentes do embedding e não se comunicam durante o cálculo da attention.

**Concatenar e projetar.** Reempilhe as heads para `(N, d_model)` e multiplique por uma matriz de saída aprendida `W_o` de shape `(d_model, d_model)`. `W_o` é onde as heads se misturam.

**Por que funciona.** Cada head pode se eespecificaçãoializar sem competir com as outras pelo orçamento representacional. Estudos de probing de 2019–2024 mostram papéis distintos de heads: heads posicionais, heads que atendem ao token anterior, heads de cópia, heads de entidade nomeada, induction heads (que fundamentam aprendizado em contexto).

**A linhagem de variações de 2026:**

| Variante | Q heads | K/V heads | Usado por |
|----------|---------|-----------|-----------|
| Multi-head (MHA) | N | N | GPT-2, BERT, T5 |
| Multi-consulta (MQA) | N | 1 | PaLM, Falcon |
| Grouped-consulta (GQA) | N | G (ex: N/8) | Llama 2 70B, Llama 3+, Qwen 2+, Mistral |
| Multi-head latent (MLA) | N | comprimido para baixo rank | DeepSeek-V2, V3 |

GQA é o padrão moderno porque reduz memória do KV-cache em um fator de `N/G` mantendo qualidade praticamente full. MLA vai mais longe comprimindo K/V num espaço latente, depois projetando de volta no momento do compute — custa FLOPs, mas economiza muito mais memória.

## Construindo

### Passo 1: separar heads da attention de head única que já temos

Pegue o `SelfAttention` da Aula 02 e envolva com um par split/concat. Veja `code/main.py` pra uma implementação em numpy; a lógica é:

```python
def split_heads(X, n_heads):
    n, d = X.shape
    d_head = d // n_heads
    return X.reshape(n, n_heads, d_head).transpose(1, 0, 2)  # (heads, n, d_head)

def combine_heads(H):
    h, n, d_head = H.shape
    return H.transpose(1, 0, 2).reshape(n, h * d_head)
```

Um reshape e um transpose. Sem loop. É exatamente o que o PyTorch faz embaixo do `nn.MultiheadAttention`.

### Passo 2: rodar attention de produto escalar escalonado por head

Cada head recebe sua própria fatia de Q, K, V. Attention vira uma matmul em batch:

```python
def mha_forward(X, W_q, W_k, W_v, W_o, n_heads):
    Q = X @ W_q
    K = X @ W_k
    V = X @ W_v
    Qh = split_heads(Q, n_heads)         # (heads, n, d_head)
    Kh = split_heads(K, n_heads)
    Vh = split_heads(V, n_heads)
    scores = Qh @ Kh.transpose(0, 2, 1) / np.sqrt(Qh.shape[-1])
    weights = softmax(scores, axis=-1)
    out = weights @ Vh                    # (heads, n, d_head)
    concat = combine_heads(out)
    return concat @ W_o, weights
```

Em hardware real `Qh @ Kh.transpose(...)` é uma única `bmm`. A GPU vê uma única matmul em batch com shape `(heads, N, d_head) × (heads, d_head, N) -> (heads, N, N)`. Adicionar heads é grátis.

### Passo 3: variante Grouped-Query Attention

Só as projeções de key e value mudam. Q recebe `n_heads` grupos; K e V recebem `n_kv_heads < n_heads` grupos e são repetidos pra combinar:

```python
def gqa_project(X, W, n_kv_heads, n_heads):
    kv = split_heads(X @ W, n_kv_heads)       # (kv_heads, n, d_head)
    repeat = n_heads // n_kv_heads
    return np.repeat(kv, repeat, axis=0)      # (n_heads, n, d_head)
```

Na inferência isso economiza memória porque só cópias de `n_kv_heads` ficam no KV cache, não `n_heads`. Llama 3 70B usa 64 consulta heads com 8 KV heads — encolhimento de cache de 8×.

### Passo 4: investigar o que cada head aprendeu

Rode MHA numa frase curta com 4 heads. Pra cada head, imprima a matriz de attention `(N, N)`. Você vai ver diferentes heads selecionando estruturas diferentes mesmo com inicialização aleatória — é parcialmente sinal, parcialmente simetria rotacional nos subespaços.

## Usando

No PyTorch, a versão de uma linha:

```python
import torch.nn as nn

mha = nn.MultiheadAttention(embed_dim=512, num_heads=8, batch_first=True)
```

GQA no PyTorch 2.5+:

```python
from torch.nn.functional import scaled_dot_product_attention

# scaled_dot_product_attention auto-dispatches Flash Attention on CUDA.
# For GQA, pass Q of shape (B, n_heads, N, d_head) and K,V of shape
# (B, n_kv_heads, N, d_head). PyTorch handles the repeat.
out = scaled_dot_product_attention(q, k, v, is_causal=True, enable_gqa=True)
```

**Quantas heads?** Regras práticas de modelos de produção em 2026:

| Tamanho do modelo | d_model | n_heads | d_head |
|-------------------|---------|---------|--------|
| Pequeno (~125M) | 768 | 12 | 64 |
| Base (~350M) | 1024 | 16 | 64 |
| Grande (~1B) | 2048 | 16 | 128 |
| Fronteira (~70B) | 8192 | 64 | 128 |

`d_head` quase sempre cai em 64 ou 128. É a unidade de quanto uma head pode "ver". Cai abaixo de 32 e as heads começam a brigar com o fator de escala `sqrt(d_head)`; sobe acima de 256 e você perde o benefício de "muitos pequenos eespecificaçãoialistas".

## Entregando

Veja `outputs/skill-mha-configurator.md`. A skill recomenda número de heads, número de kv-heads e estratégia de projeção pra um novo transformer dado orçamento de parâmetros, comprimento de sequência e alvo de implantação.

## Exercícios

1. **Fácil.** Pegue o MHA de `code/main.py` e mude `n_heads` de 1 para 16 com `d_model=64` fixo. Plote a perda de um tiny modelo de uma camada numa tarefa de cópia sintética. Mais heads ajudam, estagnam ou prejudicam?
2. **Médio.** Implemente MQA (uma KV head compartilhada pra todas as consulta heads). Meça quanto a contagem de parâmetros cai vs MHA completa. Calcule quanto o tamanho do KV-cache encolhe na inferência com N=2048.
3. **Difícil.** Implemente uma versão tiny de Multi-head Latent Attention: comprima K,V para um latente de rank `r`, armazene o latente no KV cache, descomprima no momento da attention. Em que `r` a memória do cache cai abaixo de 1/8 da MHA completa enquanto qualidade fica dentro de 1 bit de ppl de validação?

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|------------------------|--------------------------|
| Head | "Um circuito de attention individual" | Uma projeção Q/K/V de dimensão `d_head = d_model / n_heads` com sua própria matriz de attention. |
| d_head | "Dimensão da head" | Largura oculta por head; quase sempre 64 ou 128 em produção. |
| Separar / combinar | "Truques de reshape" | `(N, d_model) ↔ (n_heads, N, d_head)` reshape+transpose ao redor da attention. |
| W_o | "Projeção de saída" | Matriz `(d_model, d_model)` aplicada após concatenar heads; onde as heads se misturam. |
| MQA | "Uma KV head" | Multi-Query Attention: projeção K/V compartilhada única. Menor KV cache, alguma perda de qualidade. |
| GQA | "O padrão desde Llama 2" | Grouped-Query Attention com `n_kv_heads < n_heads`; repete pra combinar com Q. |
| MLA | "O truque do DeepSeek" | Multi-head Latent Attention: K,V comprimidos pra latente de baixo rank, descomprimidos no momento de atender. |
| Induction head | "O circuito por trás do aprendizado em contexto" | Par de heads que detectam ocorrências anteriores e copiam o que veio depois. |

## Leituras Complementares

- [Vaswani et al. (2017). Attention Is All You Need §3.2.2](https://arxiv.org/abs/1706.03762) — a eespecificaçãoificação original de multi-head.
- [Shazeer (2019). Fast Transformer Decoding: One Write-Head is All You Need](https://arxiv.org/abs/1911.02150) — o paper de MQA.
- [Ainslie et al. (2023). GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints](https://arxiv.org/abs/2305.13245) — como converter MHA para GQA após treinamento.
- [DeepSeek-AI (2024). DeepSeek-V2 Technical Report](https://arxiv.org/abs/2405.04434) — MLA e por que vence MHA/GQA em memória de cache.
- [Olsson et al. (2022). In-context Learning and Induction Heads](https://transformer-circuits.pub/2022/in-context-learning-and-induction-heads/index.html) — análise mecanicista de o que heads realmente fazem.
