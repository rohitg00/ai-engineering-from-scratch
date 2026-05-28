---
name: skill-statistical-testing
description: Escolher o teste estatistico certo pra comparar modelos ML e avaliar experimentos
version: 1.0.0
phase: 1
lesson: 15
tags: [statistics, hypothesis-testing, model-comparison]
---

# Testes Estatisticos pra ML

Como escolher o teste certo ao comparar modelos, rodar experimentos A/B, ou validar resultados.

## Checklist de Decisao

1. O que voce esta comparando? Medias, proporcoes, distribuicoes, ou correlacoes?
2. Quantos grupos? Uma amostra vs referencia, dois grupos, ou multiplos grupos?
3. As observacoes sao pareadas (mesmo teste, mesmos folds) ou independentes?
4. Os dados sao normalmente distribuidos? Se n < 30 e nao claramente normal, use nao-parametrico.
5. Os dados sao continuos, ordinais, ou categoricos?
6. Quantos testes voce esta rodando? Aplique correcao se for mais de um.

## Arvore de decisao

```text
Comparando medias?
  Dois grupos?
    Pareados (mesmos splits de dados)? --> t-test pareado (ou Wilcoxon signed-rank se nao-normal)
    Independentes? --> t-test de Welch (ou Mann-Whitney U se nao-normal)
  Multiplos grupos?
    Pareados? --> ANOVA de medidas repetidas (ou teste de Friedman)
    Independentes? --> ANOVA de um fator (ou Kruskal-Wallis)

Comparando proporcoes?
  Dois grupos? --> Teste do qui-quadrado ou teste exato de Fisher (n pequeno)
  Multiplos grupos? --> Teste do qui-quadrado

Comparando distribuicoes?
  Uma distribuicao e referencia? --> Teste de Kolmogorov-Smirnov
  Ambas empiricas? --> Teste KS de duas amostras

Medindo associacao?
  Ambas continuas, aproximadamente normais? --> Correlacao de Pearson
  Ordinais ou nao-normais? --> Correlacao de postos de Spearman
  Categorica x Categorica? --> Teste do qui-quadrado de independencia

Rodando muitos testes?
  Aplique correcao de Bonferroni: alpha_ajustado = alpha / numero_de_testes
  Ou use Holm-Bonferroni (menos conservativo, ainda controla erro family-wise)
```

## Quando usar cada teste

| Teste | Tipo de dados | Suposicoes | Caso de uso ML |
|---|---|---|---|
| t-test pareado | Continuo, pareado | Diferencas normais | Comparar 2 modelos nos mesmos splits k-fold |
| Wilcoxon signed-rank | Continuo/ordinal, pareado | Nenhum (nao-parametrico) | Comparar 2 modelos, k pequeno (5-10 folds) |
| t-test de Welch | Continuo, independente | Aproximadamente normal | Comparar modelo em dois datasets separados |
| Mann-Whitney U | Continuo/ordinal, independente | Nenhum | Comparar distribuicoes de latencia |
| ANOVA | Continuo, 3+ grupos | Normal, variancia igual | Comparar multiplas arquiteturas de modelo |
| Kruskal-Wallis | Continuo/ordinal, 3+ grupos | Nenhum | Comparar multiplos modelos, metricas nao-normais |
| Qui-quadrado | Contagens categoricas | Contagem esperada >= 5 | Comparar distribuicoes de classe, matrizes de confusao |
| Exato de Fisher | Contagens categoricas | Amostras pequenas | Comparacao de eventos raros |
| Teste KS | Continuo | Nenhum | Verificar se predicoes seguem distribuicao esperada |
| IC por Bootstrap | Qualquer estatistica | Nenhum | Intervalo de confianca pra AUC, F1, qualquer metrica |
| Teste de McNemar | Binario pareado | Nenhum | Comparar dois classificadores no mesmo teste |

## Receita de comparacao de modelos

1. Defina metrica e nivel de significancia (alpha = 0.05) antes de rodar experimentos.
2. Rode ambos modelos nos mesmos splits de cross-validation k-fold (k = 5 ou 10).
3. Colete escores pareados: (a_1, b_1), (a_2, b_2), ..., (a_k, b_k).
4. Compute diferencas: d_i = b_i - a_i.
5. Rode teste pareado (Wilcoxon pra k <= 10, t-test pareado pra k > 10 ou diferencas normais).
6. Reporte: p-valor, media da diferenca, intervalo de confianca de 95%, tamanho do efeito (d de Cohen).
7. Se p < alpha E o tamanho do efeito e significativo, a diferenca e real e vale a pena agir.

## Erros comuns

- Usar teste independente quando dados sao pareados. Se ambos modelos foram avaliados nos mesmos folds de teste, voce DEVE usar teste pareado. Testes independentes jogam fora o pareamento e perdem poder estatistico.
- Reportar p < 0.05 sem tamanho do efeito. Uma melhoria de 0.1% na acuracia que e estatisticamente significativa nao vale implantar. Sempre compute o d de Cohen ou a diferenca bruta de media.
- Comparar modelos em diferentes testes de teste. O teste de teste DEVE ser identico pra ambos modelos. Testes de teste diferentes tornam a comparacao sem sentido.
- Rodar 20 comparacoes e reportar a melhor sem correcao de Bonferroni. Com 20 testes em alpha = 0.05, voce espera 1 falso positivo por chance.
- Usar acuracia em dados desbalanceados. Num dataset com 99% de classe majoritaria, um classificador trivial alcanca 99%. Use F1, AUC precision-recall, ou coeficiente de correlacao de Matthews.
- Tratar folds de cross-validation como amostras independentes. Eles compartilham dados de treinamento, o que viola a suposicao de independencia. O t-test reamostrado corrigido considera isso.

## Referencia rapida: interpretacao do tamanho do efeito

| d de Cohen | Interpretacao |
|---|---|
| 0.2 | Efeito pequeno |
| 0.5 | Efeito medio |
| 0.8 | Efeito grande |
| > 1.0 | Efeito muito grande |

| O que reportar | Por que |
|---|---|
| p-valor | A diferenca e real? |
| Intervalo de confianca | Quao grande a diferenca pode ser? |
| Tamanho do efeito (d de Cohen) | A diferenca e significativa? |
| Tamanho da amostra (n ou k folds) | Podemos confiar no resultado? |
