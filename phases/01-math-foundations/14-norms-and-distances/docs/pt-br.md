# Normas e Distâncias

> Sua função de distância define o que "similar" significa. Escolha errado e tudo quebra.

**Tipo:** Construção
**Idioma:** Python
**Pré-requisitos:** Fase 1, Lições 01 (Intuição de Álgebra Linear), 02 (Vetores, Matrizes & Operações)
**Tempo:** ~90 minutos

## Objetivos de Aprendizado

- Implementar funções de distância L1, L2, cosseno, Mahalanobis, Jaccard e edição do zero
- Selecionar a métrica de distância apropriada para uma tarefa de ML e explicar por que alternativas falham
- Conectar normas L1 e L2 a regularização LASSO e Ridge e suas regiões de restrição geométrica
- Demonstrar como o mesmo dataset produz diferentes vizinhos mais próximos sob diferentes métricas

## O Problema

Você tem dois vetores. Talvez sejam word embeddings. Talvez sejam perfis de usuários. Talvez sejam arrays de pixels. Você precisa saber: o quão perto eles estão?

A resposta depende inteiramente de qual função de distância você escolhe. Dois pontos de dados podem ser vizinhos mais próximos sob uma métrica e distantes sob outra. Seu classificador KNN, seu motor de recomendações, seu banco de dados vetorial, seu algoritmo de clustering, sua função de perda -- tudo depende dessa escolha. Errando, seu modelo otimiza para a coisa errada.

Não existe distância universal melhor. L2 funciona para dados espaciais. Similaridade cosseno domina NLP. Jaccard lida com conjuntos. Distância de edição lida com strings. Mahalanobis leva em conta correlações. Wasserstein move massa de probabilidade. Cada uma codifica uma suposição diferente sobre o que "similar" significa.

Esta lição constrói cada função de distância principal do zero, mostra quando cada uma é a ferramenta certa, e demonstra como os mesmos dados produzem vizinhos completamente diferentes dependendo da métrica.

## O Conceito

### Normas: medindo magnitude de vetor

Uma norma mede o "tamanho" de um vetor. Toda função de distância entre dois vetores pode ser escrita como a norma da diferença: d(a, b) = ||a - b||. Então entender normas é entender distâncias.

### Norma L1 (Distância de Manhattan)

A norma L1 soma os valores absolutos de todos os componentes.

```
||x||_1 = |x_1| + |x_2| + ... + |x_n|
```

Chamada de distância de Manhattan porque mede o quão longe você anda em uma grade de cidade onde só pode se mover ao longo dos eixos. Sem diagonais.

```
Ponto A = (1, 1)
Ponto B = (4, 5)

Distância L1 = |4-1| + |5-1| = 3 + 4 = 7
```

Quando usar L1:
- Dados esparsos de alta dimensão (features de texto, one-hot encodings)
- Quando quer robustez a outliers
- Problemas de seleção de features (regularização L1 promove esparsidade)

### Norma L2 (Distância Euclidiana)

A norma L2 é a distância em linha reta. Raiz quadrada da soma dos componentes ao quadrado.

```
||x||_2 = sqrt(x_1^2 + x_2^2 + ... + x_n^2)
```

Quando usar L2:
- Dados contínuos de baixa a média dimensão
- Quando as escalas das features são comparáveis
- Distâncias físicas

### Similaridade Cosseno e Distância Cosseno

A similaridade cosseno mede o ângulo entre dois vetores, ignorando suas magnitudes.

```
cos_sim(a, b) = (a . b) / (||a||_2 * ||b||_2)
```

Varia de -1 (direções opostas) a +1 (mesma direção).

Por que cosseno domina NLP e embeddings: em texto, o comprimento do documento não deve afetar a similaridade. Dois documentos com a mesma distribuição de palavras mas comprimentos diferentes apontam na mesma direção e recebem similaridade cosseno 1.0.

### Produto Escalar vs Similaridade Cosseno

Quando os vetores já estão normalizados (magnitude = 1), produto escalar e similaridade cosseno são idênticos. O produto escalar inclui informação de magnitude -- um vetor com maior magnitude recebe maior pontuação.

### Distância de Mahalanobis

A distância euclidiana trata todas as dimensões igualmente. Mas se suas features são correlatas ou têm escalas diferentes, L2 dá resultados enganosos. Mahalanobis leva em conta a estrutura de covariância.

```
d_M(x, y) = sqrt((x - y)^T * S^(-1) * (x - y))
```

onde S é a matriz de covariância dos dados.

### Distância de Edição (Levenshtein)

A distância de edição conta o número mínimo de operações de caractere único para transformar uma string em outra: inserir, deletar ou substituir.

### Divergência KL (não é distância, mas é usada como uma)

A divergência KL mede como uma distribuição de probabilidade difere de outra. Propriedade crítica: NÃO é simétrica.

### Distância de Wasserstein (Distância Earth Mover)

A distância de Wasserstein mede o mínimo de "trabalho" para transformar uma distribuição em outra. É uma métrica verdadeira (simétrica, satisfaz desigualdade triangular).

### Por que Tarefas Diferentes Precisam de Distâncias Diferentes

| Tarefa | Melhor distância | Por quê |
|--------|-----------------|---------|
| Similaridade de texto | Cosseno | Magnitude é ruído, direção é significado |
| Comparação pixel de imagem | L2 | Relações espaciais importam |
| Features esparsas de alta dim | L1 | Robusta, não amplifica diferenças raras |
| Sobreposição de conjuntos | Jaccard | Dados são naturalmente conjuntos |
| Correspondência de string | Distância de edição | Operações mapeiam para intuição humana |
| Detecção de outlier | Mahalanobis | Levam em conta correlações |
| Comparação de distribuições | KL divergência | Mede informação perdida |
| Treino de GAN | Wasserstein | Dá gradientes mesmo sem sobreposição |
| Embeddings | Cosseno ou produto escalar | Treinados para codificar significado na direção |

### Conexão com Funções de Perda

| Função de perda | Distância usada | Comportamento |
|-----------------|-----------------|---------------|
| MSE | L2 ao quadrado | Penaliza erros grandes pesadamente |
| MAE | L1 | Penaliza todos erros igualmente |
| Huber | L1 para erros grandes, L2 para pequenos | Melhor dos dois mundos |
| Cross-entropy | KL divergência | Mede incompatibilidade de distribuição |

### Conexão com Regularização

```
Regularização L1 (Lasso):   perda + lambda * ||w||_1
  -> Pesos esparsos. Alguns pesos ficam exatamente zero.

Regularização L2 (Ridge):   perda + lambda * ||w||_2^2
  -> Pesos pequenos. Todos encolhem para zero.

Elastic Net:                  perda + lambda_1 * ||w||_1 + lambda_2 * ||w||_2^2
  -> Combina esparsidade de L1 com estabilidade de L2.
```

## Construa

Consulte `code/distances.py` para a implementação completa. Cada função é construída do zero usando apenas Python básico.

## Entregue

Consulte `code/distances.py` para implementações completas com todas as demonstrações visuais.

## Exercícios

1. Calcule distâncias L1, L2 e L-infinity entre (1, 2, 3) e (4, 0, 6). Verifique que L-inf <= L2 <= L1 sempre vale para qualquer par de pontos.

2. Crie dois vetores onde a similaridade cosseno é alta (> 0.9) mas a distância L2 é grande (> 10). Explique geometricamente.

3. Implemente uma função que recebe um dataset e um ponto de consulta e retorna o vizinho mais próximo sob L1, L2, cosseno e Mahalanobis.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Norma | "Tamanho de um vetor" | Função que mapeia um vetor para um escalar não-negativo |
| L1 | "Distância de Manhattan" | Soma dos valores absolutos dos componentes |
| L2 | "Distância Euclidiana" | Raiz quadrada da soma dos componentes ao quadrado |
| Cosseno | "Ângulo entre vetores" | Produto escalar normalizado pelas magnitudes |
| Mahalanobis | "Distância consciente de correlação" | L2 em espaço whitened |
| Jaccard | "Sobreposição de conjuntos" | Tamanho da interseção / tamanho da união |
| Distância de edição | "Levenshtein" | Mínimo de inserções, deleções e substituições |
| KL divergência | "Distância entre distribuições" | Não é distância verdadeira (não simétrica) |
| Wasserstein | "Earth mover's distance" | Trabalho mínimo para transportar massa |

## Leitura Adicional

- [FAISS: Biblioteca para Busca de Similaridade Eficiente](https://github.com/facebookresearch/faiss)
- [Wasserstein GAN (Arjovsky et al., 2017)](https://arxiv.org/abs/1701.07875)
- [Efficient Estimation of Word Representations (Mikolov et al., 2013)](https://arxiv.org/abs/1301.3781)
