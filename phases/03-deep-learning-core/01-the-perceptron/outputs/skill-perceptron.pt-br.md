---
name: skill-perceptron
description: Entenda o padrão perceptron e quando usar arquiteturas de camada única versus arquiteturas multicamadas
version: 1.0.0
phase: 3
lesson: 1
tags: [perceptron, neural-networks, classification, deep-learning]
---

# O padrão Perceptron

Um perceptron calcula uma soma ponderada de entradas mais uma tendência e, em seguida, aplica uma função degrau para produzir uma saída binária. É a unidade fundamental das redes neurais.

```
output = step(w1*x1 + w2*x2 + ... + wn*xn + bias)
```

## Quando um único perceptron é suficiente

- O problema é linearmente separável: uma linha reta (ou hiperplano) pode dividir as duas classes
- Portas lógicas: AND, OR, NOT, NAND
- Decisões simples de limite: "a pontuação está acima de X?"
- Classificadores binários em dados agrupados em duas regiões não sobrepostas

## Quando você precisa de múltiplas camadas

- O problema não é linearmente separável: nenhuma linha pode separar as classes
- Problemas de XOR e paridade
- Qualquer tarefa que exija raciocínio "isso, mas não aquilo" (combinações de condições)
- Classificação do mundo real: imagens, texto, áudio - quase sempre não linear

## Lista de verificação de decisão

1. Trace ou inspecione seus dados. Você pode traçar um único limite direto entre as classes?
   - Sim: único perceptron funciona
   - Não: você precisa de pelo menos duas camadas
2. O problema pode ser decomposto em E/OU de decisões lineares mais simples?
   - Esta decomposição informa a estrutura mínima da rede
   - XOR = (A OU B) E (NÃO (A E B)) = 3 perceptrons em 2 camadas
3. Para problemas com mais de duas classes, você precisa de um nó de saída por classe

## A regra de treinamento

```
error = expected - predicted
weight_new = weight_old + learning_rate * error * input
bias_new = bias_old + learning_rate * error
```

Se a previsão estiver correta, nada muda. Se estiver errado, os pesos mudam para reduzir o erro. Isso funciona apenas para perceptrons de camada única. Redes multicamadas requerem retropropagação.

## Erros comuns

- Tentando aprender padrões não lineares com um único perceptron (nunca irá convergir)
- Definir a taxa de aprendizagem muito alta (os pesos oscilam) ou muito baixa (o treinamento leva uma eternidade)
- Esquecimento do termo de viés (sem ele, o limite de decisão deve passar pela origem)
- Confundir a convergência do perceptron (garantida para dados linearmente separáveis) com a convergência geral da rede neural (não garantida)