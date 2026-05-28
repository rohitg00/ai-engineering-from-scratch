# Teoria dos Grafos para Machine Learning

> Grafos são a estrutura de dados de relacionamentos. Se seus dados têm conexões, você precisa de teoria dos grafos.

**Tipo:** Construção
**Idioma:** Python
**Pré-requisitos:** Fase 1, Lições 01-03 (álgebra linear, matrizes)
**Tempo:** ~90 minutos

## Objetivos de Aprendizado

- Construir uma classe de grafo com representações de matriz/lista de adjacência e implementar traversals BFS e DFS
- Computar o Laplaciano de grafo e usar seus autovalores para detectar componentes conectados e agrupar nós
- Implementar uma rodada de message passing estilo GNN como multiplicação de matriz de adjacência normalizada
- Aplicar clustering eespecificaçãotral para particionar um grafo usando o vetor de Fiedler

## O Problema

Redes sociais, moléculas, bases de conhecimento, redes de citação, mapas de ruas -- todos são grafos. ML tradicional trata dados como tabelas planas. Mas quando a estrutura de conexões importa, tabelas falham.

GNNs são a área de crescimento mais rápido em deep learning. Toda GNN se baseia na mesma fundação: teoria básica dos grafos.

Você precisa de quatro coisas:
1. Uma maneira de representar grafos como matrizes
2. Algoritmos de traversal para explorar estrutura
3. O Laplaciano -- a matriz mais importante da teoria eespecificaçãotral
4. Message passing -- a operação que faz GNNs funcionarem

## O Conceito

### Grafos: Nós e Arestas

Um grafo G = (V, E) consiste de vértices (nós) V e arestas E.

**Dirigido vs não-dirigido.** Em não-dirigido, aresta (u, v) significa u conecta a v E v conecta a u.

**Ponderado vs não-ponderado.** Em ponderado, cada aresta tem um peso numérico.

### Matriz de Adjacência

```
A[i][j] = 1    se há aresta de i para j
A[i][j] = 0    caso contrário
```

### Grau

O grau de um nó é o número de arestas conectadas. Matriz de grau D é diagonal.

### BFS e DFS

**BFS:** Explora todos vizinhos primeiro, depois vizinhos dos vizinhos. Usa fila. Encontra caminhos mais curtos em grafos não-ponderados.

**DFS:** Vai o mais fundo possível antes de voltar. Usa pilha. Útil para componentes conectados, detecção de ciclo, ordenação topológica.

### Laplaciano de Grafo

L = D - A. A matriz mais importante da teoria eespecificaçãotral de grafos.

Propriedades:
1. L é semi-definida positiva
2. Número de autovalores zero = número de componentes conectados
3. Menor autovalor não-zero (valor de Fiedler) mede conectividade
4. Autovetor de Fiedler revela a melhor divisão

### Clustering Eespecificaçãotral

1. Compute o Laplaciano L
2. Encontre os k menores autovetores de L
3. Use esses autovetores como novas coordenadas
4. Execute k-means nessas coordenadas

### Message Passing

```
H^(k+1) = sigma(A_norm * H^(k) * W)
```

Uma rodada: cada nó "vê" seus vizinhos imediatos. K rodadas: cada nó tem informação de sua vizinhança K-hop.

## Construa

```python
class Graph:
    def __init__(self, n_nodes, directed=False):
        self.n = n_nodes
        self.directed = directed
        self.adj = {i: {} for i in range(n_nodes)}

    def add_edge(self, u, v, weight=1.0):
        self.adj[u][v] = weight
        if not self.directed:
            self.adj[v][u] = weight

    def adjacency_matrix(self):
        import numpy as np
        A = np.zeros((self.n, self.n))
        for u in range(self.n):
            for v, w in self.adj[u].items():
                A[u][v] = w
        return A

    def laplacian(self):
        D = np.diag([self.degree(i) for i in range(self.n)])
        return D - self.adjacency_matrix()
```

## Entregue

- `outputs/skill-graph-analysis.md` -- skill para analisar dados com estrutura de grafo

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Grafo | "Nós e arestas" | Estrutura matemática G=(V,E) |
| Matriz de adjacência | "Tabela de conexões" | Matriz n x n onde A[i][j]=1 se conectados |
| Laplaciano | "D menos A" | L=D-A, autovalores revelam estrutura |
| Fiedler | "Conectividade algébrica" | Menor autovalor não-zero de L |
| BFS | "Busca por nível" | Visita todos vizinhos antes de ir mais fundo |
| DFS | "Ir fundo primeiro" | Segue um caminho até o fim antes de voltar |
| Message passing | "Nós falam com vizinhos" | Cada nó agrega informação dos vizinhos |
| Clustering eespecificaçãotral | "Agrupar por autovetores" | Particionar grafo usando autovetores do Laplaciano |

## Leitura Adicional

- **Kipf & Welling (2017)** -- Semi-Supervised Classification with Graph Convolutional Networks
- **Spielman (2012)** -- Spectral Graph Theory
- **Hamilton (2020)** -- Graph Representation Learning
