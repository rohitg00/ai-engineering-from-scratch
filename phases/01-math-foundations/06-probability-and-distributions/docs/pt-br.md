# Probabilidade e Distribuições

> Probabilidade é a linguagem que a IA usa pra expressar incerteza.

**Tipo:** Aprender
**Linguagem:** Python
**Pré-requisitos:** Fase 1, Aulas 01-04
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Implementar FDPs e FDCs do zero para distribuições de Bernoulli, categórica, Poisson, uniforme e normal
- Computar valor esperado, variância e usar o Teorema Central do Limite pra explicar por que gaussianas dominam
- Construir funções softmax e log-softmax com o truque de estabilidade numérica (subtrair o máximo logit)
- Calcular perda de entropia cruzada a partir de logits e conectá-la à verossimilhança negativa

## O Problemo

Um classificador produz `[0.03, 0.91, 0.06]`. Um modelo de linguagem escolhe a próxima palavra entre 50.000 candidatos. Um modelo de difusão gera imagens amostrando de distribuições aprendidas. Tudo isso é probabilidade em ação.

Toda previsão que um modelo faz é uma distribuição de probabilidade. Toda função de perda mede quão longe a distribuição prevista está da verdadeira. Toda etapa de treino ajusta parâmetros pra fazer uma distribuição parecer mais com outra. Sem probabilidade, você não consegue ler um único paper de ML, depurar um único modelo, ou entender por que sua perda de treino é NaN.

## O Conceito

### Eventos, Espaços Amostrais e Probabilidade

O espaço amostral S é o conjunto de todos os resultados possíveis. Um evento é um subconjunto do espaço amostral. Probabilidade mapeia eventos em números entre 0 e 1.

```
Cara ou coroa:
  S = {C, K}
  P(C) = 0.5,  P(K) = 0.5

Lançamento de dado:
  S = {1, 2, 3, 4, 5, 6}
  P(par) = P({2, 4, 6}) = 3/6 = 0.5
```

Três axiomas definem toda probabilidade:
1. P(A) >= 0 para qualquer evento A
2. P(S) = 1 (alguma coisa sempre acontece)
3. P(A ou B) = P(A) + P(B) quando A e B não podem acontecer ao mesmo tempo

Tudo o mais (teorema de Bayes, esperanças, distribuições) segue dessas três regras.

### Probabilidade Condicional e Independência

P(A|B) é a probabilidade de A dado que B aconteceu.

```
P(A|B) = P(A e B) / P(B)

Exemplo: baralho de cartas
  P(Rei | Figure) = P(Rei e Figure) / P(Figure)
                   = (4/52) / (12/52)
                   = 4/12 = 1/3
```

Dois eventos são independentes quando saber um não diz nada sobre o outro:

```
Independentes:   P(A|B) = P(A)
Equivalente a: P(A e B) = P(A) * P(B)
```

Lançamentos de moeda são independentes. Tirar cartas sem reposição não é.

### Função de Massa de Probabilidade vs Função de Densidade de Probabilidade

Variáveis aleatórias discretas têm uma função de massa de probabilidade (PMF). Cada resultado tem uma probabilidade eespecificaçãoífica que você pode ler diretamente.

```
PMF: P(X = k)

Dado justo:
  P(X = 1) = 1/6
  P(X = 2) = 1/6
  ...
  P(X = 6) = 1/6

  Soma de todas probabilidades = 1
```

Variáveis aleatórias contínuas têm uma função de densidade de probabilidade (PDF). A densidade em um único ponto não é uma probabilidade. Probabilidade vem de integrar a densidade sobre um intervalo.

```
PDF: f(x)

P(a <= X <= b) = integral de f(x) de a a b

f(x) pode ser maior que 1 (densidade, não probabilidade)
integral de -inf a +inf de f(x) dx = 1
```

Essa distinção importa no ML. Saídas de classificação são PMFs (escolhas discretas). Espaços latentes de VAEs usam PDFs (contínuos).

### Distribuições Comuns

**Bernoulli:** um ensaio, dois resultados. Modela classificação binária.

```
P(X = 1) = p
P(X = 0) = 1 - p
Média = p,  Variância = p(1-p)
```

**Categórica:** um ensaio, k resultados. Modela classificação multiclasse (saída softmax).

```
P(X = i) = p_i,  onde soma de p_i = 1
Exemplo: P(gato) = 0.7,  P(cachorro) = 0.2,  P(pássaro) = 0.1
```

**Uniforme:** todos resultados igualmente prováveis. Usada para inicialização aleatória.

```
Discreta: P(X = k) = 1/n para k em {1, ..., n}
Contínua: f(x) = 1/(b-a) para x em [a, b]
```

**Normal (Gaussiana):** a curva em campainha. Parametrizada pela média (mu) e variância (sigma^2).

```
f(x) = (1 / sqrt(2*pi*sigma^2)) * exp(-(x - mu)^2 / (2*sigma^2))

Normal padrão: mu = 0, sigma = 1
  68% dos dados dentro de 1 sigma
  95% dentro de 2 sigma
  99.7% dentro de 3 sigma
```

**Poisson:** contagens de eventos raros em um intervalo fixo. Modela taxas de eventos.

```
P(X = k) = (lambda^k * e^(-lambda)) / k!
Média = lambda,  Variância = lambda
```

### Valor Esperado e Variância

Valor esperado é a média ponderada dos resultados.

```
Discreta:   E[X] = soma de x_i * P(X = x_i)
Contínua: E[X] = integral de x * f(x) dx
```

Variância mede a dispersão em torno da média.

```
Var(X) = E[(X - E[X])^2] = E[X^2] - (E[X])^2
Desvio padrão = sqrt(Var(X))
```

No ML, valor esperado aparece como função de perda (média da perda sobre a distribuição de dados). Variância diz sobre a estabilidade do modelo. Alta variância em gradientes significa treino ruidoso.

### Distribuições Conjuntas e Marginais

Uma distribuição conjunta P(X, Y) descreve duas variáveis aleatórias juntas.

Exemplo de PMF conjunta (X = clima, Y = guarda-chuva):

| | Y=0 (sem guarda-chuva) | Y=1 (guarda-chuva) | Marginal P(X) |
|---|---|---|---|
| X=0 (sol) | 0.40 | 0.10 | P(X=0) = 0.50 |
| X=1 (chuva) | 0.05 | 0.45 | P(X=1) = 0.50 |
| **Marginal P(Y)** | P(Y=0) = 0.45 | P(Y=1) = 0.55 | 1.00 |

A distribuição marginal soma a outra variável:

```
P(X = x) = soma sobre todos y de P(X = x, Y = y)
```

Os totais de linha e coluna na tabela acima são as marginais.

### Por que a Distribuição Normal Aparece em Todo Lugar

O Teorema Central do Limite: a soma (ou média) de muitas variáveis aleatórias independentes converge para uma distribuição normal, independente da distribuição original.

```
Lançar 1 dado:  distribuição uniforme (plana)
Média de 2 dados:  triangular (picada)
Média de 30 dados: quase perfeita curva em campainha

Isso funciona para QUALQUER distribuição inicial.
```

É por isso que:
- Erros de medicação são aproximadamente normais (muitas fontes independentes pequenas)
- Inicializações de pesos em redes neurais usam distribuições normais
- Ruído de gradiente em SGD é aproximadamente normal (soma de muitos gradientes de amostras)
- A distribuição normal é a distribuição de máxima entropia para uma média e variância dadas

### Log Probabilidades

Probabilidades brutas causam problemas numéricos. Multiplicar muitas probabilidades pequenas rapidamente cai em underflow pra zero.

```
P(frase) = P(palavra1) * P(palavra2) * ... * P(palavra_n)
           = 0.01 * 0.003 * 0.02 * ...
           -> 0.0 (underflow depois de ~30 termos)
```

Log probabilidades resolvem isso. Multiplicações viram somas.

```
log P(frase) = log P(palavra1) + log P(palavra2) + ... + log P(palavra_n)
              = -4.6 + -5.8 + -3.9 + ...
              -> número finito (sem underflow)
```

Regras:
- log(a * b) = log(a) + log(b)
- log probabilidades são sempre <= 0 (já que 0 < P <= 1)
- Mais negativo = menos provável
- Perda de entropia cruzada é a log probabilidade negativa da classe correta

### Softmax como Distribuição de Probabilidade

Redes neurais produzem escores brutos (logits). Softmax os converte em uma distribuição de probabilidade válida.

```
softmax(z_i) = exp(z_i) / soma(exp(z_j) para todo j)

Propriedades:
  - Todas saídas estão em (0, 1)
  - Todas saídas somam 1
  - Preserva ordenação relativa das entradas
  - exp() amplifica diferenças entre logits
```

O truque do softmax: subtrair o máximo logit antes de exponenciar pra prevenir overflow.

```
z = [100, 101, 102]
exp(102) = overflow

z_shifted = z - max(z) = [-2, -1, 0]
exp(0) = 1  (seguro)

Mesmo resultado, sem overflow.
```

Log-softmax combina softmax e log para estabilidade numérica. PyTorch usa isso internamente para perda de entropia cruzada.

### Amostragem

Amostragem significa desenhar valores aleatórios de uma distribuição. No ML:
- Dropout amostra aleatoriamente quais neurônios zerar
- Augmentação de dados amostra transformações aleatórias
- Modelos de linguagem amostram o próximo token da distribuição prevista
- Modelos de difusão amostram ruído e desenham progressivamente

Amostrar de distribuições arbitrárias requer técnicas como amostragem por transformação inversa, amostragem por rejeição, ou o truque de reparametrização (usado em VAEs).

## Construa

### Passo 1: Fundamentos de probabilidade

```python
import math
import random

def factorial(n):
    result = 1
    for i in range(2, n + 1):
        result *= i
    return result

def combinations(n, k):
    return factorial(n) // (factorial(k) * factorial(n - k))

def conditional_probability(p_a_and_b, p_b):
    return p_a_and_b / p_b

p_king_given_face = conditional_probability(4/52, 12/52)
print(f"P(Rei | Figure) = {p_king_given_face:.4f}")
```

### Passo 2: PMF e PDF do zero

```python
def bernoulli_pmf(k, p):
    return p if k == 1 else (1 - p)

def categorical_pmf(k, probs):
    return probs[k]

def poisson_pmf(k, lam):
    return (lam ** k) * math.exp(-lam) / factorial(k)

def uniform_pdf(x, a, b):
    if a <= x <= b:
        return 1.0 / (b - a)
    return 0.0

def normal_pdf(x, mu, sigma):
    coeff = 1.0 / (sigma * math.sqrt(2 * math.pi))
    exponent = -0.5 * ((x - mu) / sigma) ** 2
    return coeff * math.exp(exponent)
```

### Passo 3: Valor esperado e variância

```python
def expected_value(values, probabilities):
    return sum(v * p for v, p in zip(values, probabilities))

def variance(values, probabilities):
    mu = expected_value(values, probabilities)
    return sum(p * (v - mu) ** 2 for v, p in zip(values, probabilities))

die_values = [1, 2, 3, 4, 5, 6]
die_probs = [1/6] * 6
mu = expected_value(die_values, die_probs)
var = variance(die_values, die_probs)
print(f"Dado: E[X] = {mu:.4f}, Var(X) = {var:.4f}, DP = {var**0.5:.4f}")
```

### Passo 4: Amostragem de distribuições

```python
def sample_bernoulli(p, n=1):
    return [1 if random.random() < p else 0 for _ in range(n)]

def sample_categorical(probs, n=1):
    cumulative = []
    total = 0
    for p in probs:
        total += p
        cumulative.append(total)
    samples = []
    for _ in range(n):
        r = random.random()
        for i, c in enumerate(cumulative):
            if r <= c:
                samples.append(i)
                break
    return samples

def sample_normal_box_muller(mu, sigma, n=1):
    samples = []
    for _ in range(n):
        u1 = random.random()
        u2 = random.random()
        z = math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)
        samples.append(mu + sigma * z)
    return samples
```

### Passo 5: Softmax e log probabilidades

```python
def softmax(logits):
    max_logit = max(logits)
    shifted = [z - max_logit for z in logits]
    exps = [math.exp(z) for z in shifted]
    total = sum(exps)
    return [e / total for e in exps]

def log_softmax(logits):
    max_logit = max(logits)
    shifted = [z - max_logit for z in logits]
    log_sum_exp = max_logit + math.log(sum(math.exp(z) for z in shifted))
    return [z - log_sum_exp for z in logits]

def cross_entropy_loss(logits, target_index):
    log_probs = log_softmax(logits)
    return -log_probs[target_index]
```

### Passo 6: Demonstração do Teorema Central do Limite

```python
def demonstrate_clt(dist_fn, n_samples, n_averages):
    averages = []
    for _ in range(n_averages):
        samples = [dist_fn() for _ in range(n_samples)]
        averages.append(sum(samples) / len(samples))
    return averages
```

Implementações completas com todas as visualizações estão em `code/probability.py`.

## Use

Com NumPy e SciPy, tudo acima são uma linha:

```python
import numpy as np
from scipy import stats

normal = stats.norm(loc=0, scale=1)
samples = normal.rvs(size=10000)
print(f"Média: {np.mean(samples):.4f}, DP: {np.std(samples):.4f}")
print(f"P(X < 1.96) = {normal.cdf(1.96):.4f}")

logits = np.array([2.0, 1.0, 0.1])
from scipy.especificaçãoial import softmax, log_softmax
probs = softmax(logits)
log_probs = log_softmax(logits)
print(f"Softmax: {probs}")
print(f"Log-softmax: {log_probs}")
```

Você construiu isso do zero. Agora você sabe o que as chamadas de biblioteca estão fazendo.

## Exercícios

1. Implemente amostragem por transformação inversa para a distribuição exponencial. Verifique amostrando 10.000 valores e comparando o histograma com a PDF verdadeira.

2. Construa uma tabela de distribuição conjunta para dois dados viciados. Compute as distribuições marginais e verifique se os dados são independentes.

3. Compute a perda de entropia cruzada para um classificador de 5 classes que produz logits `[2.0, 0.5, -1.0, 3.0, 0.1]` quando a classe correta é o índice 3. Depois verifique sua resposta com `nn.CrossEntropyLoss` do PyTorch.

4. Escreva uma função que recebe uma lista de log probabilidades e retorna a sequência mais provável, a log probabilidade total e a probabilidade bruta equivalente. Teste com uma frase de 50 palavras onde cada palavra tem probabilidade 0.01.

## Termos Chave

| Termo | O que dizem | O que realmente significa |
|------|----------------|----------------------|
| Espaço amostral | "Todas as possibilidades" | O conjunto S de todo resultado possível de um experimento |
| PMF | "A função de probabilidade" | Uma função que dá a probabilidade exata de cada resultado discreto, somando 1 |
| PDF | "A curva de probabilidade" | Uma função de densidade para variáveis contínuas. Integre-a sobre um intervalo pra obter probabilidade |
| Probabilidade condicional | "Probabilidade dado algo" | P(A\|B) = P(A e B) / P(B). A base do pensamento bayesiano e do teorema de Bayes |
| Independência | "Não se afetam" | P(A e B) = P(A) * P(B). Saber um evento não diz nada sobre o outro |
| Valor esperado | "A média" | A soma ponderada por probabilidade de todos resultados. A função de perda é um valor esperado |
| Variância | "Quão disperso" | A média do desvio quadrático da média. Alta variância = estimativas ruidosas, instáveis |
| Distribuição normal | "A curva em campainha" | f(x) = (1/sqrt(2*pi*sigma^2)) * exp(-(x-mu)^2/(2*sigma^2)). Aparece em todo lugar por causa do TCL |
| Teorema Central do Limite | "Médias viram normais" | A média de muitas amostras independentes converge pra uma distribuição normal independente da origem |
| Distribuição conjunta | "Duas variáveis juntas" | P(X, Y) descreve a probabilidade de toda combinação de resultados de X e Y |
| Log probabilidade | "Log da probabilidade" | log P(x). Transforma produtos em somas, prevenindo underflow numérico em sequências longas |
| Softmax | "Transformar escores em probabilidades" | softmax(z_i) = exp(z_i) / soma(exp(z_j)). Mapeia logits reais pra uma distribuição de probabilidade válida |
| Entropia cruzada | "A função de perda" | -soma(p_true * log(p_predicted)). Mede quão diferentes duas distribuições são. Menor é melhor |
| Logits | "Saídas brutas do modelo" | Escores não normalizados antes do softmax. Nomeados após a função logística |
| Amostragem | "Desenhar valores aleatórios" | Gerar valores de acordo com uma distribuição de probabilidade. Como modelos geram saída |

## Leitura Complementar

- [3Blue1Brown: Mas o que é o Teorema Central do Limite?](https://www.youtube.com/watch?v=zeJD6dqJ5lo) — prova visual de por que médias viram normais
- [Revisão de Probabilidade do Stanford CS229](https://cs229.stanford.edu/section/cs229-prob.pdf) — referência concisa cobrindo tudo aqui e mais
- [O Truque Log-Sum-Exp](https://gregorygundersen.com/blog/2020/02/09/log-sum-exp/) — por que estabilidade numérica importa e como alcançá-la
