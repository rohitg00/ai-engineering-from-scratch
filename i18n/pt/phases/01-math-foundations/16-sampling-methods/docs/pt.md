# Métodos de amostragem

> A amostragem é como a IA explora o espaço das possibilidades.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 06-07 (Probability, Bayes' Theorem)
**Time:** ~120 minutes

## Objetivos de aprendizagem

- Implementar a amostragem de CDF inversa, rejeição e importância a partir do zero usando apenas números aleatórios uniformes
- Construir amostragem de temperatura, top-k e top-p (núcleo) para geração de tokens de modelos de linguagem
- Explique o truque de reparametrização e por que permite a propagação de volta através da amostragem em VAEs
- Execute o MCMC Metropolis-Hastings para amostrar de uma distribuição-alvo não normalizada

## O problema

Um modelo de linguagem termina de processar o seu pedido e produz um vetor de 50.000 logits, um para cada token no seu vocabulário.

Se ele sempre escolhe o token de maior probabilidade, cada resposta é idêntica. Determinista. Aborrecido. Se ele escolhe uniformemente ao acaso, a saída é confusa. A resposta vive em algum lugar entre esses extremos, e que em algum lugar é controlada pela amostragem.

A amostragem não se limita à geração de textos. O aprendizado de reforço estima os gradientes das políticas através de trajetórias de amostragem. Os VAEs aprendem representações latentes tomando amostras de distribuições aprendidas e propagando-se para trás através da aleatoriedade. Os modelos de difusão geram imagens através da amostragem de ruído e denociamento iterativo. Os métodos de Monte Carlo estimam integrals que não têm solução fechada. Os algoritmos MCMC exploram distribuições posteriores de alta dimensão que são impossíveis de enumerar.

Cada sistema de IA gerador é um sistema de amostragem. A estratégia de amostragem determina a qualidade, a diversidade e a controlagem da saída. Esta lição constrói todos os principais métodos de amostragem a partir do zero, começando por números aleatórios uniformes e terminando com as técnicas que alimentam os LLMs e modelos geradores modernos.

## O conceito

### Por que é importante tomar amostras

A amostragem aparece em quatro papéis fundamentais em IA e aprendizado de máquina:

**Generation.**Os modelos de linguagem, modelos de difusão e GANs produzem todas as saídas por amostragem. O algoritmo de amostragem controla diretamente a criatividade, a coerência e a diversidade.

**Training.**Estocástico padrão de descida de amostras mini-batches. Desistência de amostras de neurônios para desativar. Ampliação de dados amostras de transformações aleatórias. Importância de amostragem repesam amostras para reduzir a variância de gradiente na aprendizagem de reforço (PPO, TRPO).

**Estimation.**Muitas quantidades em ML não têm solução fechada. A perda esperada sobre uma distribuição de dados, a função de partição de um modelo baseado em energia, a evidência na inferência Bayesiana.

**Exploration.**Algoritmos MCMC exploram distribuições posteriores na inferência Bayesiana. estratégias evolutivas amostram perturbações de parâmetros.

O desafio principal: só pode tomar amostras diretamente de distribuições simples (uniforme, normal).

### Amostra aleatória uniforme

Cada método de amostragem começa aqui. Um gerador de números aleatórios uniforme produz valores em$[0, 1)$onde cada subintervalo de igual comprimento tem igual probabilidade.

```
U ~ Uniform(0, 1)

P(a <= U <= b) = b - a    for 0 <= a <= b <= 1

Properties:
  E[U] = 0.5
  Var(U) = 1/12
```

Para amostragem uniformemente a partir de um conjunto discreto de $n$- a produção de$U$E voltar .$\lfloor n U \rfloor$Para amostragem de um intervalo contínuo$[a, b]$, computação $a + (b - a) U$- Não .

A principal ideia: um único número aleatório uniforme contém exatamente a quantidade certa de aleatoriedade para produzir uma amostra de qualquer distribuição.

### Método de CDF inverso (análise de transformação inversa)

A função de distribuição cumulativa (CDF) mapeia os valores para probabilidades:

```
F(x) = P(X <= x)

Properties:
  F is non-decreasing
  F(-inf) = 0
  F(+inf) = 1
  F maps the real line to [0, 1]
```

O CDF inverso mapeia as probabilidades de volta aos valores.$U \sim \text{Uniform}(0, 1)$, então$X = F^{-1}(U)$segue a distribuição-alvo.

```
Algorithm:
  1. Generate u ~ Uniform(0, 1)
  2. Return F_inverse(u)

Why it works:
  P(X <= x) = P(F_inverse(U) <= x) = P(U <= F(x)) = F(x)
```

**Exponential distribution example:**

```
PDF: f(x) = lambda * exp(-lambda * x),   x >= 0
CDF: F(x) = 1 - exp(-lambda * x)

Solve F(x) = u for x:
  u = 1 - exp(-lambda * x)
  exp(-lambda * x) = 1 - u
  x = -ln(1 - u) / lambda

Since (1 - U) and U have the same distribution:
  x = -ln(u) / lambda
```

Isto funciona perfeitamente quando se pode escrever .$F^{-1}$Para a distribuição normal, não há CDF inverso de forma fechada, por isso usamos outros métodos (Box-Muller, ou aproximação numérica).

**Discrete version:**Para distribuições discretas, construir o CDF como uma soma cumulativa, gerar $U$, e encontrar o primeiro índice onde a soma acumulada exceda $U$É assim que ...`sample_categorical`Trabalha na lição 06.

### Rejeição de amostras

Quando não se pode inverter o CDF, mas pode avaliar o PDF-alvo até uma constante, a amostragem de rejeição funciona.

```
Target distribution: p(x)  (can evaluate, possibly unnormalized)
Proposal distribution: q(x)  (can sample from)
Bound: M such that p(x) <= M * q(x) for all x

Algorithm:
  1. Sample x ~ q(x)
  2. Sample u ~ Uniform(0, 1)
  3. If u < p(x) / (M * q(x)), accept x
  4. Otherwise, reject and go to step 1

Acceptance rate = Z/M, where Z is the integral of p(x)
                (Z = 1, so the rate is 1/M, when p is normalized)
```

Quanto mais apertado for o limite$M$Em dimensões baixas (1-3), a amostragem de rejeição funciona bem. Em dimensões altas, a taxa de aceitação cai exponencialmente porque a maior parte do volume da proposta é rejeitada. Esta é a maldição da dimensionalidade para a amostragem de rejeição.

**Example: sampling from a truncated normal.**Usar uma proposta uniforme sobre a faixa truncada.$M$é o máximo do PDF normal nessa faixa.

**Example: sampling from a semicircle.**Propõe uniformemente no retângulo delimitante. Aceite se o ponto cai dentro do semicírculo.$\pi$: a taxa de aceitação é igual à proporção de área $\pi/4$- Não .

### Importância da amostragem

Às vezes não é necessário obter amostras da distribuição-alvo.$p(x)$Precisas de estimar uma expectativa abaixo de$p(x)$, e tem amostras de uma distribuição diferente .$q(x)$- Não .

```
Goal: estimate E_p[f(x)] = integral of f(x) * p(x) dx

Rewrite:
  E_p[f(x)] = integral of f(x) * (p(x)/q(x)) * q(x) dx
            = E_q[f(x) * w(x)]

where w(x) = p(x) / q(x)  are the importance weights.

Estimator:
  E_p[f(x)] ~ (1/N) * sum(f(x_i) * w(x_i))    where x_i ~ q(x)
```

Isto é fundamental na aprendizagem de reforço.$\pi_{\text{old}}$Mas querem otimizar uma nova política $\pi_{\text{new}}$O peso da importância é$\pi_{\text{new}}(a \mid s) / \pi_{\text{old}}(a \mid s)$O PPO reduz estes pesos para evitar que a nova política se desvie demasiado da antiga.

A variação do estimador de importância da amostragem depende da sua similaridade $q$É para$p$Se ...$q$É muito diferente de $p$A análise de importância auto-normalizada divide pela soma dos pesos para reduzir este problema:

```math
\mathbb{E}_p[f(x)] \approx \frac{\sum_i w_i \, f(x_i)}{\sum_i w_i}
```

### Estimação de Monte Carlo

A estimativa de Monte Carlo aproxima os integrals, mediando amostras aleatórias.

```
Goal: estimate I = integral of g(x) dx over domain D

Method:
  1. Sample x_1, ..., x_N uniformly from D
  2. I ~ (Volume of D / N) * sum(g(x_i))

Error: O(1 / sqrt(N))   regardless of dimension
```

A taxa de erro é independente de dimensões, razão pela qual os métodos de Monte Carlo dominam em dimensões altas onde a integração baseada em rede é impossível.

**Estimating pi:**

```
Sample (x, y) uniformly from [-1, 1] x [-1, 1]
Count how many fall inside the unit circle: x^2 + y^2 <= 1
pi ~ 4 * (count inside) / (total count)
```

**Estimating expectations:**

```
E[f(X)] ~ (1/N) * sum(f(x_i))    where x_i ~ p(x)

The sample mean converges to the true expectation.
Variance of the estimator = Var(f(X)) / N
```

### Cadeia Markov Monte Carlo (MCMC): Metrópole-Hastings

O MCMC construi uma cadeia de Markov cuja distribuição estática é a distribuição-alvo $p(x)$Após passos suficientes, as amostras da cadeia são (aproximadamente) amostras de$p(x)$- Não .

```
Target: p(x)  (known up to a normalizing constant)
Proposal: q(x'|x)  (how to propose the next state given the current state)

Metropolis-Hastings algorithm:
  1. Start at some x_0
  2. For t = 1, 2, ..., T:
     a. Propose x' ~ q(x'|x_t)
     b. Compute acceptance ratio:
        alpha = [p(x') * q(x_t|x')] / [p(x_t) * q(x'|x_t)]
     c. Accept with probability min(1, alpha):
        - If u < alpha (u ~ Uniform(0,1)): x_{t+1} = x'
        - Otherwise: x_{t+1} = x_t
  3. Discard first B samples (burn-in)
  4. Return remaining samples
```

Para propostas simétricas $(q(x' \mid x) = q(x \mid x'))$, a relação é simplificada para $p(x')/p(x)$Este é o algoritmo Metropolis original.

**Why it works.**A regra de aceitação garante um equilíbrio detalhado: a probabilidade de estar em $x$e mudar para$x'$é igual à probabilidade de estar em $x'$e mudar para$x$O equilíbrio detalhado implica que$p(x)$é a distribuição estacionária da cadeia.

**Practical considerations:**
- Combustão: descartar amostras iniciais antes que a cadeia atinja o equilíbrio
- Desminução: mantenha todos$k$-a amostra para reduzir a autocorrelação
- Escala de propostas: muito pequena e a cadeia se move lentamente (alta aceitação, exploração lenta); muito grande e a maioria das propostas é rejeitada (baita aceitação, em vigor)
- A taxa de aceitação ideal para uma proposta gaussiana em dimensões elevadas é de aproximadamente 0,234

### Amostração de Gibbs

A amostragem de Gibbs é um caso especial do MCMC para distribuições multivariadas. Em vez de propor um movimento em todas as dimensões de uma só vez, atualiza uma variável por vez de sua distribuição condicional.

```
Target: p(x_1, x_2, ..., x_d)

Algorithm:
  For each iteration t:
    Sample x_1^{t+1} ~ p(x_1 | x_2^t, x_3^t, ..., x_d^t)
    Sample x_2^{t+1} ~ p(x_2 | x_1^{t+1}, x_3^t, ..., x_d^t)
    ...
    Sample x_d^{t+1} ~ p(x_d | x_1^{t+1}, x_2^{t+1}, ..., x_{d-1}^{t+1})
```

A amostragem de Gibbs exige que você possa amostragem de cada distribuição condicional .$p(x_i \mid x_{-i})$Isto é simples para muitos modelos:
- Redes Bayesianas: os condicionalis seguem a partir da estrutura do gráfico
- Misturas gaussianas: os condicionantes são gaussianas
- Modelos de ising: a condição de cada giro depende apenas de seus vizinhos

A taxa de aceitação é sempre de 1 (todas as propostas são aceitas), porque a amostragem a partir da condição exata satisfaz automaticamente o equilíbrio detalhado.

**Limitation.**Quando as variáveis são altamente correlacionadas, a amostragem de Gibbs mistura-se lentamente porque atualizar uma variável de cada vez não pode fazer grandes movimentos diagonais através da distribuição.

### Amostragem de temperatura (utilizada em LLM)

Modelos de linguagem logs de saída $z_1, \ldots, z_V$Softmax converte estas em probabilidades.

```
p_i = exp(z_i / T) / sum(exp(z_j / T))

T = 1.0: standard softmax (original distribution)
T -> 0:  argmax (deterministic, always picks highest logit)
T -> inf: uniform (all tokens equally likely)
T < 1.0: sharpens the distribution (more confident, less diverse)
T > 1.0: flattens the distribution (less confident, more diverse)
```

**Why it works.**Divisão de logits por $T < 1$A diferença entre as logitas é amplificada.$z_1 = 2$E ...$z_2 = 1$, dividindo por $T = 0.5$dá$z_1/T = 4$E ...$z_2/T = 2$Depois do softmax, o token de logite mais alto recebe uma participação muito maior.

**In practice:**
- $T = 0.0$: codificação gananciosa, melhor para perguntas e respostas factuais
- $T = 0.3\text{-}0.7$: ligeiramente criativo, bom para a geração de código
- $T = 0.7\text{-}1.0$: equilibrado, bom para conversa geral
- $T = 1.0\text{-}1.5$: escrita criativa, brainstorming
- $T > 1.5$: cada vez mais aleatórias, raramente úteis

A temperatura não muda quais tokens são possíveis, mas a massa de probabilidade atribuída a cada token.

### Amostração de Top-k

A amostragem Top-k restringe o candidato definido para o $k$tokens com as maiores probabilidades, então renormaliza e amostras desse conjunto restringido.

```
Algorithm:
  1. Compute softmax probabilities for all V tokens
  2. Sort tokens by probability (descending)
  3. Keep only the top k tokens
  4. Renormalize: p_i' = p_i / sum(p_j for j in top-k)
  5. Sample from the renormalized distribution

k = 1:  greedy decoding
k = V:  no filtering (standard sampling)
k = 40: typical setting, removes long tail of unlikely tokens
```

Top-k impede que o modelo selecione tokens extremamente improváveis (ortografia, disparates) que existem na longa cauda da distribuição do vocabulário.$k$Quando o modelo é confiante (um token tem 95% de probabilidade), $k = 40$Quando o modelo é incerto (a probabilidade é espalhada por 1000 tokens), $k = 40$- Não há opções plausíveis.

### Amostragem de topo (núcleo)

A amostragem top-p ajusta dinamicamente o tamanho do conjunto candidato.Em vez de manter um número fixo de tokens, ele mantém o menor conjunto de tokens cuja probabilidade cumulativa excede $p$- Não .

```
Algorithm:
  1. Compute softmax probabilities for all V tokens
  2. Sort tokens by probability (descending)
  3. Find smallest k such that sum of top-k probabilities >= p
  4. Keep only those k tokens
  5. Renormalize and sample

p = 0.9:  keeps tokens covering 90% of probability mass
p = 1.0:  no filtering
p = 0.1:  very restrictive, nearly greedy
```

Quando o modelo é confiante, a amostragem de núcleo mantém poucos tokens (talvez 2-3). Quando o modelo é incerto, mantém muitos (talvez 200).

**Common combinations:**
- Temperatura 0,7 + p superior 0,9: boa configuração de uso geral
- Temperatura 0,0 (avidas): ideal para tarefas deterministas
- Temperatura 1.0 + top-k 50: Fan et al. (2018) configuração original de papel

Top-k e top-p podem ser combinados. Aplique top-k primeiro, e depois top-p no conjunto restante.

### Tricolor de reparametrização (usado em VAEs)

Os autoencodadores variáveis (VAEs) aprendem codificando entradas em uma distribuição em espaço latente, tomando amostras dessa distribuição e decodificando a amostra de volta.

```
Standard sampling (not differentiable):
  z ~ N(mu, sigma^2)

  The randomness blocks gradient flow.
  d/d_mu [sample from N(mu, sigma^2)] = ???
```

O truque de reparametrização separa a aleatoriedade dos parâmetros:

```
Reparameterized sampling:
  epsilon ~ N(0, 1)          (fixed random noise, no parameters)
  z = mu + sigma * epsilon   (deterministic function of parameters)

  Now z is a deterministic, differentiable function of mu and sigma.
  d(z)/d(mu) = 1
  d(z)/d(sigma) = epsilon

  Gradients flow through mu and sigma.
```

Isto funciona porque$\mathcal{N}(\mu, \sigma^2)$tem a mesma distribuição que $\mu + \sigma \cdot \mathcal{N}(0, 1)$. A principal informação: mover a aleatoriedade para uma fonte sem parâmetros ($\epsilon$), expressa a amostra como uma transformação diferenciável dos parâmetros.

**In the VAE training loop:**
1. Saídas de codificação $\mu$E ...$\log(\sigma^2)$para cada entrada
2. Amostra $\epsilon \sim \mathcal{N}(0, 1)$
3. Computação$z = \mu + \sigma \epsilon$
4. Decodificar$z$para reconstruir a entrada
5. Propagação para trás através das etapas 4, 3, 2, 1 (possivel porque a etapa 3 é diferenciável)

Sem o truque de reparametrização, as VAEs não podem ser treinadas com a propagação de volta padrão.

### Gumbel-Softmax (Análise categórica diferenciável)

O truque de reparameterização funciona para distribuições contínuas (Gaussian). Para distribuições categóricas discretas, precisamos de uma abordagem diferente. Gumbel-Softmax fornece uma aproximação diferenciável à amostragem categórica.

**The Gumbel-Max trick (non-differentiable):**

```
To sample from a categorical distribution with log-probabilities log(p_1), ..., log(p_k):
  1. Sample g_i ~ Gumbel(0, 1) for each category
     (g = -log(-log(u)), where u ~ Uniform(0, 1))
  2. Return argmax(log(p_i) + g_i)

This produces exact categorical samples.
```

**Gumbel-Softmax (differentiable approximation):**

```
Replace the hard argmax with a soft softmax:
  y_i = exp((log(p_i) + g_i) / tau) / sum(exp((log(p_j) + g_j) / tau))

tau (temperature) controls the approximation:
  tau -> 0:  approaches a one-hot vector (hard categorical)
  tau -> inf: approaches uniform (1/k, 1/k, ..., 1/k)
  tau = 1.0: soft approximation
```

Gumbel-Softmax produz um relaxamento contínuo de uma amostra discreta. A saída é um vetor de probabilidade (modo um-quente) em vez de um-quente duro. Os gradientes fluem através do softmax. Durante o passagem para frente no treinamento, você pode usar o estimador "direto-a-caminho": use o argmax duro para o passagem para frente, mas os gradientes macios de Gumbel-Softmax para o passagem para trás.

**Applications:**
- Variaveis latentes discretos em VAEs
- Pesquisa de arquitetura neural (escolha de operações discretas)
- Mecanismos de atenção dura
- Aprendizagem reforçada com ações discretas

### Amostragem estratificada

A amostragem padrão de Monte Carlo pode deixar vagas no espaço de amostragem por acaso.

```
Standard Monte Carlo:
  Sample N points uniformly from [0, 1]
  Some regions may have clusters, others gaps

Stratified sampling:
  Divide [0, 1] into N equal strata: [0, 1/N), [1/N, 2/N), ..., [(N-1)/N, 1)
  Sample one point uniformly within each stratum
  x_i = (i + u_i) / N   where u_i ~ Uniform(0, 1),  i = 0, ..., N-1
```

A amostragem estratificada tem sempre uma variância menor ou igual em comparação com a Monte Carlo padrão:

```
Var(stratified) <= Var(standard Monte Carlo)

The improvement is largest when f(x) varies smoothly.
For piecewise-constant functions, stratified sampling is exact.
```

**Applications:**
- Integração numérica (quasi-Monte Carlo)
- Divisões de dados de formação (a garantia do equilíbrio de classes em cada dobra)
- Amostragem de importância com estratificação (combinação de ambas as técnicas)
- NeRF (Neural Radiance Fields) usa amostragem estratificada ao longo dos raios da câmera

### Conexão a modelos de difusão

Os modelos de difusão geram imagens através de um processo de amostragem.$T$O processo inverso aprende a denotar, recuperando a imagem original passo a passo.

```
Forward process (known):
  x_t = sqrt(alpha_t) * x_{t-1} + sqrt(1 - alpha_t) * epsilon
  where epsilon ~ N(0, I)

  After T steps: x_T ~ N(0, I)  (pure noise)

Reverse process (learned):
  x_{t-1} = (1/sqrt(alpha_t)) * (x_t - (1 - alpha_t)/sqrt(1 - alpha_bar_t) * epsilon_theta(x_t, t)) + sigma_t * z
  where z ~ N(0, I)

  Each denoising step is a sampling step.
```

A ligação com os métodos desta lição:
- Cada etapa de denotação utiliza o truque de reparametrização (ruído de amostra, aplicar transformação determinista)
- O horário de ruído .$\lbrace \alpha_t \rbrace$Controla uma forma de anelação de temperatura
- O treinamento utiliza a estimativa de Monte Carlo para aproximar o ELBO (evidência limite inferior)
- A amostragem ancestral em modelos de difusão é uma cadeia de Markov (cada etapa depende apenas do estado atual)

Todo o processo de geração de imagens é amostragem iterativa: comece com o ruído e, em cada passo, amostre uma versão ligeiramente menos ruidosa condicionada ao modelo de denotação aprendido.

```figure
monte-carlo-pi
```

## Construí-lo

### Passo 1: Amostragem uniforme e inversa de CDF

```python
import math
import random

def sample_uniform(a, b):
    return a + (b - a) * random.random()

def sample_exponential_inverse_cdf(lam):
    u = random.random()
    return -math.log(u) / lam
```

Gerenciar 10.000 amostras exponenciais e verificar a média é $1/\lambda$- Não .

### Passo 2: Amostragem de rejeição

```python
def rejection_sample(target_pdf, proposal_sample, proposal_pdf, M):
    while True:
        x = proposal_sample()
        u = random.random()
        if u < target_pdf(x) / (M * proposal_pdf(x)):
            return x
```

Utilize a amostragem de rejeição para extrair de uma distribuição normal truncada. Verifique a forma através da histogramagem das amostras.

### Passo 3: Amostragem de importância

```python
def importance_sampling_estimate(f, target_pdf, proposal_pdf, proposal_sample, n):
    total = 0
    for _ in range(n):
        x = proposal_sample()
        w = target_pdf(x) / proposal_pdf(x)
        total += f(x) * w
    return total / n
```

Estimação$\mathbb{E}[X^2]$A resposta é a seguinte:$\mu^2 + \sigma^2$)).

### Passo 4: Estimação de Monte Carlo de pi

```python
def monte_carlo_pi(n):
    inside = 0
    for _ in range(n):
        x = random.uniform(-1, 1)
        y = random.uniform(-1, 1)
        if x*x + y*y <= 1:
            inside += 1
    return 4 * inside / n
```

### Passo 5: MCMC Metropolis-Hastings

```python
def metropolis_hastings(target_log_pdf, proposal_sample, proposal_log_pdf, x0, n_samples, burn_in):
    samples = []
    x = x0
    for i in range(n_samples + burn_in):
        x_new = proposal_sample(x)
        log_alpha = (target_log_pdf(x_new) + proposal_log_pdf(x, x_new)
                     - target_log_pdf(x) - proposal_log_pdf(x_new, x))
        if math.log(random.random()) < log_alpha:
            x = x_new
        if i >= burn_in:
            samples.append(x)
    return samples
```

Amostra de uma distribuição bimodal (mistura de dois Gaussianos). Visualize a trajetória da cadeia.

### Passo 6: Amostragem de Gibbs

```python
def gibbs_sampling_2d(conditional_x_given_y, conditional_y_given_x, x0, y0, n_samples, burn_in):
    x, y = x0, y0
    samples = []
    for i in range(n_samples + burn_in):
        x = conditional_x_given_y(y)
        y = conditional_y_given_x(x)
        if i >= burn_in:
            samples.append((x, y))
    return samples
```

### Passo 7: Amostragem de temperatura

```python
def softmax(logits):
    max_l = max(logits)
    exps = [math.exp(z - max_l) for z in logits]
    total = sum(exps)
    return [e / total for e in exps]

def temperature_sample(logits, temperature):
    scaled = [z / temperature for z in logits]
    probs = softmax(scaled)
    return sample_from_probs(probs)
```

Mostre como a temperatura altera a distribuição de saída para um conjunto de logits de token.

### Passo 8: Amostragem de ponta e ponta

```python
def top_k_sample(logits, k):
    indexed = sorted(enumerate(logits), key=lambda x: -x[1])
    top = indexed[:k]
    top_logits = [l for _, l in top]
    probs = softmax(top_logits)
    idx = sample_from_probs(probs)
    return top[idx][0]

def top_p_sample(logits, p):
    probs = softmax(logits)
    indexed = sorted(enumerate(probs), key=lambda x: -x[1])
    cumsum = 0
    selected = []
    for token_idx, prob in indexed:
        cumsum += prob
        selected.append((token_idx, prob))
        if cumsum >= p:
            break
    sel_probs = [pr for _, pr in selected]
    total = sum(sel_probs)
    sel_probs = [pr / total for pr in sel_probs]
    idx = sample_from_probs(sel_probs)
    return selected[idx][0]
```

### Passo 9: Truque de reparametrização

```python
def reparam_sample(mu, sigma):
    epsilon = random.gauss(0, 1)
    return mu + sigma * epsilon

def reparam_gradient(mu, sigma, epsilon):
    dz_dmu = 1.0
    dz_dsigma = epsilon
    return dz_dmu, dz_dsigma
```

Demonstrar que os gradientes fluem através da amostra reparametrizada, mas não através da amostragem direta.

### Passo 10: Gumbel-Softmax

```python
def gumbel_sample():
    u = random.random()
    return -math.log(-math.log(u))

def gumbel_softmax(logits, temperature):
    gumbels = [math.log(p) + gumbel_sample() for p in logits]
    return softmax([g / temperature for g in gumbels])
```

Mostre como a diminuição da temperatura faz com que a saída se aproxime de um vetor de um só-quente.

Implementações completas com todas as visualizações estão em `code/sampling.py`- Não .

O port TypeScript está em `code/sampling.ts`Ele usa seu próprio gerador aleatório sementeado, por isso os números aleatórios diferem da saída Python.

## Usá-lo

Com NumPy e SciPy, as versões de produção:

```python
import numpy as np

rng = np.random.default_rng(42)

exponential_samples = rng.exponential(scale=2.0, size=10000)
print(f"Exponential mean: {exponential_samples.mean():.4f} (expected 2.0)")

from scipy import stats
normal = stats.norm(loc=0, scale=1)
print(f"CDF at 1.96: {normal.cdf(1.96):.4f}")
print(f"Inverse CDF at 0.975: {normal.ppf(0.975):.4f}")

logits = np.array([2.0, 1.0, 0.5, 0.1, -1.0])
temperature = 0.7
scaled = logits / temperature
probs = np.exp(scaled - scaled.max()) / np.exp(scaled - scaled.max()).sum()
token = rng.choice(len(logits), p=probs)
print(f"Sampled token index: {token}")
```

Para a MCMC em escala, utilize bibliotecas dedicadas:
- PyMC: modelagem Bayesiana completa com NUTS (HMC adaptativo)
- Emcee: amostragem MCMC de conjunto
- NumPyro/JAX: MCMC acelerado por GPU

Construíste isto do zero, agora sabes o que fazem as chamadas da biblioteca.

## Exercícios

1. Implementar a amostragem inversa do CDF para a distribuição de Cauchy.$F(x) = 0.5 + \arctan(x)/\pi$. Gerenar 10.000 amostras e traçar o histograma contra o PDF verdadeiro. Observe as caudas pesadas (valores extremos longe do centro).

2. Use a amostragem de rejeição para gerar amostras de uma distribuição Beta(2, 5) usando uma proposta Uniform(0, 1).

3. Estima a integral de $\sin(x)$de 0 a $\pi$Comparar o erro em cada nível. Verifique se o erro é escalado como$O(1/\sqrt{N})$- Não .

4. Implementar Metropolis-Hastings para amostragem de uma distribuição 2D $p(x, y)$Proporcional a $\exp(-(x^2 y^2 + x^2 + y^2 - 8x - 8y) / 2)$- Desenhar as amostras e a trajetória da cadeia.

5. Construir uma demonstração completa de geração de texto: dado um vocabulário de 10 palavras com logits, gerar sequências de 20 tokens usando (a) ganancioso, (b) temperatura = 0,7, (c) top-k = 3, (d) top-p = 0,9. Compare a diversidade de saídas em 5 corridas.

### Indicios

**Exercise 1.**Resolver$u = F(x)$Para$x$, o que dá $x = \tan(\pi(u - 0.5))$Verifique se a mediana da amostra está próxima a 0 e se cerca de 6% das amostras têm$\lvert x \rvert > 10$, que é $1 - (2/\pi)\arctan(10)$- Não .

**Exercise 2.**A densidade Beta ((2, 5) é $30x(1-x)^4$. Encontre o seu maior valor no modo $x = 1/5$e usar esse valor como $M$em `rejection_sample`A taxa de aceitação teórica é de$1/M$, então compare-o com a fração de propostas que aceita.

**Exercise 3.**O valor exacto é 2.`monte_carlo_integral(math.sin, 0, math.pi, n)`para cada um $n$e repita cada corrida com várias sementes.$n$A taxa de erro média deve diminuir em cerca de $\sqrt{10} \approx 3.2$- Não .

**Exercise 4.**Escreva o registro do alvo, que é $-(x^2 y^2 + x^2 + y^2 - 8x - 8y)/2$, e passar para `metropolis_hastings_2d`- registar a taxa de aceitação de cada proposta de desvio padrão: um valor muito pequeno aceita quase todos os passos, mas se move lentamente, e um valor muito grande rejeita quase todos os passos.

**Exercise 5.**A codificação gananciosa leva o índice da maior logit em cada passo.`temperature_sample`- Não .`top_k_sample`, e `top_p_sample`A ganância deve dar a mesma sequência em todas as 5 corridas, então conte as sequências distintas para cada método para medir a diversidade.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Sampling | "Drawing random values" | Generating values according to a probability distribution. The mechanism behind all generative AI |
| Uniform distribution | "All equally likely" | Every value in $[a, b]$ has equal probability density $1/(b-a)$. The starting point for all sampling methods |
| Inverse CDF | "Probability transform" | $F^{-1}(U)$ converts a uniform sample into a sample from any distribution with known CDF. Exact and efficient |
| Rejection sampling | "Propose and accept/reject" | Generate from a simple proposal, accept with probability proportional to target/proposal ratio. Exact but wastes samples |
| Importance sampling | "Reweight samples" | Estimate expectations under $p(x)$ using samples from $q(x)$ by weighting each sample by $p(x)/q(x)$. Core to PPO in RL |
| Monte Carlo | "Average random samples" | Approximate integrals as sample averages. Error $O(1/\sqrt{N})$ regardless of dimension |
| MCMC | "Random walk that converges" | Construct a Markov chain whose stationary distribution is the target. Metropolis-Hastings is the foundational algorithm |
| Metropolis-Hastings | "Accept uphill, sometimes downhill" | Propose moves, accept based on density ratio. Detailed balance ensures convergence to target distribution |
| Gibbs sampling | "One variable at a time" | Update each variable from its conditional distribution holding others fixed. 100% acceptance rate |
| Temperature | "Confidence knob" | Divides logits by $T$ before softmax. $T<1$ sharpens (more confident), $T>1$ flattens (more diverse) |
| Top-k sampling | "Keep the k best" | Zero out all but the $k$ highest-probability tokens, renormalize, sample. Fixed candidate set size |
| Nucleus sampling (top-p) | "Keep the probable ones" | Keep the smallest set of tokens whose cumulative probability exceeds $p$. Adaptive candidate set size |
| Reparameterization trick | "Move randomness outside" | Write $z = \mu + \sigma \epsilon$ where $\epsilon \sim \mathcal{N}(0,1)$. Makes sampling differentiable. Essential for VAE training |
| Gumbel-Softmax | "Soft categorical sampling" | Differentiable approximation to categorical sampling using Gumbel noise + softmax with temperature |
| Stratified sampling | "Forced coverage" | Divide sample space into strata, sample from each. Always lower variance than naive Monte Carlo |
| Burn-in | "Warm-up period" | Initial MCMC samples discarded before the chain reaches its stationary distribution |
| Detailed balance | "Reversibility condition" | $p(x) T(x \to y) = p(y) T(y \to x)$. Sufficient condition for $p$ to be the stationary distribution of a Markov chain |
| Diffusion sampling | "Iterative denoising" | Generate data by starting from noise and applying learned denoising steps. Each step is a conditional sampling operation |

## Mais leitura

- [Holbrook (2023): The Metropolis-Hastings Algorithm](https://arxiv.org/abs/2304.07010)- um tutorial detalhado sobre as bases do MCMC
- [Jang, Gu, Poole (2017): Categorical Reparameterization with Gumbel-Softmax](https://arxiv.org/abs/1611.01144)- papel original Gumbel-Softmax
- [Holtzman et al. (2020): The Curious Case of Neural Text Degeneration](https://arxiv.org/abs/1904.09751)- papel de amostragem de núcleo (top-p)
- [Kingma & Welling (2014): Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114)- Papel de AAE que introduz o truque de reparametrização
- [Ho, Jain, Abbeel (2020): Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239)- O DDPM conecta a amostragem à geração de imagem
