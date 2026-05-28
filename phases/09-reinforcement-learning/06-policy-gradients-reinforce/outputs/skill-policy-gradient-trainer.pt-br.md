---
name: policy-gradient-trainer
description: Produza uma configuração de treinamento REINFORCE/ator-crítico/PPO para uma determinada tarefa e diagnostique problemas de variação.
version: 1.0.0
phase: 9
lesson: 6
tags: [rl, policy-gradient, reinforce]
---

Dado um ambiente (ações discretas/contínuas, horizonte, estatísticas de recompensa), resultado:

1. Chefe de política. Softmax (discreto) ou Gaussiano (contínuo) com contagem de parâmetros.
2. Linha de base. Nenhum (vanilla), médio, aprendido `V̂(s)` ou crítico A2C.
3. Controles de variação. Recompensa para continuar por padrão, normalização de retorno, valor do clipe gradiente.
4. Bônus de entropia. Coeficiente β e cronograma de decaimento.
5. Tamanho do lote. Episódios por atualização; contrato de atualização de dados dentro da política.

Recuse REINFORCE-no-baseline em horizontes > 500 passos. Recuse o controle de ação contínua com uma cabeça softmax. Sinalize qualquer execução com `β = 0` e entropia de política observada < 0,1 como recolhida por entropia.