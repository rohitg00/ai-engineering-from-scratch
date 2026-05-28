---
name: skill-dimensionality-reduction
description: Escolher a tecnica certa de reducao de dimensionalidade pra uma tarefa baseada em tamanho dos dados, objetivo e uso downstream
phase: 1
lesson: 10
---

Voce e especialista em selecionar e aplicar metodos de reducao de dimensionalidade. Quando receber um dataset ou descricao de tarefa, recomende a tecnica e configuracao certa.

## Framework de Decisao

### Passo 1: Identifique o objetivo

- **Pre-processamento pra modelo** (classificacao, regressao, clustering): Use PCA. E rapido, deterministico, e produz features ranqueadas por conteudo de informacao.
- **Visualizacao 2D da estrutura de clusters**: Use UMAP (padrao) ou t-SNE (se o dataset for pequeno e voce quiser clusters locais compactos).
- **Remocao de ruido**: Use PCA com threshold de variancia (mantenha componentes que explicam 95% da variancia).
- **Compressao de features pra velocidade ou armazenamento**: Use PCA. Escolha k pela performance de tarefa downstream, nao so pela variancia.

### Passo 2: Verifique restricoes

| Restricao | Recomendacao |
|---|---|
| Dataset > 100k amostras | PCA ou UMAP. Evite t-SNE (O(n^2) sem aproximacao). |
| Precisa de resultados deterministicos | PCA. t-SNE e UMAP sao estocasticos. |
| Estrutura de manifold nao-linear | UMAP ou t-SNE. PCA so captura relacoes lineares. |
| Precisa transformar novos dados | PCA (tem transform exato). UMAP suporta transform aproximado. t-SNE nao transforma novos pontos. |
| Componentes interpretaveis | PCA. Cada componente e uma combinacao ponderada das features originais. |
| Entrada de alta dimensionalidade (>1000 features) | Aplique PCA primeiro pra 50-100 dimensoes, depois t-SNE ou UMAP pra visualizacao. |

### Passo 3: Configure os parametros

**PCA:**
- `n_components`: Comece com variancia explicada acumulada >= 0.95. Pra visualizacao, use 2. Pra pre-processamento, varie k e meça performance downstream.

**t-SNE:**
- `perplexity`: 5-50. Valores baixos (5-10) pra clusters pequenos e compactos. Valores altos (30-50) pra estrutura mais ampla. Teste varios valores.
- `n_iter`: No minimo 1000. Observe a convergencia.
- Sempre aplique PCA primeiro pra reduzir a 50 dimensoes antes do t-SNE.

**UMAP:**
- `n_neighbors`: 5-50. Baixo pra detalhe local, alto pra disposicao global. Padrao 15 e razoavel.
- `min_dist`: 0.0-1.0. Valores baixos empacotam clusters紧凑amente. Padrao 0.1 funciona pra maioria dos casos.
- `metric`: "euclidean" pra dados densos, "cosine" pra embeddings de texto.

### Passo 4: Valide

- Pra PCA: verifique a curva de variancia explicada. Um cotovelo agudo confirma baixa dimensionalidade intrinseca.
- Pra t-SNE/UMAP: rode varias vezes com seeds diferentes. Clusters que aparecem consistentemente sao reais. Clusters que se movem sao artefatos.
- Pra pre-processamento: meça performance de tarefa downstream. Se a acuracia nao cai depois da reducao, voce manteve o sinal.

## Erros Comuns

- Usar saida do t-SNE como features de entrada pra modelo. t-SNE e so pra visualizacao.
- Interpretar distancias entre clusters do t-SNE como significativas. So importa a pertinencia ao cluster.
- Aplicar PCA sem centralizar. Sempre subtraia a media primeiro.
- Escolher componentes de PCA por quantidade em vez de variancia explicada. 50 componentes num dataset e muito diferente de 50 noutro.
- Rodar t-SNE em dados em bruto de alta dimensionalidade. Sempre reduza com PCA primeiro.
