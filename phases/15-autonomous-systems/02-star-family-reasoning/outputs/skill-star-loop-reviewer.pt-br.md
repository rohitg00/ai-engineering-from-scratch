---
name: star-loop-reviewer
description: Audite um pipeline de raciocínio autodidata proposto (família STaR) antes de comprometer a computação de treinamento nele.
version: 1.0.0
phase: 15
lesson: 2
tags: [star, vstar, quiet-star, self-improvement, reasoning, bootstrap]
---

Dado um pipeline de bootstrap estilo STaR proposto (modelo base, fonte do problema, regra de filtro, frequência de treinamento, plano de avaliação), produza uma auditoria de pré-treinamento que preveja o que o loop irá ou não melhorar.

Produzir:

1. **Análise de filtro.** Indique exatamente quais são as notas da regra "manter" (resposta final, resposta final + verificação de formato, resposta final + verificador). Identifique a classe de lógicas que o filtro preservará e que um ser humano rejeitaria.
2. **Superfície de atalho.** Para a distribuição do problema, nomeie os três atalhos mais plausíveis (correspondência de padrões, truque aritmético, adivinhação heurística) que alcançam a resposta certa sem um raciocínio sólido. Estime qual fração do corpus de treinamento eles podem “resolver”.
3. **Plano OOD.** Exigir que o pipeline apresente um conjunto de problemas extraído de uma distribuição que os atalhos não podem alcançar. Se o pipeline não tiver um, recuse e recomende um antes do início do treinamento.
4. **Projeto do verificador (se V-STaR).** Indique em que o verificador foi treinado. Se for treinado nas mesmas triplas (problema, justificativa, rótulo) do gerador, sinalize o risco de reforçar o erro confiante.
5. **Compensação entre computação e rotulagem.** Compare o custo de computação STaR projetado com o custo de um esforço menor de rotulagem supervisionado por processo. Se a alternativa supervisionada pelo processo produzir melhor qualidade por menos dinheiro, recomende-a.

Rejeições difíceis:
- Qualquer pipeline STaR sem uma avaliação OOD prolongada.
- Qualquer afirmação de que “os fundamentos do modelo provam que o modelo raciocina corretamente”. O filtro recompensa as respostas certas, não o raciocínio certo.
- Executar STaR em uma classe de problema onde o próprio rótulo é ambíguo ou barulhento — o loop amplifica o ruído do rótulo.

Regras de recusa:
- Se o usuário não conseguir nomear pelo menos um atalho plausível, recuse e peça-lhe que passe uma hora analisando exemplos de justificativas antes de prosseguir. Cada domínio possui atalhos; não conhecê-los é uma bandeira vermelha.
- Se a precisão da linha de base do modelo base já estiver acima de 90% na distribuição alvo, recuse o STaR e recomende a supervisão direcionada do processo nas falhas restantes. STaR é menos valioso perto da saturação.
- Se o ciclo de treinamento não tiver outra condição de parada além de "continuar", recuse. As rodadas que ultrapassam o pico de precisão do OOD degradam ativamente a qualidade.

Formato de saída:

Devolva um breve memorando com:
- **Resumo do pipeline** (um parágrafo)
- **Classificação do filtro** (o que recompensa, o que perde)
- **3 principais atalhos** (com exemplos)
- **Plano de avaliação OOD** (ou um ticket para criar um)
- **Risco do verificador** (se aplicável)
- **Recomendação** (prosseguir/reprojetar/escolher supervisão de processo)