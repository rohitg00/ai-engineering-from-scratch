# Self-Attention do Zero

> Attention é uma tabela de consulta onde cada palavra pergunta "quem é importante pra mim?" — e aprende a resposta.

**Tipo:** Construir
**Linguagens:** Python
**Pré-requisitos:** Fase 3 (Deep Learning Core), Fase 5 Aula 10 (Sequence-to-Sequence)
**Tempo:** ~90 minutos

## Objetivos de Aprendizagem

- Implementar self-attention de produto escalar escalonado do zero usando apenas NumPy, incluindo projeções consulta/key/value e a soma ponderada com softmax
- Construir uma camada de multi-head attention que separa heads, calcula attention paralela e concatena resultados
- Rastrear como a matriz de attention captura relacionamentos entre tokens e explicar por que a escala por sqrt(d_k) previne saturação do softmax
- Aplicar máscara causal para converter attention bidirecional em attention autoregressiva (estilo decoder)

## O Problema

RNNs processam sequências um token de cada vez. Quando você chega ao token 50, a informação do token 1 já foi comprimida através de 50 etapas de compressão. Dependências de longo alcance são esmagadas num estado oculto de tamanho fixo — um gargalo que nenhuma quantidade de portões LSTM resolve totalmente.

O paper de attention Bahdanau de 2014 mostrou a solução: deixar o decoder olhar para trás em cada posição do encoder e decidir quais importam pro passo atual. Mas ainda estava conectado a uma RNN. O paper "Attention Is All You Need" de 2017 fez uma pergunta mais afiada: e se attention for o *único* mecanismo? Sem recorrência. Sem convolução. Só attention.

Self-attention permite que cada posição de uma sequência atenda a todas as outras posições em um único passo paralelo. É isso que torna transformers rápidos, escaláveis e dominantes.

## O Conceito

### A Analogia de Consulta a Banco de Dados

Pense na attention como uma consulta suave a banco de dados:

```
Traditional database:
  Query: "capital of France"  -->  exact match  -->  "Paris"

Attention:
  Query: "capital of France"  -->  similarity to ALL keys  -->  weighted blend of ALL values
```

Cada token gera três vetores:
- **Query (Q)**: "O que estou procurando?"
- **Key (K)**: "O que eu contém?"
- **Value (V)**: "Que informação eu forneço se selecionado?"

O produto escalar entre uma consulta e todas as keys produz scores de attention. Score alto significa "essa key combina com minha consulta". Esses scores ponderam os values. A saída é uma soma ponderada de values.

### Computação de Q, K, V

Cada embedding de token é projetado através de três matrizes de pesos aprendidas:

```
Input embeddings (sequence of n tokens, each d-dimensional):

  X = [x1, x2, x3, ..., xn]       shape: (n, d)

Three weight matrices:

  Wq  shape: (d, dk)
  Wk  shape: (d, dk)
  Wv  shape: (d, dv)

Projections:

  Q = X @ Wq    shape: (n, dk)      each token's consulta
  K = X @ Wk    shape: (n, dk)      each token's key
  V = X @ Wv    shape: (n, dv)      each token's value
```

Visualmente, para um token:

```
             Wq
  x_i ------[*]------> q_i    "What am I looking for?"
       |
       |     Wk
       +----[*]------> k_i    "What do I contain?"
       |
       |     Wv
       +----[*]------> v_i    "What do I offer?"
```

### A Matriz de Attention

Com Q, K, V para todos os tokens, os scores de attention formam uma matriz:

```
Scores = Q @ K^T    shape: (n, n)

              k1    k2    k3    k4    k5
        +-----+-----+-----+-----+-----+
   q1   | 2.1 | 0.3 | 0.1 | 0.8 | 0.2 |   <- how much q1 attends to each key
        +-----+-----+-----+-----+-----+
   q2   | 0.4 | 1.9 | 0.7 | 0.1 | 0.3 |
        +-----+-----+-----+-----+-----+
   q3   | 0.2 | 0.6 | 2.3 | 0.5 | 0.1 |
        +-----+-----+-----+-----+-----+
   q4   | 0.9 | 0.1 | 0.4 | 1.7 | 0.6 |
        +-----+-----+-----+-----+-----+
   q5   | 0.1 | 0.3 | 0.2 | 0.5 | 2.0 |
        +-----+-----+-----+-----+-----+

Each row: one token's attention over the entire sequence
```

### Por que Escalar?

Os produtos escalam com a dimensão dk. Se dk = 64, produtos podem estar na faixa de dezenas, empurrando o softmax para regiões onde gradientes desaparecem. A solução: dividir por sqrt(dk).

```
Scaled scores = (Q @ K^T) / sqrt(dk)
```

Isso mantém valores numa faixa onde o softmax produz gradientes úteis.

### Softmax Transforma Scores em Pesos

Softmax converte scores brutos numa distribuição de probabilidade ao longo de cada linha:

```
Raw scores for q1:   [2.1, 0.3, 0.1, 0.8, 0.2]
                            |
                         softmax
                            |
Attention weights:   [0.52, 0.09, 0.07, 0.14, 0.08]   (sums to ~1.0)
```

Agora cada token tem um conjunto de pesos dizendo quanto atende a cada outro token.

### Soma Ponderada de Values

A saída final para cada token é uma soma ponderada de todos os vetores de value:

```
output_i = sum( attention_weight[i][j] * v_j  for all j )

For token 1:
  output_1 = 0.52 * v1 + 0.09 * v2 + 0.07 * v3 + 0.14 * v4 + 0.08 * v5
```

### Pipeline Completo

```
                    +-------+
  X (input)  ----->|  @ Wq  |-----> Q
                    +-------+
                    +-------+
  X (input)  ----->|  @ Wk  |-----> K
                    +-------+                     +----------+
                    +-------+                     |          |
  X (input)  ----->|  @ Wv  |-----> V ---------->| weighted |----> output
                    +-------+          ^          |   sum    |
                                       |          +----------+
                              +--------+--------+
                              |    softmax      |
                              +---------+-------+
                                        ^
                              +---------+-------+
                              | Q @ K^T / sqrt  |
                              +-----------------+
```

Fórmula em uma linha:

```
Attention(Q, K, V) = softmax( Q @ K^T / sqrt(dk) ) @ V
```

## Construindo

### Passo 1: Softmax do zero

Softmax converte logits brutos em probabilidades. Subtrai o máximo por estabilidade numérica.

```python
import numpy as np

def softmax(x):
    shifted = x - np.max(x, axis=-1, keepdims=True)
    exp_x = np.exp(shifted)
    return exp_x / np.sum(exp_x, axis=-1, keepdims=True)

logits = np.array([2.0, 1.0, 0.1])
print(f"logits:  {logits}")
print(f"softmax: {softmax(logits)}")
print(f"sum:     {softmax(logits).sum():.4f}")
```

### Passo 2: Attention de produto escalar escalonado

A função principal. Recebe matrizes Q, K, V e retorna a saída de attention mais a matriz de pesos.

```python
def scaled_dot_product_attention(Q, K, V):
    dk = Q.shape[-1]
    scores = Q @ K.T / np.sqrt(dk)
    weights = softmax(scores)
    output = weights @ V
    return output, weights
```

### Passo 3: Classe de self-attention com projeções aprendidas

Um módulo completo de self-attention com matrizes de pesos Wq, Wk, Wv inicializadas com escala tipo Xavier.

```python
class SelfAttention:
    def __init__(self, d_model, dk, dv, seed=42):
        rng = np.random.default_rng(seed)
        scale = np.sqrt(2.0 / (d_model + dk))
        self.Wq = rng.normal(0, scale, (d_model, dk))
        self.Wk = rng.normal(0, scale, (d_model, dk))
        scale_v = np.sqrt(2.0 / (d_model + dv))
        self.Wv = rng.normal(0, scale_v, (d_model, dv))
        self.dk = dk

    def forward(self, X):
        Q = X @ self.Wq
        K = X @ self.Wk
        V = X @ self.Wv
        output, weights = scaled_dot_product_attention(Q, K, V)
        return output, weights
```

### Passo 4: Rodar numa frase

Crie embeddings fictícios pra uma frase e observe os pesos de attention.

```python
sentence = ["The", "cat", "sat", "on", "the", "mat"]
n_tokens = len(sentence)
d_model = 8
dk = 4
dv = 4

rng = np.random.default_rng(42)
X = rng.normal(0, 1, (n_tokens, d_model))

attn = SelfAttention(d_model, dk, dv, seed=42)
output, weights = attn.forward(X)

print("Attention weights (each row: where that token looks):\n")
print(f"{'':>6}", end="")
for token in sentence:
    print(f"{token:>6}", end="")
print()

for i, token in enumerate(sentence):
    print(f"{token:>6}", end="")
    for j in range(n_tokens):
        w = weights[i][j]
        print(f"{w:6.3f}", end="")
    print()
```

### Passo 5: Visualizar attention com mapa de calor ASCII

Mapeie pesos de attention pra caracteres pra uma visualização rápida.

```python
def ascii_heatmap(weights, tokens, chars=" ░▒▓█"):
    n = len(tokens)
    print(f"\n{'':>6}", end="")
    for t in tokens:
        print(f"{t:>6}", end="")
    print()

    for i in range(n):
        print(f"{tokens[i]:>6}", end="")
        for j in range(n):
            level = int(weights[i][j] * (len(chars) - 1) / weights.max())
            level = min(level, len(chars) - 1)
            print(f"{'  ' + chars[level] + '   '}", end="")
        print()

ascii_heatmap(weights, sentence)
```

## Usando

O `nn.MultiheadAttention` do PyTorch faz exatamente o que construímos, com separação multi-head e projeção de saída:

```python
import torch
import torch.nn as nn

d_model = 8
n_heads = 2
seq_len = 6

mha = nn.MultiheadAttention(embed_dim=d_model, num_heads=n_heads, batch_first=True)

X_torch = torch.randn(1, seq_len, d_model)

output, attn_weights = mha(X_torch, X_torch, X_torch)

print(f"Input shape:            {X_torch.shape}")
print(f"Output shape:           {output.shape}")
print(f"Attention weight shape: {attn_weights.shape}")
print(f"\nAttn weights (averaged over heads):")
print(attn_weights[0].detach().numpy().round(3))
```

A diferença principal: multi-head attention roda múltiplas funções de attention em paralelo, cada uma com suas próprias projeções Q, K, V de tamanho dk = d_model / n_heads, depois concatena os resultados. Isso permite que o modelo atenda a diferentes tipos de relacionamento simultaneamente.

## Entregando

Esta aula produz:
- `outputs/prompt-attention-explainer.md` — um prompt pra explicar attention através da analogia de consulta a banco de dados

## Exercícios

1. Modifique `scaled_dot_product_attention` pra aceitar uma matriz de máscara opcional que coloca certas posições em negativo infinito antes do softmax (é assim que funciona a máscara causal/decoder)
2. Implemente multi-head attention do zero: separe Q, K, V em `n_heads` pedaços, rode attention em cada um, concatene e projete através de uma matriz de pesos final Wo
3. Pegue duas frases diferentes do mesmo tamanho, passe pela mesma instância de SelfAttention e compare os padrões de attention. O que muda? O que permanece igual?

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|------------------------|--------------------------|
| Query (Q) | "O vetor pergunta" | Uma projeção aprendida da entrada que representa que informação este token está procurando |
| Key (K) | "O vetor etiqueta" | Uma projeção aprendida que representa que informação este token contém, pareada contra queries |
| Value (V) | "O vetor conteúdo" | Uma projeção aprendida carregando a informação real que é agregada com base nos scores de attention |
| Attention de produto escalar escalonado | "A fórmula de attention" | softmax(QK^T / sqrt(dk)) @ V — a escala previne saturação do softmax em altas dimensões |
| Self-attention | "O token olha pra si e pros outros" | Attention onde Q, K, V vêm todos da mesma sequência, permitindo que cada posição atenda a todas as outras |
| Pesos de attention | "Quanto foco" | Uma distribuição de probabilidade sobre posições, produzida pelo softmax sobre produtos escalares escalados |
| Multi-head attention | "Attention paralela" | Rodar múltiplas funções de attention com diferentes projeções, depois concatenar resultados pra representações mais ricas |

## Leituras Complementares

- [Attention Is All You Need (Vaswani et al., 2017)](https://arxiv.org/abs/1706.03762) - o paper original do transformer
- [The Illustrated Transformer (Jay Alammar)](https://jalammar.github.io/illustrated-transformer/) - melhor walkthrough visual da arquitetura completa
- [The Annotated Transformer (Harvard NLP)](https://nlp.seas.harvard.edu/annotated-transformer/) - implementação linha por linha em PyTorch com explicações
