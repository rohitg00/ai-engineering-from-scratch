---
name: rewoo-planner
description: Gere um DAG de plano ReWOO validado a partir de uma solicitação de usuário e catálogo de ferramentas.
version: 1.0.0
phase: 14
lesson: 02
tags: [rewoo, plan-and-execute, planning, dag, distillation]
---

Dada uma solicitação do usuário e um catálogo de ferramentas (nome, esquema de entrada, descrição), produza um plano ReWOO: um DAG de etapas com chamadas de ferramentas e referências de evidências (`#E1`, `#E2`, ...). Valide o plano antes de entregá-lo a um executor.

Produzir:

1. Um plano DAG. Cada nó possui id (`E1`, `E2`, ...), nome da ferramenta, ditado de argumento (strings podem conter referências `#E<k>`) e rótulo opcional `parallel_group`.
2. Saída de validação. Verificação de aciclicidade via classificação topológica; verificação de resolução de referência (cada `#E<k>` tem um produtor anterior); verificação da existência de ferramentas (todo nome de ferramenta está no catálogo); verificação do esquema arg (cada argumento corresponde ao esquema de entrada da ferramenta).
3. Dica de paralelismo. Para cada nível topológico, liste os nós que podem ser executados simultaneamente.
4. Recomendação de divisão planejador/solucionador. Se o plano tiver menos de três etapas, recomende o ReAct. Se o plano tiver um requisito de loop ilimitado (replanejamento em cada etapa), recomende Planejar e Executar com replanejador. Se o plano exceder 30 etapas ou for direcionado para web/dispositivos móveis, recomende Planejar e Agir com dados de plano sintéticos.

Rejeições difíceis:

- Planos com ciclos. ReWOO assume um DAG; os ciclos são uma preocupação do ReAct ou do LATS.
- Planos que fazem referência a `#E<k>` onde `k` ainda não existe na ordem topológica. Emita a borda específica que falha.
- Planos que chamam ferramentas que não estão no catálogo. Não invente ferramentas para fazer um plano funcionar.
- Planos onde o tipo de argumento para uma referência não corresponde ao esquema da ferramenta (por exemplo, `#E1` substitui uma string, mas a ferramenta espera um int).

Regras de recusa:

- Se a tarefa for de exploração aberta (ferramentas desconhecidas necessárias, etapas desconhecidas), recuse e recomende ReAct ou LATS (Lição 04).
- Se o catálogo de ferramentas contiver ferramentas destrutivas sem ferramenta de aprovação de gate, recuse e aponte para a Lição 09 (permissões, sandbox).

Saída: um plano estruturado (JSON ou YAML), um relatório de validação, um mapa de paralelismo e uma ação de acompanhamento apontando para o executor (ReWOO Worker), um replanejador (Plan-and-Execute) ou um ciclo de amostragem de trajetória maior (Plan-and-Act).

Termine com uma nota "o que ler a seguir" apontando para a Lição 03 (Reflexão) se a classe de tarefa já tiver sido tentada antes, ou para a Lição 04 (LATS) se o plano se beneficiaria da pesquisa.