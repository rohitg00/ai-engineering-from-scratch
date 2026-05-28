---
name: constitution-review
description: Audite a camada constitucional de uma implantação — proibições codificadas, padrões soft-coded, limites ajustáveis ​​pelo operador e resolução de hierarquia de quatro níveis.
version: 1.0.0
phase: 15
lesson: 17
tags: [constitutional-ai, rule-override, hierarchy, cai, rlaif, hardcoded-prohibition]
---

Dada a camada constitucional de uma implantação (prompt do sistema, configuração do operador, princípios declarados), audite-a em relação à referência da Constituição de Claude e sinalize proibições codificadas ausentes, princípios ambíguos ou níveis mal ordenados.

Produzir:

1. **Inventário de proibições codificadas.** Liste todas as proibições que não devem dobrar, independentemente das instruções do operador ou do usuário. Piso mínimo: armas biológicas/uplift QBRN, CSAM, planejamento de ataques a infraestruturas críticas, identidade falsa quando solicitada. As adições são específicas da implantação (por exemplo, serviços financeiros adicionam proibições específicas de fraude).
2. **Padrões codificados por software.** Liste todos os comportamentos que o operador pode ajustar. Para cada um, indique o limite declarado. Uma configuração "ajustável" sem limites é uma substituição indireta.
3. **Ordenação de níveis.** Confirme se a ordem de resolução é: segurança > ética > diretrizes > utilidade. Se a utilidade vencer a ética no resolvedor implementado, sinalize como uma interrupção na implantação.
4. **Sinalizadores de ambiguidade de princípio.** Identifique qualquer princípio cujo texto deixe espaço para interpretações materialmente diferentes. A ambigüidade aumenta ao longo dos ciclos de treinamento (desvio de princípio).
5. **Completude da camada.** Confirme se os controles da camada de tempo de execução (Lições 10, 13, 14) estão presentes além da camada constitucional. A Constituição por si só é insuficiente; o tempo de execução por si só é insuficiente.

Rejeições difíceis:
- Implantações sem qualquer camada de proibição codificada.
- Configuração do operador que afirma substituir uma proibição codificada (mesmo renomeando).
- Ordens de nível que colocam a utilidade acima da ética.
- Texto principal tão geral que não pode ser avaliado (“seja bom”).
- Tratar a IA Constitucional como um substituto para os controles de tempo de execução.

Regras de recusa:
- Se o usuário nomear uma proibição codificada, mas não puder apontar para um backstop de camada de tempo de execução para ela, sinalize a implantação como camada única e recuse a produção.
- Se a configuração do operador incluir uma configuração de "segurança" ajustável sem limite declarado, recuse.
- Se o usuário tratar as conclusões da Constituição Participativa de 2023 como acionáveis ​​na implantação atual, verifique: a Constituição de 2026 não as incorporou, portanto, “herda democraticamente” é uma afirmação que a implantação não pode respaldar.

Formato de saída:

Devolva uma auditoria constitucional com:
- **Piso codificado** (proibições, camada de aplicação: pesos/inferência/ambos)
- **Padrões codificados por software** (configuração, limite do operador, visível ao usuário s/n)
- **Ordem de nível** (listado; segurança confirmada > ética > diretrizes > utilidade)
- **Sinalizadores de ambiguidade** (princípio, ambiguidade específica, proposta de restrição)
- **Completude da camada** (s/n constitucional, controles de tempo de execução s/n, ambos obrigatórios)
- **Prontidão** (produção/encenação/somente pesquisa)