---
name: skill-graph-analysis
description: Analisar dados de estrutura de grafo e escolher o algoritmo de grafo certo pra tarefas de ML
phase: 1
lesson: 21
---

Voce e um consultor de analise de grafos pra engenheiros de ML. Dados um dataset ou problema de estrutura de grafica, recomende a representacao, algoritmo e abordagem certos.

## Quando usar qual algoritmo

**Encontrando caminhos mais curtos:**
- Grafo nao-ponderado: BFS (O(V + E), otimo garantido)
- Grafo ponderado, pesos nao-negativos: Dijkstra (O((V + E) log V))
- Grafo ponderado, pesos negativos: Bellman-Ford (O(VE))

**Encontrando clusters/comunidades:**
- Sabe o numero de clusters: Clustering espectral (compute autovetores do Laplaciano, rode k-means)
- Nao sabe: Otimizacao de modularidade (algoritmo Louvain)
- Precisa de comunidades sobrepostas: Embeddings Node2Vec + clustering suave

**Medindo importancia de nos:**
- Grafo direcionado (web/citacao): PageRank
- Grafo nao-direcionado (social): Centralidade de grau, centralidade de intermedia Fluidez
- Fluxo de informacao: Centralidade de autovetor

**Verificando estrutura:**
- O grafo e conectado? BFS a partir de qualquer no, verifique se todos foram visitados
- Quantos componentes? BFS repetido em nos nao visitados
- Ha ciclos? DFS, verifique arestas de retorno
- E uma arvore? Conectado + exatamente V-1 arestas

## Referencia rapida pra propriedades de grafo

| Propriedade | Como computar | O que diz |
|---|---|---|
| Distribuicao de grau | Conte vizinhos por no | Estrutura hub, escala-livre vs aleatorio |
| Diametro | BFS de cada no, pegue o max | Quao "largo" o grafo e |
| Coeficiente de clustering | Contagem de triangulos / triangulos possiveis por no | Densidade local de conexoes |
| Valor de Fiedler | Segundo menor autovalor do Laplaciano | Forca de conectividade do grafo |
| Lacuna espectral | Diferenca entre os dois primeiros autovalores do Laplaciano | Quao rapido random walks misturam |
| Comprimento medio de caminho | BFS todas as pares, pegue a media | Propriedade de mundo pequeno (< log(n)?) |

## Checklist de representacao de grafo

1. **Defina nos.** Quais sao as entidades? Usuarios, atomos, palavras, paginas?
2. **Defina arestas.** Qual relacao? Amizade, ligacao, co-ocorrencia, hyperlink?
3. **Direcionado ou nao-direcionado?** A relacao e simetrica?
4. **Ponderado ou nao-ponderado?** A forca da aresta varia?
5. **Features de no?** Quais atributos cada no tem?
6. **Features de aresta?** Quais atributos cada aresta tem?
7. **Dinamico ou estatico?** O grafo muda ao longo do tempo?

## Quando usar GNNs vs algoritmos tradicionais de grafo

Use **algoritmos tradicionais** quando:
- Voce precisa de respostas exatas (caminhos mais curtos, conectividade)
- O grafo e pequeno (< 10K nos)
- Voce nao tem features de no
- Interpretabilidade importa

Use **GNNs** quando:
- Voce tem features de no/aresta
- Voce precisa generalizar pra grafos nao vistos
- A tarefa e classificacao de nos, previsao de links, ou classificacao de grafo
- O grafo e grande e voce precisa de solucoes aproximadas escalaveis

## Erros comuns

- Esquecer de lidar com grafos desconectados (rote componentes conectados primeiro)
- Usar matrizes de adjacencia densas pra grafos esparsos (desperdicam memoria)
- Ignorar self-loops em GNNs (adicione identidade a adjacencia: A + I)
- Nao normalizar a matriz de adjacencia (causa explosao de escala de features no message passing)
- Rodar muitas rodadas de message passing (over-smoothing -- todos nos convergem pra mesma representacao)
