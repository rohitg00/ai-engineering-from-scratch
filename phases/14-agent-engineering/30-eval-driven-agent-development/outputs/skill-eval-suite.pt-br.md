---
name: eval-suite
description: Crie um conjunto de avaliação de três camadas (benchmarks estáticos, produção off-line personalizada, produção on-line) com loop de avaliador-otimizador e portas de CI.
version: 1.0.0
phase: 14
lesson: 30
tags: [evaluation, ci, regression, benchmarks, llm-judge]
---

Dado um produto de agente, crie um conjunto de avaliação de três camadas conectado ao CI.

Produzir:

1. **Camada de benchmark estático** — pelo menos um benchmark relevante (SWE-bench Verified para código, BFCL V4 para uso de ferramentas, WebArena para web, OSWorld para desktop, GAIA para generalista). Sempre relate a pontuação + auditada ao lado.
2. **Camada off-line personalizada** — pelo menos uma rubrica de juiz LLM pontuada em dimensões específicas do domínio (factual, tom, escopo, qualidade da recusa). Pelo menos um caso baseado em execução que investiga o estado real após a execução do agente. Pelo menos um caso baseado em trajetória com caminho de ouro.
3. **Camada de avaliação on-line** — replays de sessão, alertas acionados por guardrail, rastreamento de custo/latência por etapa por meio de spans OTel GenAI (Lição 23).
4. **Executor avaliador-otimizador** — envolva o agente em propor/julgar/refinar com um limite redondo.
5. **Porta CI** — falha na construção em >=5% de regressão versus linha de base. Acompanhe a linha de base ao longo do tempo.
6. **Mapeamento de casos** — cada proteção e cada regra aprendida nas lições da Fase 14 tem pelo menos um caso.

Rejeições difíceis:

- Conjunto de avaliação sem linha de base. Você não pode detectar regressão sem uma referência.
- Juiz LLM sem fundamentação externa em tarefas factuais. O padrão CRITIC (Lição 05) é obrigatório.
- Casos escamosos sem sementes fixadas ou estado de instantâneo. Alarmes falsos minam a confiança da equipe nas avaliações.

Regras de recusa:

- Se o usuário quiser “apenas o caminho feliz”, recuse. Cada modo de falha (Lição 26) deve ter um caso.
- Se o usuário quiser “sem portão de CI”, recuse produtos que atinjam usuários pagantes. O desvio de avaliação é invisível de outra forma.
- Se o usuário quiser "todos os juízes LLM", recuse tarefas factuais e de conformidade. Avaliadores baseados em execução ou programáticos são necessários lá.

Saída: `cases/benchmarks/`, `cases/custom/`, `cases/online/`, `runner.py`, `ci_gate.py`, `README.md` explicando rubricas, linhas de base e a tabela de mapeamento da Fase 14. Termine com "o que ler a seguir" apontando para a Lição 24 (observabilidade), Lição 26 (modos de falha) ou Lição 23 (OTel) para o substrato.