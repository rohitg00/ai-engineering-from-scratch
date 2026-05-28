---
name: skill-convexity-checker
description: Determinar se um problema de otimizacao e convexo e escolher o resolvedor certo
version: 1.0.0
phase: 1
lesson: 18
tags: [optimization, convexity, solvers]
---

# Verificador de Convexidade

Como verificar se um problema de otimizacao e convexo, e o que fazer com a resposta.

## Checklist de Decisao

1. A funcao objetivo e convexa? (Verifique a positividade semi-definida da Hessiana ou use regras de composicao.)
2. Todas as restricoes de desigualdade sao da forma g_i(x) <= 0 onde cada g_i e convexa?
3. Todas as restricoes de igualdade sao afins (lineares)?
4. Se todas tres sao sim, o problema e convexo. Use um resolvedor convexo com garantias de convergencia.
5. Se alguma e nao, o problema e nao-convexo. Use SGD/Adam e aceite otimos locais.

## Como testar convexidade de uma funcao

| Teste | Aplica a | Metodo |
|---|---|---|
| Segunda derivada >= 0 | Funcoes escalares f(x) | Compute f''(x). Se f''(x) >= 0 pra todo x, convexa. |
| Hessiana e PSD | Funcoes multivariadas f(x) | Compute H(x). Se todos autovalores >= 0 em todo lugar, convexa. |
| Teste por definicao | Qualquer funcao | Verifique f(tx + (1-t)y) <= t*f(x) + (1-t)*f(y) pra x, y, t amostrados. |
| Regras de composicao | Funcoes compostas | Veja tabela de composicao abaixo. |
| Restricao a uma reta | Funcoes multivariadas f | f e convexa sse g(t) = f(x + tv) e convexa em t pra todo x, v. |

## Regras de composicao (preservando convexidade)

| Operacao | Resultado |
|---|---|
| f + g (ambas convexas) | Convexa |
| c * f (c > 0, f convexa) | Convexa |
| max(f, g) (ambas convexas) | Convexa |
| f(Ax + b) onde f e convexa | Convexa |
| g(f(x)) onde g e convexa nao-decrescente e f e convexa | Convexa |
| g(f(x)) onde g e convexa nao-crescente e f e concava | Convexa |
| Soma de funcoes convexas | Convexa |
| Supremo pontual de funcoes convexas | Convexa |

## Objetivos comuns de ML: convexos ou nao?

| Objetivo | Convexo? | Razao |
|---|---|---|
| MSE: (1/n) sum(y - Xw)^2 | Sim | Quadratica em w, Hessiana = (2/n) X^T X e PSD |
| Logistic loss: sum(log(1 + exp(-y_i * w^T x_i))) | Sim | Soma de funcoes convexas (familia log-sum-exp) |
| Hinge loss: sum(max(0, 1 - y_i * w^T x_i)) | Sim | Max de funcoes convexas (lineares) |
| Regularizacao L2: lambda * \|\|w\|\|^2 | Sim | Quadratica, Hessiana = 2*lambda*I |
| Regularizacao L1: lambda * \|\|w\|\|_1 | Sim | Soma de valores absolutos (convexa mas nao diferenciavel) |
| Ridge regression: MSE + L2 | Sim | Soma de duas funcoes convexas |
| LASSO: MSE + L1 | Sim | Soma de duas funcoes convexas |
| Elastic net: MSE + L1 + L2 | Sim | Soma de funcoes convexas |
| SVM (primal): hinge + L2 | Sim | Soma de funcoes convexas |
| Cross-entropy com softmax | Sim (em logits) | Log-sum-exp e convexa |
| Rede neural (qualquer loss) | Nao | Ativacoes nao-lineares criam composicao nao-convexa |
| Objetivo k-means | Nao | Passo de atribuicao discreta |
| Fatorizacao de matriz: \|\|X - UV^T\|\|^2 | Nao | Bilineal em U e V |
| Loss de GAN | Nao | Minimax, nao-convexa no gerador |
| Loss contrastiva (InfoNCE) | Nao | Log de razao de exponenciais com amostras negativas |

## Selecao de resolvedor baseada em convexidade

| Tipo de problema | Resolvedor | Garantia de convergencia |
|---|---|---|
| Convexo, suave, sem restricoes | Descida do gradiente | O(1/k) ate minimo global |
| Convexo, suave, sem restricoes | L-BFGS | Superlinear ate minimo global |
| Convexo, suave, sem restricoes | Metodo de Newton | Quadratica proximo ao minimo (se Hessiana tractavel) |
| Convexo, suave, com restricoes | Metodo de ponto interior | Tempo polinomial |
| Convexo, nao-suave (L1) | Gradiente proximal / ISTA | O(1/k) ate minimo global |
| Convexo, nao-suave (L1) | ADMM | Flexivel, lida com restricoes |
| Convexo, quadratico | Gradiente conjugado | Exato em n passos |
| Nao-convexo, suave | SGD / Adam | Converge a minimo local |
| Nao-convexo, suave | SGD + reinicializacoes | Minimo local melhor em media |
| Nao-convexo, suave | Sobreparametrizacao + SGD | Minimos planos, boa generalizacao |

## Erros comuns

- Assumir que um problema e convexo porque a funcao de loss e convexa. A loss deve ser convexa nos parametros que voce esta otimizando. Cross-entropy e convexa nos logits, mas o mapeamento completo da rede neural de entradas pra logits e nao-convexo.
- Usar metodo de Newton num problema nao-convexo. A Hessiana pode ter autovalores negativos, fazendo Newton se mover em direcao a pontos de sela ou maximos em vez de minimos.
- Esquecer que regularizacao L1 torna a funcao objetivo nao-diferenciavel em zero. Descida do gradiente padrao nao funciona bem. Use descida do gradiente proximal ou metodos subgradiente.
- Elevar o numero de condicao ao quadrado formando A^T A. Se voce precisa resolver um problema de minimos quadrados e A e mal condicionada, use QR ou SVD em vez de equacoes normais.
- Declarar um problema nao-convexo sem verificar. Muitos problemas de ML (modelos lineares, SVMs, regressao logistica) sao convexos e se beneficiam de resolvedores mais fortes.

## Teste rapido: meu problema e convexo?

```
1. Escreva o objetivo: minimize f(w) sujeito a restricoes
2. Pra cada termo em f(w):
   - E quadratico com matriz PSD? -> Convexa
   - E uma norma? -> Convexa
   - E log-sum-exp? -> Convexa
   - Envolve w nao-linearmente (sigmoid(w), w1*w2)? -> Provavelmente nao-convexa
3. Todas restricoes sao lineares ou convexas de desigualdade?
4. Se TODOS termos sao convexos e restricoes sao convexas/lineares -> problema e convexo
5. Se ALGUM termo e nao-convexo -> problema e nao-convexo
```
