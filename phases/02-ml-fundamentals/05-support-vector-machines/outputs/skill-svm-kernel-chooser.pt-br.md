---
name: skill-svm-kernel-chooser
description: Escolher o kernel certo de SVM e ajustar C e gamma pro seu problema
version: 1.0.0
phase: 2
lesson: 5
tags: [svm, kernel, classification, hyperparameter-tuning]
---

# Guia de Selecao de Kernel SVM

SVMs sao definidas por duas escolhas: o kernel (que determina a forma da fronteira de decisao) e os parametros de regularizacao (que controlam o tradeoff entre largura da margem e erros de classificacao). Acertar isso e a diferenca entre um modelo inutil e um forte.

## Checklist de Decisao

1. Os dados sao linearmente separaveis (ou proximos disso)?
   - Sim: use kernel linear. E mais rapido e mais interpretavel.
   - Nao: va pro passo 2.

2. Quantas features vs amostras?
   - Features >> amostras (ex: texto com TF-IDF): use kernel linear. Dados de alta dimensionalidade sao frequentemente linearmente separaveis. RBF adiciona complexidade sem ganho.
   - Amostras >> features (ex: dados tabulares com 10-50 features): kernel RBF e a escolha padrao.

3. A fronteira de decisao deve ser suave?
   - Fronteira suave, continua: kernel RBF
   - Fronteira de formato polinomial: kernel polinomial (comece com grau 2 ou 3)
   - Conhecimento do dominio sugere termos de interacao especificos: kernel polinomial com grau correspondente

4. Quao grande e o dataset?
   - Menos de 10.000 amostras: qualquer kernel funciona, RBF e o seguro padrao
   - 10.000 a 100.000: kernel linear ou LinearSVC (formulacao primal, O(n) por epoch)
   - Mais de 100.000: nao use kernel SVM. Mude pra SVM linear, gradient boosting, ou redes neurais.

5. Voce escalou as features?
   - SVMs requerem escalonamento de features. Sempre padronize (media zero, variancia unitaria) antes de ajustar. Features nao-escaladas distorcem a geometria da margem.

## Fluxograma de selecao de kernel

```
Inicio
  |
  v
Features > 1000 ou features >> amostras?
  Sim --> Kernel linear (LinearSVC pra velocidade)
  Nao  --> Dataset < 10k amostras?
            Sim --> Tente RBF primeiro (melhor kernel geral)
            Nao  --> Kernel linear (kernels SVM sao O(n^2) a O(n^3))
```

Se RBF nao funcionar bem, tente polinomial grau 2-3. Se falhar, o problema pode nao ser adequado pra SVMs.

## Ajuste de C (regularizacao)

C controla a penalidade pra classificacoes erradas. E inversamente relacionado a forca de regularizacao.

| Valor de C | Efeito | Quando usar |
|---|---|---|
| 0.001 - 0.01 | Margem larga, muitas violacoes permitidas | Dados ruidosos, quer generalizacao |
| 0.1 - 1.0 | Equilibrado | Bom intervalo inicial |
| 10 - 1000 | Margem estreita, poucas violacoes | Dados limpos, precisa de alta acuracia |

Estrategia de ajuste:
- Comece com C=1.0
- Busque em escala logaritmica: [0.001, 0.01, 0.1, 1, 10, 100, 1000]
- Use cross-validation pra escolher o melhor valor
- Se o melhor C estiver na borda do seu intervalo, estenda naquela direcao

## Ajuste de gamma (kernel RBF)

Gamma controla quao longe a influencia de um ponto de treino alcanca. Define a largura da Gaussiana.

| Valor de gamma | Efeito | Quando usar |
|---|---|---|
| Pequeno (0.001) | Cada ponto influencia area grande. Fronteira suave, simples | Underfitting ou poucas features |
| Medio (auto: 1/n_features) | Padrao sklearn. Ponto de partida razoavel | Uso geral |
| Grande (10+) | Cada ponto influencia so pontos proximos. Fronteira complexa, ondulada | Risco de overfitting |

Estrategia de ajuste:
- Comece com gamma="scale" (1 / (n_features * X.var()), o padrao do sklearn)
- Busque em escala logaritmica: [0.001, 0.01, 0.1, 1, 10]
- gamma baixo + C alto tende a overfitting
- gamma alto + C baixo tende a underfitting

## Ajuste conjunto de C e gamma

C e gamma interagem. Sempre ajuste juntos, nao independentemente.

Abordagem recomendada:
1. Busca em grade grossa: C em [0.01, 0.1, 1, 10, 100], gamma em [0.001, 0.01, 0.1, 1, 10] (25 combinacoes)
2. Encontre a melhor regiao
3. Busca em grade fina ao redor da melhor regiao (ex: C em [5, 10, 20, 50], gamma em [0.05, 0.1, 0.2])
4. Use cross-validation de 5-fold durante todo o processo

## Erros comuns

- Usar kernel RBF em dados esparsos de alta dimensionalidade (linear e melhor e 100x mais rapido)
- Esquecer de escalar features (o erro mais comum de SVM)
- Definir C alto demais em dados ruidosos (memoriza ruido em vez de aprender a fronteira)
- Usar kernel SVM em datasets com mais de 50k amostras (tempo de treinamento proibitivo)
- Nao ajustar C e gamma juntos (eles compensam um ao outro)
- Usar polinomial grau 5+ por padrao (overfita agressivamente, tente 2 ou 3 primeiro)

## Referencia rapida

| Kernel | Quando usar | Parametros-chave | Complexidade de treino |
|--------|------------|----------------|-------------------|
| Linear | Texto/TF-IDF, muitas features, dados grandes | So C | O(n) por epoch |
| RBF | Geral, menos de 10k amostras | C, gamma | O(n^2) a O(n^3) |
| Polinomial | Relacoes polinomiais conhecidas | C, grau, coef0 | O(n^2) a O(n^3) |
| Sigmoid | Raramente util (equivalente a rede neural de duas camadas) | C, gamma, coef0 | O(n^2) a O(n^3) |
