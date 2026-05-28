---
name: refine-loop
description: Configure um loop avaliador-otimizador (Self-Refine / CRITIC) de acordo com a tarefa, a disponibilidade do verificador e o orçamento de iteração.
version: 1.0.0
phase: 14
lesson: 05
tags: [self-refine, critic, evaluator-optimizer, guardrails, iteration]
---

Dada uma tarefa, um orçamento de iteração e qual verificador está disponível (baseado em ferramenta ou apenas autoavaliação), emita prompts e uma política de parada para um loop avaliador-otimizador.

Produzir:

1. Alerta do gerador. Produtor determinístico para a primeira saída. Indique explicitamente a tarefa, o formato de saída e as restrições.
2. Solicitação do avaliador/verificador. Se ferramentas estiverem disponíveis (pesquisa, execução de código, testes, calculadora, verificação de tipo), especifique como chamá-las e como produzir uma crítica estruturada (JSON com: aprovação/reprovação, violações[], correções_sugeridas[]). Se apenas a autoavaliação estiver disponível, sinalize explicitamente o risco do carimbo de borracha do Self-Refine e use um estilo de prompt estruturalmente diferente (por exemplo, adversário "encontre pelo menos uma falha").
3. Solicitação do refinador. Deve fazer referência a resultados e críticas anteriores (histórico). Afirmar que “não repetir um modo de falha sinalizado em iterações anteriores” é obrigatório.
4. Pare a política. A conjunção: verificador passa OR (a autoavaliação diz iterações AND bem >= 2) iterações OR >= max_iterations. Nunca uma única condição.
5. Ganchos de observabilidade. Registre cada iteração como um intervalo OpenTelemetry GenAI (avaliar, otimizar) de acordo com a Lição 23 para que toda a trajetória de refinamento seja auditável.

Rejeições difíceis:

- Mesmo prompt para gerador e crítico. Risco de carimbo – o modelo concorda consigo mesmo.
- Sem limite de iteração. Loops de refinamento infinitos queimam tokens; sempre limite 4 por padrão.
- Prompt do verificador que solicita feedback em prosa de forma livre. Apenas JSON estruturado – aprovação/reprovação mais violações discriminadas.
- Eliminando o histórico do prompt do refinador. O papel mostra que a qualidade entra em colapso sem ele.

Regras de recusa:

- Se a tarefa não tiver verificador e não houver maneira de construir um, recuse o CRITIC e observe que o Self-Refine é a opção mais fraca disponível - avise o usuário sobre o risco do carimbo de borracha.
- Se max_iterations >= 10, recuse e recomende reestruturar a tarefa. Refinar para convergência além de 3-4 passagens geralmente é um sinal de que o prompt do gerador está errado.
- Se o verificador chamar ferramentas destrutivas (shell, git write), recuse e exija um limite de sandbox (Lição 09).

Saída: um único bloco de configuração com todos os prompts, política de parada e lista de ferramentas, além de uma nota "o que ler a seguir" apontando para a Lição 16 (proteções do SDK dos agentes OpenAI), Lição 12 (Otimizador de avaliador Anthropic) ou Lição 30 (desenvolvimento de agente orientado por avaliação) com base no destino de implantação.