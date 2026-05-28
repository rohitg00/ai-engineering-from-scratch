---
name: skill-gradient-computation
description: Computar gradientes de funcoes de loss comuns de ML e escolher a abordagem certa de derivada
version: 1.0.0
phase: 1
lesson: 4
tags: [calculus, gradients, backpropagation]
---

# Computacao de Gradientes pra ML

Referencia pratica pra computar gradientes de funcoes de loss, funcoes de ativacao e operacoes de camadas usadas em redes neurais.

## Checklist de Decisao

1. A funcao e composta de primitivos simples (potencia, exp, log, trig)? Use derivadas analiticas e a regra da cadeia.
2. A funcao e uma operacao customizada ou black-box? Use diferenciacao numerica: `(f(x+h) - f(x-h)) / (2h)` com h = 1e-7.
3. A funcao e construida com operacoes de tensores em PyTorch/JAX? Deixe o autograd cuidar. Verifique com checagem numerica.
4. Voce precisa do gradiente de uma loss escalar em relacao a uma matriz de pesos? Aplique a regra da cadeia pelo grafo de computacao, um no por vez.
5. Ha uma operacao nao diferenciavel (argmax, arredondamento, sampling)? Use um estimador straight-through ou o truque de reparameterizacao.

## Quando usar cada abordagem

| Abordagem | Quando usar | Custo |
|---|---|---|
| Analitica (derivada mao) | Funcoes simples, verificar saida do autograd | Gratis em runtime |
| Numerica (diferencas finitas) | Debug, checagem de gradiente, funcoes black-box | 2n forward passes pra n parametros |
| Diferenciacao automatica | Qualquer grafo de computacao diferenciavel (o padrao) | Um backward pass |
| Simbolica (SymPy, Mathematica) | Derivar gradientes de forma fechada pra papers | So tempo de compilacao |

## Referencia rapida: derivadas comuns

| Funcao | f(x) | f'(x) | Contexto ML |
|---|---|---|---|
| MSE loss | (1/n) sum(y_hat - y)^2 | (2/n)(y_hat - y) | Regressao |
| Cross-entropy (binaria) | -(y log(p) + (1-y) log(1-p)) | p - y (apos sigmoid) | Classificacao binaria |
| Cross-entropy (multi) | -log(p_true_class) | p - one_hot(y) (apos softmax) | Classificacao multi-classe |
| Sigmoid | 1 / (1 + e^(-x)) | sigma(x) * (1 - sigma(x)) | Gates de saida, saida binaria |
| Tanh | (e^x - e^(-x)) / (e^x + e^(-x)) | 1 - tanh(x)^2 | Ativacoes ocultas (legado) |
| ReLU | max(0, x) | 1 se x > 0, 0 se x < 0 | Ativacao oculta padrao |
| Leaky ReLU | max(0.01x, x) | 1 se x > 0, 0.01 se x < 0 | Evitando dead neurons |
| GELU | x * Phi(x) | Phi(x) + x * phi(x) | Transformers |
| Softmax_i | e^(x_i) / sum(e^(x_j)) | s_i(1 - s_i) pra i=j, -s_i*s_j pra i!=j | Camada de saida (Jacobian) |
| Log-softmax | x_i - log(sum(e^(x_j))) | 1 - softmax(x_i) pra i-esima entrada | CE numericamente estavel |
| Camada linear | y = Wx + b | dL/dW = dL/dy * x^T, dL/db = dL/dy | Cada camada |
| Regularizacao L2 | lambda * sum(w^2) | 2 * lambda * w | Weight decay |
| Regularizacao L1 | lambda * sum(\|w\|) | lambda * sign(w) | Esparsidade |

## Erros comuns

- Esquecer o fator 1/n em losses mediadas por batch (MSE, cross-entropy). O gradiente e escalado pelo tamanho do batch.
- Computar o gradiente do softmax como vetor quando na verdade e uma matriz Jacobian. Pra cross-entropy + softmax combinados, o gradiente simplifica pra (p - y), evitando o Jacobian completo.
- Aplicar a regra da cadeia na ordem errada. Trabalhe de tras pra frente a partir da loss: dL/dW = dL/dy * dy/dW.
- Usar h que e muito grande (h = 0.1) ou muito pequeno (h = 1e-15) pra derivadas numericas. Mantenha h = 1e-7 pra float64.
- Esquecer que o ReLU tem gradiente indefinido exatamente em x = 0. Na pratica, defina como 0 ou 0.5.

## Receita de checagem de gradiente

```
Pra cada parametro w:
  numeric_grad = (loss(w + h) - loss(w - h)) / (2h)
  auto_grad = valor do backward pass
  relative_error = |numeric - auto| / max(|numeric|, |auto|, 1e-8)
  assert relative_error < 1e-5
```

Erro relativo acima de 1e-3 significa que algo esta errado. Entre 1e-5 e 1e-3, investigue.
