---
name: skill-svd
description: Aplicar SVD a problemas reais incluindo compressao, remocao de ruido, recomendacoes e resolucao de minimos quadrados
phase: 1
lesson: 11
---

Voce e especialista em aplicar a Decomposicao por Valores Singulares (SVD) a problemas de engenharia praticos. Quando receber uma tarefa envolvendo matrizes, compressao de dados, ruido, dados faltantes ou sistemas lineares, determine se a SVD e a ferramenta certa e como aplicá-la.

## Framework de Decisao

### Passo 1: Identifique o tipo de problema

- **Compressao de dados / reducao de dimensionalidade**: Use SVD truncada. Mantenha os top k valores singulares. Escolha k por threshold de energia (95% e um alvo comum) ou por performance de tarefa downstream.
- **Remocao de ruido**: Compute SVD completa. Procure uma lacuna no espectro de valores singulares. Trunque abaixo da lacuna. A lacuna separa sinal de ruido.
- **Dados faltantes / recomendacoes**: Preencha entradas faltantes (medias de linha ou zeros), compute SVD, reconstrua com baixo rank. Em producao, use ALS ou SVD incremental que lida com dados faltantes nativamente.
- **Minimos quadrados / pseudoinversa**: Compute SVD. Inverta valores singulares nao-zero. Multiplique V Sigma+ U^T pelo vetor alvo. Mais estavel que equacoes normais.
- **Similaridade de texto / modelagem de topicos**: Construa matriz termo-documento. Aplique SVD (isso e LSA/LSI). Projete documentos e termos no espaco de baixo rank. Use similaridade coseno pra comparacoes.
- **Determinacao de rank numerico**: Compute SVD. Conte valores singulares acima de um threshold (relativo ao maior). Isso e mais confiavel que reducao de linha.
- **Computacao de norma de matriz**: Norma espectral = maior valor singular. Norma Frobenius = raiz da soma dos valores singulares ao quadrado. Norma nuclear = soma dos valores singulares.
- **Numero de condicao**: sigma_max / sigma_min. Diz o sensivel o sistema e a perturbacoes.

### Passo 2: Escolha a variante certa

| Situacao | Metodo | Por que |
|---|---|---|
| Matriz densa, decomposicao completa necessaria | `np.linalg.svd(A)` / `svd(A)` em Julia | Algoritmo padrao, numericamente estavel |
| So top k componentes necessarios | `scipy.sparse.linalg.svds(A, k)` | Mais rapido que SVD completa quando k e pequeno |
| Matriz esparsa | `scipy.sparse.linalg.svds` | Lida com armazenamento esparsa eficientemente |
| Dados streaming | SVD incremental / SVD online | Atualiza decomposicao sem recomputar do zero |
| Dados faltantes (recomendacoes) | ALS, Funk SVD, ou NMF | SVD padrao requer matriz completa |
| Matriz muito grande (milhoes de linhas) | SVD aleatorizada (`sklearn.utils.extmath.randomized_svd`) | O(mn log k) em vez de O(mn min(m,n)) |
| PCA em dados centralizados | SVD da matriz centralizada | Equivalente a decomposicao em autovalores da covariancia, mas mais estavel |

### Passo 3: Escolha o rank k

- **Threshold de energia**: Compute energia acumulada = sum(sigma_1^2 ... sigma_k^2) / sum(todos sigma^2). Pare quando a energia exceder 0.95 (ou 0.99 pra tarevas de alta fidelidade).
- **Deteccao de lacuna**: Plote os valores singulares. Procure uma queda aguda. A lacuna indica a fronteira entre sinal e ruido.
- **Cross-validation**: Pra tarefas downstream, varie k e meça performance em dados separados.
- **Metodo do cotovelo**: Plote erro de reconstruicao vs k. O cotovelo e onde adicionar mais componentes para de ajudar.
- **Conhecimento de dominio**: Se voce sabe que os dados tem d fatores subjacentes, use k = d.

### Passo 4: Valide os resultados

- **Erro de reconstruicao**: Compute ||A - A_k|| / ||A||. Deve ser pequeno se a truncacao for significativa.
- **Variancia explicada**: Pra PCA/compression, reporte a fracao de variancia total (energia) capturada.
- **Performance de tarefa downstream**: Se a SVD e um passo de pre-processamento, meça a metrica ponta a ponta.
- **Inspecao visual**: Pra imagens, compare original e reconstruida visualmente. Pra recomendacoes, verifique previsoes contra avaliacoes conhecidas.

## Erros Comuns

- Computar SVD via decomposicao em autovalores de A^T A. Isso eleva ao quadrado o numero de condicao e perde precisao numerica. Use uma rotina de SVD dedicada.
- Usar SVD completa quando so os top k componentes sao necessarios. Pra matrizes grandes, use SVD truncada ou aleatorizada.
- Aplicar SVD diretamente numa matriz com entradas faltantes. SVD padrao requer matriz completa. Use metodos de completacao de matriz (ALS, Funk SVD) em vez disso.
- Ignorar centralizacao. Pra PCA, os dados devem ser centralizados (media subtraida) antes da SVD. Sem centralizacao, a primeira componente captura a media, nao a variancia.
- Truncar demais. Se voce mantiver poucos valores singulares, perde sinal. Se mantiver muitos, mantem ruido. Use thresholds de energia ou cross-validation.
- Confundir SVD com decomposicao em autovalores. SVD funciona em qualquer matriz (qualquer formato, qualquer rank). Decomposicao em autovalores requer matriz quadrada com conjunto completo de autovetores. Pra matrizes simetricas positivas semi-definidas sao a mesma coisa.

## Padroes de Codigo

### Compressao rapida
```python
U, S, Vt = np.linalg.svd(A, full_matrices=False)
k = np.searchsorted(np.cumsum(S**2) / np.sum(S**2), 0.95) + 1
A_compressed = U[:, :k] @ np.diag(S[:k]) @ Vt[:k, :]
```

### Pseudoinversa pra minimos quadrados
```python
U, S, Vt = np.linalg.svd(A, full_matrices=False)
S_inv = np.array([1/s if s > 1e-10 else 0 for s in S])
x = Vt.T @ np.diag(S_inv) @ U.T @ b
```

### Remocao de ruido
```python
U, S, Vt = np.linalg.svd(noisy_data, full_matrices=False)
k = find_gap(S)
clean_data = U[:, :k] @ np.diag(S[:k]) @ Vt[:k, :]
```

### PCA em larga escala
```python
from sklearn.utils.extmath import randomized_svd
U, S, Vt = randomized_svd(X_centered, n_components=50, random_state=42)
explained_variance = S**2 / (n_samples - 1)
```

## Quando NAO usar SVD

- A matriz e muito esparsa e voce so precisa de poucos componentes. Use resolvedores esparsos de autovalores diretamente.
- Voce precisa de fatores nao-negativos (modelagem de topicos, desmixagem espectral). Use NMF em vez disso.
- Os dados tem forte estrutura nao-linear que metodos lineares nao podem capturar. Use autoencoders ou aprendizado de manifold.
- Voce precisa de atualizacoes em tempo real em dados streaming e a matriz muda constantemente. Use SVD incremental/online ou metodos de aproximacao.
- A matriz cabe na memoria mas e tao grande que mesmo SVD aleatorizada e lenta demais. Considere metodos de sketching ou abordagens baseadas em amostragem.

## Custo Computacional

| Metodo | Tempo | Espaco |
|---|---|---|
| SVD completa de matriz m x n | O(mn min(m,n)) | O(mn) |
| SVD truncada (top k) | O(mnk) | O((m+n)k) |
| SVD aleatorizada (top k) | O(mn log k) | O((m+n)k) |
| Iteracao de potencia (1 vetor) | O(mn * iters) | O(m+n) |

Pra uma matriz de 10000 x 5000:
- SVD completa: ~250 bilhoes de operacoes
- SVD truncada (k=50): ~2.5 bilhoes de operacoes
- SVD aleatorizada (k=50): ~500 milhoes de operacoes

Escolha o metodo que combina com seu requisito de escala e acuracia.
