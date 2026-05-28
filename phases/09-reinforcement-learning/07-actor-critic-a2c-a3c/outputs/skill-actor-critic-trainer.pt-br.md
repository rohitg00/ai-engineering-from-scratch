---
name: actor-critic-trainer
description: Produza uma configuração A2C/A3C/GAE para um determinado ambiente, com estimativa de vantagem e pesos de perda especificados.
version: 1.0.0
phase: 9
lesson: 7
tags: [rl, actor-critic, gae]
---

Dado um ambiente e um orçamento de computação, a saída:

1. Paralelismo. A2C (GPU em lote) vs A3C (CPU assíncrona) e o número de trabalhadores.
2. Comprimento de implementação T. Etapas por ambiente por atualização.
3. Estimador de vantagem. n-passo ou GAE(λ); especifique λ.
4. Perda de peso. `c_v` (valor), `c_e` (entropia), clipe gradiente.
5. Taxas de aprendizagem. Ator e crítico (separados se for usar).

Recuse A2C de trabalhador único em ambientes com horizonte > 1000 (muito dentro da política, muito lento). Recuse-se a enviar sem normalização de vantagem. Sinalize qualquer execução com `c_e = 0` e entropia observada < 0,1 como recolhida por entropia.