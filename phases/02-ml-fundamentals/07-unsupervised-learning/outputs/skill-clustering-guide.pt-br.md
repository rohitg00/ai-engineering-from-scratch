---
name: skill-clustering-guide
description: Escolher o algoritmo de clustering certo baseado na forma dos dados, ruido e restricoes
version: 1.0.0
phase: 2
lesson: 7
tags: [clustering, k-means, dbscan, hierarchical, gmm, unsupervised]
---

# Guia de Selecao de Algoritmo de Clustering

Clustering nao tem um unico melhor algoritmo. A escolha certa depende da forma dos clusters, se voce sabe o numero de clusters, quao ruidosos sao os dados, e quao grande e o dataset.

## Checklist de Decisao

1. Voce sabe o numero de clusters?
   - Sim: K-Means ou GMM
   - Nao: DBSCAN (encontra clusters automaticamente), ou hierarquico (corte o dendrograma em niveis diferentes)

2. Qual a forma dos clusters?
   - Aproximadamente esfericos (tipo blob): K-Means
   - Elipiticos com tamanhos diferentes: GMM
   - Formas arbitrárias (crescentes, aneis, correntes): DBSCAN
   - Aninhados ou hierarquicos: clustering hierarquico

3. Os dados contem ruido ou outliers?
   - Sim: DBSCAN (rotula pontos de ruido explicitamente) ou GMM (pontos de baixa probabilidade sao outliers)
   - Nao: K-Means esta ok

4. Voce precisa de atribuicoes suaves (probabilidades)?
   - Sim: GMM da P(cluster | ponto de dados) pra cada cluster
   - Nao: K-Means ou DBSCAN dao atribuicoes duras

5. Quao grande e o dataset?
   - Menos de 10.000: qualquer algoritmo funciona
   - 10.000 a 1.000.000: K-Means (rapido), Mini-Batch K-Means (mais rapido)
   - Mais de 1.000.000: Mini-Batch K-Means ou BIRCH. Hierarquico e lento demais.

## Quando usar cada abordagem

**K-Means**: ponto de partida padrao. Rapido (O(n * k * iteracoes)), simples, e bom o suficiente pra muitos problemas. Use o metodo do cotovelo ou escore silhouette pra escolher K. Limitacoes: assume clusters esfericos, sensivel a inicializacao (use K-Means++ ou rode multiplas vezes), nao lida bem com tamanhos de cluster variaveis.

**DBSCAN**: melhor pra descobrir clusters de forma arbitraria e detectar outliers automaticamente. Dois parametros: eps (raio de vizinhanca) e min_samples (densidade minima). Nao requer especificar K. Limitacoes: luta quando clusters tem densidades muito diferentes, e ajustar eps pode ser complicado. Use grafico k-distance pra estimar eps: compute a distancia ao k-esimo vizinho mais proximo de cada ponto, ordene, e procure um cotovelo.

**Hierarquico (Agglomerative)**: constroi uma arvore de fusoes. Util quando voce quer explorar estrutura de cluster em multiplas granularidades (corte o dendrograma em alturas diferentes). Ligacao Ward funciona melhor pra clusters compactos. Ligacao unica encontra clusters alongados mas e sensivel a ruido. Limitacoes: O(n^2) de memoria e O(n^3) de tempo, entao impraticavel pra datasets grandes.

**GMM (Gaussian Mixture Models)**: clustering suave com atribuicoes probabilisticas. Modela cada cluster como uma distribuicao Gaussiana com sua propria media e covariancia. Melhor que K-Means quando clusters sao elipiticos ou se sobrepõem. Use BIC (Bayesian Information Criterion) pra selecionar numero de componentes. Limitacoes: assume distribuicoes Gaussianas, pode falhar em formas nao-convexas, sensivel a inicializacao.

## Avaliando qualidade de cluster (sem labels)

| Metrica | O que mede | Range | Usar quando |
|--------|-----------------|-------|----------|
| Escore silhouette | Coesao vs separacao | -1 a 1 (maior e melhor) | Comparando valores de K ou algoritmos |
| Inercia (SS intra-cluster) | Compactacao dos clusters | 0 a inf (menor e melhor) | Metodo do cotovelo pra K-Means |
| BIC / AIC | Ajuste do modelo com penalidade de complexidade | Menor e melhor | Escolhendo numero de componentes GMM |
| Indice Calinski-Harabasz | Razao de variancia entre vs dentro | Maior e melhor | Comparacao rapida |
| Indice Davies-Bouldin | Similaridade media entre clusters | Menor e melhor | Penaliza clusters sobrepostos |

## Erros comuns

- Rodar K-Means sem escalar features (features com escalas maiores dominam o calculo de distancia)
- Escolher K olhando dados em 2D quando os dados reais sao de alta dimensionalidade (use escores silhouette)
- Usar K-Means em clusters nao-esfericos (dados em forma de crescente ou anel precisam de DBSCAN)
- Definir eps de DBSCAN alto demais (tudo num cluster) ou baixo demais (tudo e ruido)
- Tratar rotulos de cluster como verdade absoluta (clustering e exploratorio; valide com conhecimento de dominio)
- Rodar clustering hierarquico em datasets com mais de 20.000 pontos (memoria e tempo explodem)

## Referencia rapida

| Algoritmo | Forma do cluster | Encontra K | Lida com ruido | Atribuicoes suaves | Escalabilidade |
|-----------|--------------|---------|---------------|-----------------|-------------|
| K-Means | Esferico | Nao (voce define K) | Nao | Nao | Milhoes |
| Mini-Batch K-Means | Esferico | Nao | Nao | Nao | Dezenas de milhoes |
| DBSCAN | Arbitrario | Sim | Sim | Nao | Centenas de milhares |
| Hierarquico | Qualquer (depende da ligacao) | Flexivel (corta dendrograma) | Depende da ligacao | Nao | Menos de 20k |
| GMM | Elipitico | Nao (voce define K) | Parcial (baixa probabilidade) | Sim | Menos de 100k |
| HDBSCAN | Arbitrario | Sim | Sim | Parcial | Centenas de milhares |
