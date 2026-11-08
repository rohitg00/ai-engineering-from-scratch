# Estabilidade numérica

> O ponto flutuante é uma abstração que vai morder-te durante o treino e não vais ver que vai acontecer.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 01-04
**Time:** ~120 minutes

## Objetivos de aprendizagem

- Implementar softmax numéricamente estável e log-sum-exp usando o truque de subtração máxima
- Identificar o desabastecimento, o desabastecimento e a cancelamento catastrófico nos cálculos de pontos flutuantes
- Verificar gradientes analíticos contra gradientes numéricos usando diferenças finitas centradas
- Explique por que o bfloat16 é preferido ao float16 para treinamento e como a escalação de perdas impede o fluxo inferior de gradiente

## O problema

Os seus modelos de trens por três horas, então a perda se torna NaN. Você adiciona uma declaração impressora.`inf`Por passo 9.002 cada gradiente é`nan`E o treino está morto.

Ou: o seu modelo está pronto para ser concluído, mas a precisão é 2% pior do que o papel afirma. Você verifica tudo. Arquitetura coincide. Hiperparametros coincide. Dados coincidem. O problema é que o papel usou float32 e você usou float16 sem a escala correta. Trinta e dois bits de erro de arredondamento acumulado silenciosamente comido sua precisão.

Ou: você implementa a perda de entropia cruzada a partir do zero.`inf`O softmax desabou porque`exp(100)`Mas, como é que é possível, o sistema de controle de dados é maior do que o float32 pode representar.

A estabilidade numérica não é uma preocupação teórica. É a diferença entre uma corrida de treinamento que tem sucesso e uma que falha silenciosamente.

## O conceito

### IEEE 754: Como os computadores armazenam números reais

Os computadores armazenam números reais como valores de pontos flutuantes seguindo o padrão IEEE 754.

```
Float32 layout (32 bits total):
[1 sign] [8 exponent] [23 mantissa]

Value = (-1)^sign * 2^(exponent - 127) * 1.mantissa
```

A mantissa determina a precisão (quantos dígitos significativos). O exponente determina o intervalo (quão grande ou pequeno um número pode ser).

```
Format     Bits   Exponent  Mantissa  Decimal digits  Range (approx)
float64    64     11        52        ~15-16          +/- 1.8e308
float32    32     8         23        ~7-8            +/- 3.4e38
float16    16     5         10        ~3-4            +/- 65,504
bfloat16   16     8         7         ~2-3            +/- 3.4e38
```

float32 dá-lhe cerca de 7 dígitos decimais de precisão. Isso significa que ele pode distinguir entre 1.0000001 e 1.0000002, mas não entre 1.00000001 e 1.00000002. Depois de 7 dígitos, tudo está rodando ruído.

O float16 dá-lhe cerca de 3 dígitos. O maior número que pode representar é 65.504. Isso é perturbadoramente pequeno para ML onde logits, gradientes e ativações rotineiramente excedem isso.

bfloat16 é a resposta do Google ao problema de faixa do float16. Tem o mesmo exponente de 8 bits que o float32 (a mesma faixa, até 3,4e38) mas apenas 7 bits mantissa (menos precisão do que o float16).

### Por que 0,1 + 0,2 ! = 0,3

O número 0,1 não pode ser representado exatamente em ponto flutuante binário.

```
0.1 in binary = 0.0001100110011001100110011... (repeating forever)
```

Float32 reduz isso para 23 bits de mantissa. O valor armazenado é aproximadamente 0,100000001490116. Da mesma forma, 0,2 é armazenado como aproximadamente 0,200000002980232. Sua soma é 0,300000004470348, não 0,3.

```
In Python:
>>> 0.1 + 0.2
0.30000000000000004

>>> 0.1 + 0.2 == 0.3
False
```

Isto é importante para a ML porque:

1. Comparar perdas como `if loss < threshold`pode dar respostas erradas
2. Acumular muitos valores pequenos (actualizações gradiais em milhares de etapas) deriva da soma verdadeira
3. As análises de checksums e reproducibilidade falham se comparar os floats com `==`

A solução: nunca comparar os flutuantes com `==`- Usar .`abs(a - b) < epsilon`ou `math.isclose()`- Não .

### Cancellação catastrófica

Quando subtraímos dois números de pontos flutuantes quase iguais, os dígitos significativos se anula e ficamos com ruído redondeado promovido para dígitos principais.

```
a = 1.0000001    (stored as 1.00000011920929 in float32)
b = 1.0000000    (stored as 1.00000000000000 in float32)

True difference:  0.0000001
Computed:         0.00000011920929

Relative error: 19.2%
```

Isso é um erro relativo de 19% de uma subtração única.

- Computação de variação de dados com grande média: $\mathbb{E}[x^2] - \mathbb{E}[x]^2$Quando ?$\mathbb{E}[x]$é grande
- Subtrair probabilidades de registro quase iguais
- Calcule gradientes de diferença finita com epsilon muito pequeno

A solução: reorganizar as fórmulas para evitar subtrair números grandes, quase iguais. Para variância, use o algoritmo Welford ou centra os dados primeiro. Para log-probabilidades, trabalhe no log-espaço em todo.

### O fluxo excessivo e o fluxo inferior

O overflow ocorre quando um resultado é muito grande para representar. O underflow ocorre quando é muito pequeno (mais próximo de zero do que o menor número positivo representável).

```
Float32 boundaries:
  Maximum:  3.4028235e+38
  Minimum positive (normal): 1.175e-38
  Minimum positive (denorm): 1.401e-45
  Overflow:  anything > 3.4e38 becomes inf
  Underflow: anything < 1.4e-45 becomes 0.0
```

O `exp()`A função é a principal fonte de sobrecarga em ML:

```
exp(88.7)  = 3.40e+38   (barely fits in float32)
exp(89.0)  = inf         (overflow)
exp(-87.3) = 1.18e-38   (barely above underflow)
exp(-104)  = 0.0         (underflow to zero)
```

O `log()`Função atinge a outra direção:

```
log(0.0)   = -inf
log(-1.0)  = nan
log(1e-45) = -103.3      (fine)
log(1e-46) = -inf        (input underflowed to 0, then log(0) = -inf)
```

Em ML, `exp()`aparece em softmax, sigmoid e cálculos de probabilidade. `log()`A combinação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de observação de um sistema de um`log(exp(x))`É um campo minado sem os truques certos.

### O truque de log-sum-exp

Computação`log(sum(exp(x_i)))`- O que é que é?`x_i`é grande,`exp(x_i)`- Se todos os fluxos`x_i`são muito negativas, cada `exp(x_i)`subfluxos para zero e `log(0)`É o que é`-inf`- Não .

O truque: subtrair o valor máximo antes de exponenciar.

```math
\log\left(\sum_i \exp(x_i)\right) = \max(x) + \log\left(\sum_i \exp(x_i - \max(x))\right)
```

Por que isto funciona: depois de subtrair `max(x)`, o maior exponente é `exp(0) = 1`Não é possível sobrecarregar. Pelo menos um termo da soma é 1, portanto a soma é pelo menos 1, e`log(1) = 0`Não há fluxo de água para o`-inf`É possível.

Prova:

```math
\begin{aligned}
& \log\left(\sum_i \exp(x_i)\right) \\
&= \log\left(\sum_i \exp(x_i - c + c)\right) && \text{(add and subtract } c\text{)} \\
&= \log\left(\sum_i \exp(x_i - c) \cdot \exp(c)\right) && (\exp(a+b) = \exp(a) \cdot \exp(b)) \\
&= \log\left(\exp(c) \cdot \sum_i \exp(x_i - c)\right) && \text{(factor out } \exp(c)\text{)} \\
&= c + \log\left(\sum_i \exp(x_i - c)\right) && (\log(a \cdot b) = \log(a) + \log(b))
\end{aligned}
```

Set `c = max(x)`E o excesso de água é eliminado.

Este truque aparece em todo o ML:
- Normalização de Softmax
- Calculação de perdas de entropia cruzada
- Sumário da probabilidade de registro em modelos de sequência
- Mistura de Gaussianos
- Inferência variável

### Por que Softmax precisa do truque de subtração máxima

Softmax converte logits em probabilidades:

```math
\mathop{\mathrm{softmax}}(x_i) = \frac{\exp(x_i)}{\sum_j \exp(x_j)}
```

Sem o truque, logits de [100, 101, 102] causam desbordamento:

```
exp(100) = 2.69e43
exp(101) = 7.31e43
exp(102) = 1.99e44
sum      = 2.99e44

2.69e43 > 3.4e38, the float32 maximum, so every term overflows.
exp(88.7) is already at the float32 limit.
exp(100) = inf in float32.
```

Com o truque, subtrair max ((x) = 102:

```
exp(100 - 102) = exp(-2) = 0.135
exp(101 - 102) = exp(-1) = 0.368
exp(102 - 102) = exp(0)  = 1.000
sum = 1.503

softmax = [0.090, 0.245, 0.665]
```

As probabilidades são idênticas, o cálculo é seguro, não é uma otimização, é um requisito para a corretão.

### NaN e Inf: Detecção e Prevenção

`nan`(Não é um número) e `inf`(infinito) se propagam viralmente através de computação.`nan`em uma actualização de gradiente faz o peso `nan`, que produz todas as produções subsequentes `nan`O treino está morto num passo.

Como ?`inf`Aparece:
- `exp()`de grande número positivo
- Divisão por zero: `1.0 / 0.0`
- `float32`sobreflow em acumulações

Como ?`nan`Aparece:
- `0.0 / 0.0`
- `inf - inf`
- `inf * 0`
- `sqrt()`de um número negativo
- `log()`de um número negativo
- Qualquer aritmética que envolva um existente`nan`

Detecção:

```python
import math

math.isnan(x)       # True if x is nan
math.isinf(x)       # True if x is +inf or -inf
math.isfinite(x)    # True if x is neither nan nor inf
```

Estratégias de prevenção:

1. Entrada de sujeira para `exp()`- Não .`exp(clamp(x, -80, 80))`
2. Adicionar epsilon aos denominadores: `x / (y + 1e-8)`
3. Adicionar epsilon dentro `log()`- Não .`log(x + 1e-8)`
4. Utilize implementações estáveis (log-sum-exp, softmax estável)
5. Clipagem gradual para evitar explosões de peso
6. Verifique se`nan`- Não .`inf`após cada passagem avançada durante o depósito

### Verificação de Gradientes Numéricos

Os gradientes analíticos (de backpropagation) podem ter bugs.

A fórmula da diferença centralizada:

```math
\frac{df}{dx} \approx \frac{f(x + h) - f(x - h)}{2h}
```

Isto é ...$O(h^2)$É muito melhor do que a diferença de avanço.$(f(x+h) - f(x)) / h$O que é apenas $O(h)$- Não .

Escolher$h$A alteração do Conselho de Ministros da Agricultura, do Meio Ambiente e do Meio Ambiente, da Agricultura e do Meio Ambiente, da Agricultura, da Alimentação e do Meio Ambiente, da Agricultura e do Meio Ambiente, da Agricultura, da Alimentação e do Meio Ambiente, da Agricultura e do Meio Ambiente, da Agricultura e da Alimentação, da Alimentação e do Meio Ambiente, da Agricultura e da Alimentação, da Alimentação e do Meio Ambiente, da Agricultura e da Alimentação, da Alimentação e da Alimentação, da Agricultura e da Alimentação, da Agricultura e da Alimentação, da Agricultura e da Alimentação, da Agricultura e da Alimentação, da Agricultura e da Alimentação, da Agricultura e da Alimentação, da Agricultura e da Alimentação, da Agricultura e da Alimentação, da Agricultura e da Saúde, da Agricultura e da Agricultura e da Agricultura, da Agricultura e da Saúde, da Agricultura e da Agricultura, da Agricultura e da Saúde, da Agricultura e da Agricultura, da Agricultura e da Agricultura, da Agricultura, da Agricultura e da Agricultura, da Agricultura e da Agricultura, da Agricultura, da Agricultura, da Agricultura e da Agricultura, da Agricultura, da Agricultura e da Agricultura, da Agricultura, da Agricultura, da Agricultura, da Agricultura e da Agricultura, da Agricultura, da Agricultura, da Agricultura.`h = 1e-5`- Não .`1e-7`É típico.

O controlo: calcular a diferença relativa entre os gradientes analíticos e numéricos.

```math
\text{relative\_error} = \frac{\lvert \text{grad}_{\text{analytical}} - \text{grad}_{\text{numerical}} \rvert}{\max(\lvert \text{grad}_{\text{analytical}} \rvert, \lvert \text{grad}_{\text{numerical}} \rvert, 10^{-8})}
```

Regras de execução:
- Relativo_error < 1e-7: perfeito, gradiente é correto
- Relativo_error < 1e-5: aceitável, provavelmente correto
- Relativo_error > 1e-3: algo está errado
- relative_error > 1: gradiente é completamente errado

Sempre verifique os gradientes ao implementar uma nova função de camada ou perda.`torch.autograd.gradcheck()`- Por isto.

### Treinamento Misto de Precisão

As GPUs modernas têm hardware especializado (Cores Tensor) que computa multiplicidades de matriz float16 2-8 vezes mais rápido do que float32.

```
1. Maintain float32 master copy of weights
2. Forward pass in float16 (fast)
3. Compute loss in float32 (prevents overflow)
4. Backward pass in float16 (fast)
5. Scale gradients to float32
6. Update float32 master weights
```

O problema com o treinamento puro do float16: os gradientes são muitas vezes muito pequenos (1e-8 ou menor).

A solução é a escalação de perdas:

```
1. Multiply loss by a large scale factor (e.g., 1024)
2. Backward pass computes gradients of (loss * 1024)
3. All gradients are 1024x larger (pushed above float16 underflow)
4. Divide gradients by 1024 before updating weights
5. Net effect: same update, but no underflow
```

A escalação dinâmica de perda ajusta automaticamente o fator de escala. Comece com um valor grande (65536).`inf`- Se o fizer, reduz-o à metade.$N$Passa os passos sem sobrecarga, dobra-o.

### Bfloat16 vs. Float16: Por que Bfloat16 Ganha para Treinamento

```
float16:   [1 sign] [5 exponent]  [10 mantissa]
bfloat16:  [1 sign] [8 exponent]  [7 mantissa]
```

bfloat16 tem mais precisão (10 bits mantissa vs 7) mas alcance limitado (max ~65,504). bfloat16 tem menos precisão mas alcance igual ao float32 (max ~3,4e38).

Para a formação de redes neurais:

- As atividades e logitas superam regularmente os 65.504 durante os picos de treinamento.
- A escalação de perda é necessária com o float16, mas geralmente desnecessária com o bfloat16, porque a sua faixa abrange o espectro de magnitude de gradiente.
- bfloat16 é uma simples truncation de float32: soltar os 16 bits mais baixos da mantissa.

O float16 é preferido para inferência onde os valores são limitados e a precisão é mais importante. bfloat16 é preferido para treinamento onde a faixa é mais importante.

### Classificação de gradientes

Os gradientes explosivos acontecem quando os gradientes crescem exponencialmente através de muitas camadas (comuns em RNNs, redes profundas e transformadores).

Dois tipos de corte:

**Clip by value:**Clamper cada elemento de gradiente de forma independente.

```
grad = clamp(grad, -max_val, max_val)
```

Simples, mas pode mudar a direcção do vector de gradiente.

**Clip by norm:**Escala o vector de gradiente inteiro para que a sua norma não exceda um limiar.

```
if ||grad|| > max_norm:
    grad = grad * (max_norm / ||grad||)
```

Preserva a direcção do gradiente.`torch.nn.utils.clip_grad_norm_()`É a escolha padrão.

Valores típicos: `max_norm=1.0`para transformadores, `max_norm=0.5`para RL, `max_norm=5.0`para redes mais simples.

O corte de gradiente não é um hack, é um mecanismo de segurança, sem ele, um único lote de outlier pode produzir um gradiente grande o suficiente para arruinar semanas de treinamento.

### As camadas de normalização como estabilizadores numéricos

Normalisação de lote, normalização de camadas e normalização de RMS são geralmente apresentados como reguladores que ajudam a formação a convergir.

Sem normalização, as ativações podem crescer ou encolher exponencialmente através de camadas:

```
Layer 1: values in [0, 1]
Layer 5: values in [0, 100]
Layer 10: values in [0, 10,000]
Layer 50: values in [0, inf]
```

Normalização de recentes e re-escala a ativação em cada camada:

```math
\mathop{\mathrm{LayerNorm}}(x) = \frac{x - \mathop{\mathrm{mean}}(x)}{\mathop{\mathrm{std}}(x) + \epsilon} \cdot \gamma + \beta
```

O `epsilon`(tipicamente 1e-5) impede a divisão por zero quando todas as ativações são idênticas.`gamma`E ...`beta`Deixe a rede restaurar qualquer escala que precise.

Isto mantém os valores num intervalo numéricamente seguro em toda a rede, impedindo tanto o desbordamento no passe para a frente quanto a explosão de gradiente no passe para trás.

### Bugs numéricos comuns

**Bug: Loss is NaN after a few epochs.**
Causa: logits cresceram demais, softmax superfluou ou a taxa de aprendizagem é muito alta e os pesos divergem.
Correcção: utilizar softmax estável (subtração máxima), reduzir a taxa de aprendizagem, adicionar cortes de gradiente.

**Bug: Loss is stuck at log(num_classes).**
Causa: as saídas do modelo são probabilidades quase uniformes.
Corrigir: verificar se os rótulos de dados são corretos, verificar a função de perda, verificar se existem RELUs mortos.

**Bug: Validation accuracy is lower than expected by 1-3%.**
Causa: precisão mista sem escalagem adequada de perdas.
Correcção: habilitar a escalação dinâmica de perdas ou mudar para bfloat16.

**Bug: Gradient norms are 0.0 for some layers.**
Causa: neurônios ReLU mortos (todas as entradas negativas), ou float16 subfluxo.
Corrigir: usar LeakyReLU ou GELU, usar escala de gradiente, verificar a inicialização do peso.

**Bug: Model works on one GPU but gives different results on another.**
Causa: ordem não determinista de acumulação de pontos flutuantes. As reduções paralelas da GPU somam em diferentes ordens em diferentes hardware, e a adição de pontos flutuantes não é associativa.
Fix: aceitar pequenas diferenças (1e-6), ou definir `torch.use_deterministic_algorithms(True)`E aceitar a penalidade de velocidade.

**Bug: `exp()` returns `inf` in loss computation.**
Causa: logits crus passados para `exp()`sem o truque de subtração máxima.
Correcção: uso `torch.nn.functional.log_softmax()`que implementa log-sum-exp internamente.

**Bug: Training diverges after switching from float32 to float16.**
Causa: float16 não pode representar magnitudes de gradiente abaixo de 6e-8 ou ativas acima de 65,504.
Correcção: utilizar precisão mista com escala de perda (AMP), ou usar bfloat16 em vez disso.

```figure
logsumexp-stability
```

## Construí-lo

### Passo 1: Demonstrar limites de precisão de ponto flutuante

```python
print("=== Floating Point Precision ===")
print(f"0.1 + 0.2 = {0.1 + 0.2}")
print(f"0.1 + 0.2 == 0.3? {0.1 + 0.2 == 0.3}")
print(f"Difference: {(0.1 + 0.2) - 0.3:.2e}")
```

### Passo 2: Implementar naívo versus softmax estável

```python
import math

def softmax_naive(logits):
    exps = [math.exp(z) for z in logits]
    total = sum(exps)
    return [e / total for e in exps]

def softmax_stable(logits):
    max_logit = max(logits)
    exps = [math.exp(z - max_logit) for z in logits]
    total = sum(exps)
    return [e / total for e in exps]

safe_logits = [2.0, 1.0, 0.1]
print(f"Naive:  {softmax_naive(safe_logits)}")
print(f"Stable: {softmax_stable(safe_logits)}")

dangerous_logits = [100.0, 101.0, 102.0]
print(f"Stable: {softmax_stable(dangerous_logits)}")
# softmax_naive(dangerous_logits) would return [nan, nan, nan]
```

### Passo 3: Implementar log-sum-exp estável

```python
def logsumexp_naive(values):
    return math.log(sum(math.exp(v) for v in values))

def logsumexp_stable(values):
    c = max(values)
    return c + math.log(sum(math.exp(v - c) for v in values))

safe = [1.0, 2.0, 3.0]
print(f"Naive:  {logsumexp_naive(safe):.6f}")
print(f"Stable: {logsumexp_stable(safe):.6f}")

large = [500.0, 501.0, 502.0]
print(f"Stable: {logsumexp_stable(large):.6f}")
# logsumexp_naive(large) returns inf
```

### Passo 4: Implementação de entropia cruzada estável

```python
def cross_entropy_naive(true_class, logits):
    probs = softmax_naive(logits)
    return -math.log(probs[true_class])

def cross_entropy_stable(true_class, logits):
    max_logit = max(logits)
    shifted = [z - max_logit for z in logits]
    log_sum_exp = math.log(sum(math.exp(s) for s in shifted))
    log_prob = shifted[true_class] - log_sum_exp
    return -log_prob

logits = [2.0, 5.0, 1.0]
true_class = 1
print(f"Naive:  {cross_entropy_naive(true_class, logits):.6f}")
print(f"Stable: {cross_entropy_stable(true_class, logits):.6f}")
```

### Passo 5: Verificação gradual

```python
def numerical_gradient(f, x, h=1e-5):
    grad = []
    for i in range(len(x)):
        x_plus = x[:]
        x_minus = x[:]
        x_plus[i] += h
        x_minus[i] -= h
        grad.append((f(x_plus) - f(x_minus)) / (2 * h))
    return grad

def check_gradient(analytical, numerical, tolerance=1e-5):
    for i, (a, n) in enumerate(zip(analytical, numerical)):
        denom = max(abs(a), abs(n), 1e-8)
        rel_error = abs(a - n) / denom
        status = "OK" if rel_error < tolerance else "FAIL"
        print(f"  param {i}: analytical={a:.8f} numerical={n:.8f} "
              f"rel_error={rel_error:.2e} [{status}]")

def f(params):
    x, y = params
    return x**2 + 3*x*y + y**3

def f_grad(params):
    x, y = params
    return [2*x + 3*y, 3*x + 3*y**2]

point = [2.0, 1.0]
analytical = f_grad(point)
numerical = numerical_gradient(f, point)
check_gradient(analytical, numerical)
```

## Usá-lo

### Simulação de precisão mista

```python
import struct

def float32_to_float16_round(x):
    packed = struct.pack('f', x)
    f32 = struct.unpack('f', packed)[0]
    packed16 = struct.pack('e', f32)
    return struct.unpack('e', packed16)[0]

def simulate_bfloat16(x):
    packed = struct.pack('f', x)
    as_int = int.from_bytes(packed, 'little')
    truncated = as_int & 0xFFFF0000
    repacked = truncated.to_bytes(4, 'little')
    return struct.unpack('f', repacked)[0]
```

### Clipagem gradual

```python
def clip_by_norm(gradients, max_norm):
    total_norm = math.sqrt(sum(g**2 for g in gradients))
    if total_norm > max_norm:
        scale = max_norm / total_norm
        return [g * scale for g in gradients]
    return gradients

grads = [10.0, 20.0, 30.0]
clipped = clip_by_norm(grads, max_norm=5.0)
print(f"Original norm: {math.sqrt(sum(g**2 for g in grads)):.2f}")
print(f"Clipped norm:  {math.sqrt(sum(g**2 for g in clipped)):.2f}")
print(f"Direction preserved: {[c/clipped[0] for c in clipped]} == {[g/grads[0] for g in grads]}")
```

### Detecção de NaN/Inf

```python
def check_tensor(name, values):
    has_nan = any(math.isnan(v) for v in values)
    has_inf = any(math.isinf(v) for v in values)
    if has_nan or has_inf:
        print(f"WARNING {name}: nan={has_nan} inf={has_inf}")
        return False
    return True

check_tensor("good", [1.0, 2.0, 3.0])
check_tensor("bad",  [1.0, float('nan'), 3.0])
check_tensor("ugly", [1.0, float('inf'), 3.0])
```

Veja .`code/numerical.py`Para implementações completas, com todos os casos de ponta demonstrados.`code/numerical.ts`é uma porta TypeScript com as mesmas funções e demos.

## Envia-o

Esta lição produz:
- `code/numerical.py`com softmax estável, log-sum-exp, entropia cruzada, verificação de gradientes e simulação de precisão mista
- `outputs/prompt-numerical-debugger.md`para o diagnóstico de NaN/Inf e questões numéricas na formação

Estas implementações estáveis reaparecem na fase 3 na construção do ciclo de formação e na fase 4 na implementação de mecanismos de atenção.

## Exercícios

1. **Catastrophic cancellation.**Calcule a variância de [1000000.0, 1000001.0, 1000002.0] usando a fórmula ingênua $\mathbb{E}[x^2] - \mathbb{E}[x]^2$Em float32. Então, compute-o usando o algoritmo online de Welford. Compare os erros com a variância verdadeira (0.6667).

2. **Precision hunt.**Encontre o menor valor positivo float32 `x`Tal como isso .`1.0 + x == 1.0`Esta é a máquina epsilon. Verifique se coincide.`numpy.finfo(numpy.float32).eps`- Não .

3. **Log-sum-exp edge cases.**Teste o teu .`logsumexp_stable`Função com: a) todos os valores iguais, b) um valor muito maior que os outros, c) todos os valores muito negativos (-1000). Verifique que dá resultados corretos quando a versão ingênua falha.

4. **Gradient checking a neural network layer.**Implementar uma única camada linear `y = Wx + b`e o seu passo analítico para trás.`numerical_gradient`para verificar a correcção de uma matriz de peso 3x2.

5. **Loss scaling experiment.**Simulação de treinamento com float16: criar gradientes aleatórios na faixa [1e-9, 1e-3], converter em float16, e medir qual fração se torna zero.

### Indicios

**Exercise 1.**Converter os três valores com `np.float32`Antes de os quadrar, depois liga.`variance_naive`E ...`welford_variance`Um valor próximo de$10^{12}$no float32 tem um espaçamento muito maior que 1, então espere que o resultado ingênuo seja longe de 0,6667 e o resultado Welford seja próximo.

**Exercise 2.**Começa com `x = np.float32(1.0)`E meia-lo enquanto `np.float32(1.0) + x != np.float32(1.0)`. Mantenha todos os valores em float32, e depois compare o último valor que ainda mudou a soma com `numpy.finfo(numpy.float32).eps`, que é $2^{-23}$- Não .

**Exercise 3.**Previnha primeiro cada resposta.$n$valores iguais $c$, o resultado é $c + \ln n$Para um valor grande, o resultado é próximo a esse valor.$-1000 + \ln n$, enquanto `logsumexp_naive`Retorno `-inf`Porque cada exponencial desce para 0.

**Exercise 4.**Para o$y = Wx + b$com uma perda.$L$, o gradiente para $W$é o produto externo do gradiente ascendente e $x$- Envolver a perda como função do aplanado$W$- Não , não .`numerical_gradient`, e passar ambos os resultados para `check_gradient`- Não .

**Exercise 5.**Amostra das magnitudes em uma escala de log com `10 ** np.random.uniform(-9, -3, n)`e converter com `np.float16`. Float16 não pode manter valores abaixo de aproximadamente $6 \times 10^{-8}$, então espere que cerca de um quarto dos valores se tornem zero antes de escalar e quase nenhum depois de você multiplicar por 1024.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| IEEE 754 | "The float standard" | International standard defining binary floating point formats, rounding rules, and special values (inf, nan). Every modern CPU and GPU implements it. |
| Machine epsilon | "The precision limit" | The smallest value $e$ such that $1.0 + e \ne 1.0$ in a given float format. For float32, it is about 1.19e-7. |
| Catastrophic cancellation | "Precision loss from subtraction" | When subtracting nearly equal floating point numbers, significant digits cancel and rounding noise dominates the result. |
| Overflow | "Number too big" | A result exceeds the maximum representable value and becomes inf. exp(89) overflows float32. |
| Underflow | "Number too small" | A result is closer to zero than the smallest representable positive number and becomes 0.0. exp(-104) underflows float32. |
| Log-sum-exp trick | "Subtract the max first" | Computing $\log(\sum \exp(x))$ by factoring out $\exp(\max(x))$ to prevent overflow and underflow. Used in softmax, cross-entropy, and log-probability math. |
| Stable softmax | "Softmax that does not explode" | Subtracting $\max(\text{logits})$ before exponentiating. Numerically identical result, no overflow possible. |
| Gradient checking | "Verify your backprop" | Comparing analytical gradients from backpropagation against numerical gradients from finite differences to catch implementation bugs. |
| Mixed precision | "Float16 forward, float32 backward" | Using lower-precision floats for speed-critical operations and higher-precision floats for numerically sensitive operations. Typical speedup is 2-3x. |
| Loss scaling | "Prevent gradient underflow" | Multiplying the loss by a large constant before backprop so gradients stay in float16's representable range, then dividing by the same constant before weight updates. |
| bfloat16 | "Brain floating point" | Google's 16-bit format with 8 exponent bits (same range as float32) and 7 mantissa bits (less precision than float16). Preferred for training. |
| Gradient clipping | "Cap the gradient norm" | Scaling the gradient vector so its norm does not exceed a threshold. Prevents exploding gradients from ruining weights. |
| NaN | "Not a Number" | Special float value from undefined operations (0/0, inf-inf, sqrt(-1)). Propagates through all subsequent arithmetic. |
| Inf | "Infinity" | Special float value from overflow or division by zero. Can combine to produce NaN (inf - inf, inf * 0). |
| Numerical gradient | "Brute force derivative" | Approximating a derivative by evaluating $f(x+h)$ and $f(x-h)$ and dividing by $2h$. Slow but reliable for verification. |

## Mais leitura

- [What Every Computer Scientist Should Know About Floating-Point Arithmetic (Goldberg 1991)](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html)-- a referência definitiva, densa mas completa
- [Mixed Precision Training (Micikevicius et al., 2018)](https://arxiv.org/abs/1710.03740)-- o artigo da NVIDIA que introduziu a escalação de perdas para o treinamento do float16
- [AMP: Automatic Mixed Precision (PyTorch docs)](https://pytorch.org/docs/stable/amp.html)-- guia prático de precisão mista em PyTorch
- [bfloat16 format (Google Cloud TPU docs)](https://cloud.google.com/tpu/docs/bfloat16)-- por que o Google escolheu este formato para TPUs
- [Kahan Summation (Wikipedia)](https://en.wikipedia.org/wiki/Kahan_summation_algorithm)-- algoritmo para reduzir o erro de arredondamento nas somas de pontos flutuantes
