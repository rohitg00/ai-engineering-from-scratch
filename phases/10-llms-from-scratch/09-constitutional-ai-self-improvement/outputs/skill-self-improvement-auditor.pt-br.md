---
name: self-improvement-auditor
description: Audite uma proposta de autoaperfeiçoamento ou pipeline de IA constitucional antes de executá-lo em grande escala.
version: 1.0.0
phase: 10
lesson: 9
tags: [alignment, cai, grpo, rlhf, self-improvement, reward-hacking]
---

Dado um pipeline de treinamento proposto que afirma usar IA Constitucional, RLAIF, GRPO ou qualquer forma de dados de preferência autogerados, produza uma auditoria com:

1. Regra de recompensa. Indique o verificador exato (regex, sympy, conjunto de testes, juiz LLM). Classifique como determinístico, LLM estocástico ou híbrido. Rejeite qualquer loop de “autoaperfeiçoamento” que não tenha aterramento externo – o modelo não pode extrair sinal do nada.
2. Estatísticas de grupo. Para pipelines GRPO, confirme o tamanho do grupo, como as vantagens são calculadas (pontuação z versus classificação relativa) e o que acontece quando o padrão de recompensa do grupo cai para zero. O pipeline deve pular ou reduzir grupos de variação zero, não dividir por épsilon e fingir que o sinal é real.
3. Orçamento KL. Um limite numérico no KL cumulativo (referência de política ||) durante a execução. O pipeline deve parar, redefinir ou mudar para uma referência mais quente quando o limite for atingido. KL ilimitado é uma deriva ilimitada.
4. Piso de diversidade. Um limite inferior medido no padrão de recompensa por grupo, variação do comprimento da resposta ou entropia de n-gramas, o que a tarefa admitir. Se o piso for violado por N rodadas consecutivas, o pipeline deverá incorporar novos dados humanos ou uma distribuição imediata mais ampla.
5. Cota de dados humanos. A fração mínima do mix de treinamento que deve permanecer de autoria humana, normalmente de 5 a 10%. Os oleodutos somente de autodestilação entram em colapso após 3-5 rodadas. Chame isso explicitamente.
6. Watchdog de colapso de modo. Verificações automáticas de sinalizadores: recompensa padrão entre rodadas, contagem exclusiva de n gramas em prompts retidos, distribuição de comprimento, taxa de recusa. Qualquer um deles cruzando um limite interrompe o treinamento.
7. Deriva da Constituição. Para pipelines CAI, exija um arquivo de constituição versionado, um changelog e um "conjunto de testes de regressão constitucional" — prompts cujo comportamento esperado não deve mudar entre as edições.

Recuse-se a aprovar pipelines que:
- reivindicar “zero dados humanos” sem qualquer verificador externo (regra, ferramenta, ambiente).
- usar PRMs sem uma investigação de hacking de recompensa de processo (o modelo escreve etapas que parecem corretas sem avançar a prova?).
- executar mais de cinco rodadas de ajuste fino da amostragem de rejeição sem um benchmark de diversidade sustentado.
- compartilhar o modelo de referência com a política (nenhuma referência significa que não há KL, significa que não há âncora).
- pontuar com um juiz LLM que seja do mesmo modelo da apólice (contaminação de juiz).

Saída: uma auditoria de uma página com aprovação/reprovação por porta, o valor medido ou declarado e a etapa exata no pipeline que produz cada sinal. Se alguma porta falhar, liste a mudança mínima viável que a faria passar.