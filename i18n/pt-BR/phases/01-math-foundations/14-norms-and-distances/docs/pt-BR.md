# Normas e Distâncias

> A função de distância define o que significa "semelhante".

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 01 (Linear Algebra Intuition), 02 (Vectors, Matrices & Operations)
**Time:** ~90 minutes

## Objetivos de aprendizagem

- Implementar L1, L2, cosino, Mahalanobis, Jaccard e editar funções de distância a partir do zero
- Selecionar a métrica de distância adequada para uma determinada tarefa de ML e explicar por que as alternativas falham
- Conectar as normas L1 e L2 à regularização LASSO e Ridge e às suas regiões de restrições geométricas
- Demonstrar como o mesmo conjunto de dados produz diferentes vizinhos mais próximos sob diferentes métricas

## O problema

Você tem dois vetores. Talvez sejam palavras embutidas. Talvez sejam perfis de usuários. Talvez sejam matrizes de pixels. Você precisa saber: quão perto estão?

A resposta depende inteiramente da função de distância que você escolher. Dois pontos de dados podem ser vizinhos mais próximos sob uma métrica e distantes sob outra. Seu classificador KNN, seu motor de recomendação, seu banco de dados vetorial, seu algoritmo de agrupamento, sua função de perda - todos dependem dessa escolha.

Não há melhor distância universal. L2 funciona para dados espaciais. A semelhança cosínica domina a PNL. Jaccard lida com conjuntos. Edit distance manipula cordas. Mahalanobis conta para correlações. Wasserstein move probabilidade massa. Cada um codifica uma suposição diferente sobre o que "semelhante" significa.

Esta lição construi todas as principais funções de distância a partir do zero, mostra-lhe quando cada uma é a ferramenta certa, e demonstra como os mesmos dados produzem vizinhos mais próximos completamente diferentes dependendo de qual métrica você usa.

## O conceito

### Normas: medição da magnitude do vetor

Uma norma mede o " tamanho " de um vetor.$d(a, b) = \lVert a - b \rVert$Então, entender as normas é entender as distâncias.

### L1 Norma (distância de Manhattan)

A norma L1 soma os valores absolutos de todos os componentes.

```math
\lVert x \rVert_1 = |x_1| + |x_2| + \cdots + |x_n|
```

Chama-se distância de Manhattan porque mede a distância que percorre numa rede de cidades onde só pode mover-se ao longo de eixos.

```
Point A = (1, 1)
Point B = (4, 5)

L1 distance = |4-1| + |5-1| = 3 + 4 = 7

On a grid, you walk 3 blocks east and 4 blocks north.
```

Quando utilizar L1:
- Dados escassos de alta dimensão (funções de texto, codificações de um só tipo)
- Quando você quer robustez para outliers (uma única grande diferença não domina)
- Problemas de selecção de características (a regularização de L1 promove a esparcidade)

Conexão à regularização L1 (Lasso): adição $\lVert w \rVert_1$A função de perda de uma peça de peso em massa de uma peça de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de peso de

Conexão a funções de perda: Erro absoluto médio (MAE) é a distância média L1 entre previsões e metas.

### L2 Norma (distância euclidiana)

A norma L2 é a distância de linha reta.

```math
\lVert x \rVert_2 = \sqrt{x_1^2 + x_2^2 + \cdots + x_n^2}
```

Esta é a distância que aprendeste na aula de geometria.$n$dimensões.

```
Point A = (1, 1)
Point B = (4, 5)

L2 distance = sqrt((4-1)^2 + (5-1)^2) = sqrt(9 + 16) = sqrt(25) = 5.0

The straight line, cutting diagonally through the grid.
```

Quando utilizar L2:
- Dados contínuos de baixa a média dimensão
- Quando as escalas de características são comparáveis
- Distâncias físicas (dados espaciais, leituras de sensores)
- Similaridade de imagem no nível de pixels

Conexão à regularização L2 (Ridge): adição $\lVert w \rVert_2^2$A função de perda penaliza grandes pesos. Ao contrário de L1, não empurra pesos para zero. Ele encolhe todos os pesos para zero proporcionalmente. A penalidade L2 cria regiões de restrição circular, então não há cantos nos eixos. Pesos ficam pequenos, mas raramente exatamente zero.

Conexão a funções de perda: Erro médio quadrado (MSE) é a média de distâncias L2 quadradas.

```math
\begin{aligned}
\text{MAE (L1 loss):} \quad & |y - \hat{y}| && \text{Linear penalty. Robust to outliers.} \\
\text{MSE (L2 loss):} \quad & (y - \hat{y})^2 && \text{Quadratic penalty. Sensitive to outliers.}
\end{aligned}
```

### Normas de Lp: família geral

L1 e L2 são casos especiais da norma Lp:

```math
\lVert x \rVert_p = (|x_1|^p + |x_2|^p + \cdots + |x_n|^p)^{1/p}
```

Valores diferentes de $p$Produzir "bolas de unidade" de diferentes formas (o conjunto de todos os pontos a uma distância máxima de 1 da origem; as formas abaixo são as suas fronteiras):

```
p=1:    Diamond shape      (corners on axes)
p=2:    Circle/sphere      (the usual round ball)
p=3:    Superellipse       (rounded square)
p=inf:  Square/hypercube   (flat sides along axes)
```

### Norma de infinidade L (distância Chebyshev)

Como ...$p$Quando se aproxima do infinito, a norma Lp converge para o componente absoluto máximo.

```math
\lVert x \rVert_\infty = \max(|x_1|, |x_2|, \ldots, |x_n|)
```

A distância entre dois pontos é determinada pela dimensão única em que eles diferem mais.

```math
\begin{aligned}
\text{Point } A &= (1, 1) \\
\text{Point } B &= (4, 5) \\[6pt]
L_\infty \text{ distance} &= \max(|4-1|, |5-1|) = \max(3, 4) = 4
\end{aligned}
```

Quando utilizar L-infinity:
- Quando o pior caso de desvio em qualquer dimensão única é importante
- Tabuleiros de jogo (um rei em xadrez move em L-infinito: um passo em qualquer direção custa 1)
- Toleranças de fabrico (todas as dimensões devem estar dentro das especificações)

### Similaridade cosínica e distância cosínica

A semelhança cosínica mede o ângulo entre dois vetores, ignorando suas magnitudes.

```math
\text{cos\_sim}(a, b) = \frac{a \cdot b}{\lVert a \rVert_2 \, \lVert b \rVert_2}
```

Ele varia de -1 (direções opostas) a +1 (sima direção).

A distância cosínea converte-a em distância: cosínea_distância = 1 - cosínea_similância.

```math
\begin{aligned}
& a = (1, 0) \qquad b = (1, 1) \\[6pt]
& \text{cos\_sim} = \frac{1 \cdot 1 + 0 \cdot 1}{1 \cdot \sqrt{2}} = \frac{1}{\sqrt{2}} = 0.707 \\
& \text{cos\_dist} = 1 - 0.707 = 0.293
\end{aligned}
```

Por que o cosino domina a PNL e as incorporações: no texto, o comprimento do documento não deve afetar a semelhança. Um documento sobre gatos que seja o dobro do comprimento de outro documento sobre gatos deve ainda ser "similar". A semelhança cosínica ignora a magnitude (longoura) e só se importa com a direção. Dois documentos com a mesma distribuição de palavras, mas comprimentos diferentes apontam na mesma direção e obtêm similaridade cosínica 1.0.

Quando utilizar a semelhança cosínica:
- Semelhança de texto (vectores TF-IDF, inserções de palavras, inserções de frases)
- Qualquer domínio onde a magnitude é ruído e a direção é sinal
- Sistemas de recomendação (vectores de preferência do utilizador)
- Embedding search (base de dados vetoriais quase sempre usam cosino ou produto ponto)

### Similaridade do produto de ponto versus Similaridade cosínica

O produto de pontos de dois vetores é:

```math
\begin{aligned}
a \cdot b &= a_1 b_1 + a_2 b_2 + \cdots + a_n b_n \\
&= \lVert a \rVert \, \lVert b \rVert \cos(\text{angle})
\end{aligned}
```

A semelhança cosínica é o produto de pontos normalizado por ambas as magnitudes. Quando ambos os vetores já são normalizados por unidade (magnitude = 1), o produto de pontos e a semelhança cosínica são idênticos.

```math
\text{If } \lVert a \rVert = 1 \text{ and } \lVert b \rVert = 1: \quad a \cdot b = \cos(\text{angle between } a \text{ and } b)
```

Quando eles diferem: produto de pontos inclui informações de magnitude. Um vetor com maior magnitude obtém uma pontuação de produto de pontos mais alta. Isso importa em alguns sistemas de recuperação onde você quer que itens "populares" se classificem mais alto. A magnitude age como um sinal implícito de qualidade ou importância.

```
a = (3, 0)    b = (1, 0)    c = (0, 1)

dot(a, b) = 3     dot(a, c) = 0
cos(a, b) = 1.0   cos(a, c) = 0.0

Both agree on direction, but dot product also reflects magnitude.
```

Na prática:
- Use a semelhança cosínica quando quiser a semelhança direcional pura
- Use produto ponto quando as magnitudes transportam informações significativas
- Muitos bancos de dados vetoriais (Pinecone, Weaviate, Qdrant) permitem-lhe escolher entre eles
- Se os seus incorporados são L2-normalizados, a escolha não importa

### Distância de Mahalanobis

A distância euclidiana trata todas as dimensões de forma igual, mas se as suas características estão correlacionadas ou têm escalas diferentes, L2 dá resultados enganosos.

A distância de Mahalanobis explica a estrutura de covariância dos dados.

```math
d_M(x, y) = \sqrt{(x - y)^T S^{-1} (x - y)}
```

onde$S$é a matriz de covariância dos dados.

Intuitivamente: a distância de Mahalanobis primeiro descorrela e normaliza os dados (branqueamento), depois calcula a distância L2 nesse espaço transformado.$S$é a matriz de identidade (não correlacionada, características de variância unitária), a distância de Mahalanobis reduz-se à distância euclidiana.

```
Example: height and weight are correlated.
Someone 6'2" and 180 lbs is not unusual.
Someone 5'0" and 180 lbs is unusual.

Euclidean distance might say they are equally far from the mean.
Mahalanobis distance correctly identifies the second as an outlier
because it accounts for the height-weight correlation.
```

Quando utilizar a distância de Mahalanobis:
- Detecção de anomalias (pontos com grande distância de Mahalanobis da média são anomalias)
- Classificação quando as características têm diferentes escalas e correlações
- Quando você tem dados suficientes para estimar uma matriz de covariância confiável
- Controle da qualidade na fabricação (monitorização de processos multivariados)

### Similância de jaccard (para conjuntos)

As medidas de similaridade de Jaccard se sobrepõem entre dois conjuntos.

```math
J(A, B) = \frac{|A \cap B|}{|A \cup B|}
```

O valor da distância Jaccard é igual a 1 - Semelhança Jaccard.

```
A = {cat, dog, fish}
B = {cat, bird, fish, snake}

Intersection = {cat, fish}         size = 2
Union = {cat, dog, fish, bird, snake}  size = 5

Jaccard similarity = 2/5 = 0.4
Jaccard distance = 0.6
```

Quando utilizar Jaccard:
- Comparar conjuntos de tags, categorias ou características
- Identidade de documentos com base na presença de palavras (não na frequência)
- Detecção de duplicados próximos (aproximação MinHash de Jaccard)
- Comparar vetores de características binárias (dados de presença/ausência)
- Modelos de avaliação de segmentação (Intersecção da União = Jaccard)

### Edição Distância (Distância Levenshtein)

A distância de edição conta o número mínimo de operações de um único caracter necessário para transformar uma cadeia em outra.

```
"kitten" -> "sitting"

kitten -> sitten  (substitute k -> s)
sitten -> sittin  (substitute e -> i)
sittin -> sitting (insert g)

Edit distance = 3
```

Computação com programação dinâmica. Preencha uma matriz onde entrada $(i, j)$é a distância de edição entre o primeiro $i$caracteres da cadeia A e da primeira $j$caracteres da linha B.

```
        ""  s  i  t  t  i  n  g
    ""   0  1  2  3  4  5  6  7
    k    1  1  2  3  4  5  6  7
    i    2  2  1  2  3  4  5  6
    t    3  3  2  1  2  3  4  5
    t    4  4  3  2  1  2  3  4
    e    5  5  4  3  2  2  3  4
    n    6  6  5  4  3  3  2  3
```

Quando usar a distância de edição:
- Verificação e correcção de ortografia
- Alinhamento de sequências de DNA (com operações ponderadas)
- A combinação de cordas
- Dedução de dados de texto confusos

### KL Divergência (não distância, mas utilizada como uma)

A divergência KL mede como uma distribuição de probabilidade difere de outra.

```math
D_{KL}(P \,\|\, Q) = \sum_x p(x) \log\frac{p(x)}{q(x)}
```

Propriedade crítica: A divergência KL NÃO é simétrica.

```math
D_{KL}(P \,\|\, Q) \ne D_{KL}(Q \,\|\, P)
```

Isto significa que não satisfaz o requisito básico de uma métrica de distância.

Forward KL $(D_{KL}(P \Vert Q))$é "buscar o significado": $Q$tenta abranger todos os modos de$P$- Não .
Reversão KL $(D_{KL}(Q \Vert P))$é "requisitação de modo": $Q$concentra-se num único modo de$P$- Não .

Quando vês a divergência KL:
- VAEs (o termo KL no ELBO empurra a distribuição latente para um anterior)
- Destilação do conhecimento (o aluno tenta corresponder à distribuição do professor)
- RLHF (a penalidade KL mantém o modelo ajustado próximo do modelo base)
- Métodos de gradiente de políticas (actualizações restritivas de políticas)

### Distância Wasserstein (Distância do Mover da Terra)

A distância de Wasserstein mede o mínimo de "trabalho" necessário para transformar uma distribuição de probabilidades em outra.

```math
W(P, Q) = \inf_{\gamma} \mathbb{E}[d(x, y)] \quad \text{(over all transport plans } \gamma\text{)}
```

Para distribuições 1D, simplifica para a integral da diferença absoluta das funções de distribuição cumulativa:

```math
W_1(P, Q) = \int |\text{CDF}_P(x) - \text{CDF}_Q(x)| \, dx
```

Por que Wasserstein importa:
- É uma métrica verdadeira (simétrica, satisfaz a desigualdade triangular)
- Ele fornece gradientes mesmo quando as distribuições não se sobrepõem (a divergência KL vai para o infinito)
- Esta propriedade tornou-o central para os GANs Wasserstein (WGANs), que resolveu a instabilidade de treinamento dos GANs originais

```
Distributions with no overlap:

P: [1, 0, 0, 0, 0]    Q: [0, 0, 0, 0, 1]

KL divergence: infinity (log of zero)
Wasserstein: 4 (move all mass 4 bins)

Wasserstein gives a meaningful gradient. KL does not.
```

Quando utilizar Wasserstein:
- Formação em GAN (WGAN, WGAN-GP)
- Comparar distribuições que não se sobrepõem
- Problemas de transporte óptimos
- Retorno de imagem (comparar histogramas de cor)

### Por que diferentes tarefas precisam de distâncias diferentes

| Task | Best distance | Why |
|------|--------------|-----|
| Text similarity | Cosine | Magnitude is noise, direction is meaning |
| Image pixel comparison | L2 | Spatial relationships matter, features are comparable scale |
| Sparse high-dim features | L1 | Robust, does not amplify rare large differences |
| Set overlap (tags, categories) | Jaccard | Data is naturally set-valued, not vectorial |
| String matching | Edit distance | Operations map to human editing intuition |
| Outlier detection | Mahalanobis | Accounts for feature correlations and scales |
| Comparing distributions | KL divergence | Measures information lost by using $Q$ instead of $P$ |
| GAN training | Wasserstein | Provides gradients even when distributions do not overlap |
| Embeddings (vector DB) | Cosine or dot product | Embeddings are trained to encode meaning in direction |
| Recommendation | Dot product | Magnitude can encode popularity or confidence |
| DNA sequences | Weighted edit distance | Substitution costs vary by nucleotide pair |
| Manufacturing QC | L-infinity | Worst-case deviation in any dimension matters |

### Conexão com funções de perda

As funções de perda são funções de distância aplicadas às previsões versus metas.

```
Loss function       Distance it uses       Behavior
MSE                 L2 squared             Penalizes large errors heavily
MAE                 L1                     Penalizes all errors equally
Huber loss          L1 for large errors,   Best of both: robust to outliers,
                    L2 for small errors    smooth gradient near zero
Cross-entropy       KL divergence          Measures distribution mismatch
Hinge loss          max(0, margin - d)     Only penalizes below margin
Triplet loss        L2 (typically)         Pulls positives close, pushes
                                           negatives away
Contrastive loss    L2                     Similar pairs close, dissimilar
                                           pairs beyond margin
```

### Conexão com a regularização

A regularização adiciona uma penalidade norma sobre os pesos à função de perda.

```
L1 regularization (Lasso):   loss + lambda * ||w||_1
  -> Sparse weights. Some weights become exactly zero.
  -> Automatic feature selection.
  -> Solution has corners (non-differentiable at zero).

L2 regularization (Ridge):   loss + lambda * ||w||_2^2
  -> Small weights. All weights shrink toward zero.
  -> No feature selection (nothing goes to exactly zero).
  -> Smooth solution everywhere.

Elastic Net:                  loss + lambda_1 * ||w||_1 + lambda_2 * ||w||_2^2
  -> Combines sparsity of L1 with stability of L2.
  -> Groups of correlated features are kept or dropped together.
```

Por que L1 produz escassez, mas L2 não: imagine a região de restrição em espaço de peso 2D. L1 é um diamante, L2 é um círculo. Os contornos da função de perda (elípsias) são mais propensos a tocar o diamante em um canto, onde um peso é zero. Eles tocam o círculo em um ponto liso, onde ambos os pesos não são zero.

### Buscar o vizinho mais próximo

Cada função de distância implica um problema de busca de vizinho mais próximo: dado um ponto de consulta, encontrar os pontos mais próximos de um conjunto de dados.

A busca mais próxima do vizinho é exactamente$O(n \cdot d)$por consulta num conjunto de dados de $n$pontos com $d$Para grandes conjuntos de dados, isto é muito lento.

Algoritmos de Vezinho Mais Próximo (ANN) aproximados trocam uma pequena quantidade de precisão para ganhos de velocidade maciços:

```
Algorithm         Approach                      Used by
KD-trees          Axis-aligned space partition   scikit-learn (low-dim)
Ball trees        Nested hyperspheres            scikit-learn (medium-dim)
LSH               Random hash projections        Near-duplicate detection
HNSW              Hierarchical navigable         FAISS, Qdrant, Weaviate
                  small-world graph
IVF               Inverted file index with       FAISS (billion-scale)
                  cluster-based search
Product quant.    Compress vectors, search       FAISS (memory-constrained)
                  in compressed space
```

HNSW (Hierárquico Navegable Small World) é o algoritmo dominante em bancos de dados vetoriais modernos. Ele constrói um gráfico de várias camadas onde cada nó se conecta a seus vizinhos mais próximos. A pesquisa começa na camada superior (sparse, saltos longos) e desce para a camada inferior (densos, saltos curtos).

```figure
norm-unit-balls
```

## Construí-lo

### Passo 1: Todas as funções normais e de distância

Veja .`code/distances.py`Cada função é construída a partir do zero usando apenas matemática básica Python.`code/distances.ts`é uma porta TypeScript com as mesmas funções e demos.

### Passo 2: Os mesmos dados, distâncias diferentes, vizinhos diferentes

A demonstração em`distances.py`cria um conjunto de dados, escolhe um ponto de consulta e mostra como o vizinho mais próximo muda dependendo da métrica de distância.

### Passo 3: Introdução à pesquisa de semelhanças

O código inclui uma busca de semelhança simulada que encontra os "documentos" mais semelhantes a uma consulta usando semelhança cosínea vs distância L2, mostrando que as classificações podem diferir.

## Usá-lo

O uso prático mais comum: encontrar itens semelhantes em um banco de dados vetorial.

```python
import numpy as np

def cosine_similarity_matrix(X):
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1, norms)
    X_normalized = X / norms
    return X_normalized @ X_normalized.T

embeddings = np.random.randn(1000, 768)

sim_matrix = cosine_similarity_matrix(embeddings)

query_idx = 0
similarities = sim_matrix[query_idx]
top_k = np.argsort(similarities)[::-1][1:6]
print(f"Top 5 most similar to item 0: {top_k}")
print(f"Similarities: {similarities[top_k]}")
```

Quando ligares .`model.encode(text)`O modelo de incorporação mapeia o texto para vetores. O banco de dados vetorial calcula a semelhança cosínica (ou produto de pontos) entre o vetor de consulta e cada vetor armazenado, usando algoritmos ANN para evitar verificar todos eles.

## Exercícios

1. Calcule as distâncias L1, L2 e L-infinito entre (1, 2, 3) e (4, 0, 6). Verifique que $L_\infty \le L_2 \le L_1$Prova porque é que esta ordem é garantida.

2. Crie dois vetores onde a semelhança cosínica é alta (> 0,9) mas a distância L2 é grande (> 10). Explique geometricamente o que está acontecendo.

3. Implementar uma função que leva um conjunto de dados e um ponto de consulta e retorna o vizinho mais próximo sob a distância L1, L2, cosino e Mahalanobis. Encontre um conjunto de dados onde os quatro discordam sobre qual ponto é o mais próximo.

4. Calcule a distância de Wasserstein entre [0,5, 0,5, 0,0] e [0, 0, 0,5, 0,5] à mão usando o método CDF. Em seguida, calcule entre [0,25, 0,25, 0,25, 0,25] e [0, 0, 0, 0,5, 0,5]. Qual é maior e por quê?

5. Implemente MinHash para a semelhança aproximada com Jaccard. Gerencie 100 conjuntos aleatórios, compute o Jaccard exato para todos os pares e compare com a aproximação MinHash usando funções de hash 50, 100 e 200.

### Indicios

**Exercise 1.**O vector de diferença é (-3, 2, -3), então, calcular as três normas desse vector com `l1_norm`- Não .`l2_norm`, e `linf_norm`Para a prova, compare o maior.$\lvert d_i \rvert$Com a soma dos quadrados, e comparar a soma dos quadrados com o quadrado da soma dos valores absolutos.

**Exercise 2.**A semelhança cosínica ignora a comprimento, então comece com dois vetores que apontam quase na mesma direção e faça um deles muito mais longo. Para o segundo caso, use dois vetores curtos perto da origem que apontam em direções diferentes, depois verifique ambas as condições com `cosine_similarity`E ...`l2_distance`- Não .

**Exercise 3.**Liga-me .`find_nearest_neighbor(query, dataset, distance_fn)`Uma vez por cada um .`l1_distance`- Não .`l2_distance`- Não .`cosine_distance`, e `mahalanobis_distance`- Não .`demo_different_neighbors`mostra um conjunto de dados onde as métricas discordam, então leia primeiro e depois mude os pontos até que as quatro respostas diferam.

**Exercise 4.**Escreva a soma cumulativa de cada distribuição, adicione as diferenças absolutas das duas somas cumulativas.`wasserstein_1d(p, q)`, então explicar o valor maior por quão longe a massa de probabilidade deve mover.

**Exercise 5.**Para cada função hash, a assinatura MinHash de um conjunto é o valor hash mínimo sobre seus elementos, e a fração de funções hash onde dois conjuntos obtêm as mesmas estimativas mínimas de sua semelhança com Jaccard.`jaccard_similarity`O erro deve ser aproximadamente $1/\sqrt{k}$Para$k$funções hash.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Norm | "Size of a vector" | A function that maps a vector to a non-negative scalar, satisfying triangle inequality, absolute homogeneity, and zero only for the zero vector |
| L1 norm | "Manhattan distance" | Sum of absolute component values. Produces sparsity in optimization. Robust to outliers |
| L2 norm | "Euclidean distance" | Square root of sum of squared components. The straight-line distance in Euclidean space |
| Lp norm | "Generalized norm" | The $p$-th root of the sum of $p$-th powers of absolute components. L1 and L2 are special cases |
| L-infinity norm | "Max norm" or "Chebyshev distance" | The maximum absolute component value. The limit of Lp as $p$ approaches infinity |
| Cosine similarity | "Angle between vectors" | Dot product normalized by both magnitudes. Ranges from -1 to +1. Ignores vector length |
| Cosine distance | "1 minus cosine similarity" | Converts cosine similarity to a distance. Ranges from 0 to 2 |
| Dot product | "Unnormalized cosine" | Sum of component-wise products. Equals cosine similarity times both magnitudes |
| Mahalanobis distance | "Correlation-aware distance" | L2 distance in a space that has been whitened (decorrelated and normalized) using the data covariance matrix |
| Jaccard similarity | "Set overlap" | Size of intersection divided by size of union. For sets, not vectors |
| Edit distance | "Levenshtein distance" | Minimum insertions, deletions, and substitutions to transform one string into another |
| KL divergence | "Distance between distributions" | Not a true distance (not symmetric). Measures extra bits from using $Q$ to encode $P$ |
| Wasserstein distance | "Earth mover's distance" | Minimum work to transport mass from one distribution to another. A true metric |
| Approximate nearest neighbor | "ANN search" | Algorithms (HNSW, LSH, IVF) that find approximately closest points much faster than exact search |
| HNSW | "The vector DB algorithm" | Hierarchical Navigable Small World graph. Multi-layer graph for fast approximate nearest neighbor search |
| L1 regularization | "Lasso" | Adding the L1 norm of weights to the loss. Drives weights to zero (sparsity) |
| L2 regularization | "Ridge" or "weight decay" | Adding the squared L2 norm of weights to the loss. Shrinks weights toward zero without sparsity |
| Elastic Net | "L1 + L2" | Combines L1 and L2 regularization. Handles correlated feature groups better than either alone |

## Mais leitura

- [FAISS: A Library for Efficient Similarity Search](https://github.com/facebookresearch/faiss)- Biblioteca da Meta para pesquisas em ANN em escala de bilhões
- [Wasserstein GAN (Arjovsky et al., 2017)](https://arxiv.org/abs/1701.07875)- O artigo que introduziu a distância do Mover da Terra para os GANs
- [Locality-Sensitive Hashing (Indyk & Motwani, 1998)](https://dl.acm.org/doi/10.1145/276698.276876)- algoritmo ANN fundamental
- [Efficient Estimation of Word Representations (Mikolov et al., 2013)](https://arxiv.org/abs/1301.3781)- Word2Vec, onde a semelhança cosínica tornou-se a padrão para os embutidos
- [sklearn.neighbors documentation](https://scikit-learn.org/stable/modules/neighbors.html)- guia prático para métricas de distância e algoritmos de vizinhança em scikit-learn
