# Estatística para Machine Learning

> Estatística é como você sabe se seu modelo realmente funciona ou só teve sorte.

**Tipo:** Construção
**Idioma:** Python
**Pré-requisitos:** Fase 1, Lições 06 (Probabilidade e Distribuições), 07 (Teorema de Bayes)
**Tempo:** ~120 minutos

## Objetivos de Aprendizado

- Computar estatísticas descritivas, correlação de Pearson/Spearman e matrizes de covariância do zero
- Realizar testes de hipótese (t-test, chi-quadrado) e interpretar p-valores e intervalos de confiança corretamente
- Usar bootstrap resampling para construir intervalos de confiança para qualquer métrica sem suposições de distribuição
- Distinguir significância estatística de significância prática usando medidas de tamanho de efeito

## O Problema

Você treinou dois modelos. Modelo A pontua 0.87 no seu teste. Modelo B pontua 0.89. Você deploya o Modelo B. Três semanas depois, as métricas de produção estão piores. O que aconteceu?

O Modelo B não superou realmente o Modelo A. A diferença de 0.02 era ruído. Seu conjunto de teste era pequeno demais, ou a variância alta demais, ou ambos. Você entregou aleatoriedade disfarçada de melhoria.

Isso acontece o tempo todo. Mudanças no ranking do Kaggle. Papers que falham em reproduzir. Testes A/B que declaram vencedores com poucas centenas de amostras. A causa raiz é sempre a mesma: alguém pulou a estatística.

Estatística te dá as ferramentas para distinguir sinal de ruído. Ela diz quando uma diferença é real, quão confiante você deve ser, e quanta dados você precisa antes de confiar em um resultado.

## O Conceito

### Estatísticas Descritivas

Antes de modelar qualquer coisa, você precisa saber como seus dados são. Estatísticas descritivas comprimem um dataset em alguns números que capturam sua forma.

**Medidas de tendência central** respondem "onde está o meio?"

```
Média:     soma de todos valores / contagem
Mediana:   valor do meio quando ordenado (robusta a outliers)
Moda:      valor mais frequente
```

**Medidas de dispersão** respondem "quão dispersos são os dados?"

```
Variância:          média dos desvios quadrados da média
Desvio padrão:      raiz quadrada da variância
IQR:                Q3 - Q1 (intervalo interquartil)
```

### Correlação

**Coeficiente de correlação de Pearson** mede associação linear:

```
r = +1:  relação linear positiva perfeita
r = -1:  relação linear negativa perfeita
r =  0:  sem relação linear
```

**Correlação de Spearman** mede associação monotônica usando ranks.

**Regra de ouro:** correlação não implica causalidade.

### Matriz de Covariância

A covariância entre duas variáveis mede como elas variam juntas:

```
Cov(X, Y) > 0:  X e Y tendem a aumentar juntos
Cov(X, Y) < 0:  quando X aumenta, Y tende a diminuir
Cov(X, Y) = 0:  sem co-movimento linear
```

### Testes de Hipótese

O p-valor é a probabilidade de ver dados tão extremos quanto os observados, assumindo que H0 é verdadeira. NÃO é a probabilidade de que H0 seja verdadeira.

```
Se p-valor < alpha (tipicamente 0.05):
    Rejeite H0. O resultado é "estatisticamente significativo."
Se p-valor >= alpha:
    Falha em rejeitar H0. Você não tem evidência suficiente.
```

### Intervalos de Confiança

```
Intervalo de confiança de 95% para a média:
    x_bar +/- z * (s / sqrt(n))
    onde z = 1.96 para 95% de confiança
```

### T-test

T-test compara médias. Existem vários tipos:

- **Amostra única:** a média populacional difere de um valor hipotético?
- **Duas amostras (independentes):** duas médias de grupo são diferentes?
- **Pareado:** quando as medições vêm em pares

### Teste Chi-Quadrado

Verifica se frequências observadas combinam com frequências esperadas. Útil para dados categóricos.

### Teste A/B para Modelos de ML

```
1. Defina sua métrica e nível de significância
2. Rode ambos os modelos nos mesmos splits de validação cruzada
3. Colete escores pareados
4. Compute diferenças: d_i = b_i - a_i
5. Execute um t-test pareado nas diferenças
6. Verifique: a média difere significativamente de 0?
7. Compute intervalo de confiança para a diferença média
8. Compute tamanho do efeito (Cohen's d)
```

### Significância Estatística vs Significância Prática

Um resultado pode ser estatisticamente significativo mas praticamente irrelevante. Com dados suficientes, até uma diferença trivial se torna significativa.

**Tamanho do efeito** quantifica o quão grande é a diferença:

```
d = 0.2:  efeito pequeno
d = 0.5:  efeito médio
d = 0.8:  efeito grande
```

### Métodos Bootstrap

Bootstrap estima a distribuição de amostragem de uma estatística por resampling com reposição. Sem suposições sobre a distribuição subjacente.

### Teorema Central do Limite

Diz que a distribuição das médias amostrais se aproxima de uma normal conforme n cresce.

```
Se X_1, X_2, ..., X_n são iid com média mu e variância sigma^2:
    X_bar ~ Normal(mu, sigma^2 / n)    quando n -> infinito
```

## Construa

Você implementará:
1. Estatísticas descritivas do zero
2. Funções de correlação (Pearson e Spearman)
3. Testes de hipótese (t-test de amostra única, duas amostras, chi-quadrado)
4. Intervalos de confiança bootstrap
5. Simulador de teste A/B
6. Demo significância estatística vs prática

Tudo do zero, usando apenas `math` e `random`. Sem numpy, sem scipy.

## Termos-Chave

| Termo | Definição |
|-------|-----------|
| Média | Soma dos valores dividida pela contagem |
| Mediana | Valor do meio dos dados ordenados |
| Desvio padrão | Raiz quadrada da variância |
| Percentil | Valor abaixo do qual uma porcentagem dos dados cai |
| IQR | Intervalo interquartil. Q3 menos Q1 |
| Correlação Pearson | Mede associação linear entre duas variáveis |
| p-valor | Probabilidade dos dados serem tão extremos dado H0 verdadeira |
| Bootstrap | Resampling com reposição para estimar distribuições de amostragem |
| Teorema central do limite | Médias amostrais convergem para distribuição normal |

## Leitura Adicional

- [An Introduction to Statistical Learning (ISLR)](https://www.statlearning.com/) -- referência acessível para estatística em ML
- [The Art of Statistics (Spiegelhalter)](https://www.amazon.com/Art-Statistics-Learning-Data-Using/dp/1541618518) -- estatística com intuição e exemplos reais
