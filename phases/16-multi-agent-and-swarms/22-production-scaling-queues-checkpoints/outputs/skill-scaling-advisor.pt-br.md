---
name: scaling-advisor
description: Advise on durable-execution choice for a multi-agent production system. Picks between FastAPI + Postgres, LangGraph runtime, Temporal, Restate, or custom based on concrete load and state-retention needs.
version: 1.0.0
phase: 16
lesson: 22
tags: [multi-agent, production, scaling, durable-execution, queues, checkpoints]
---
---
name: scaling-advisor
description: Advise on durable-execution choice for a multi-agent production system. Picks between FastAPI + Postgres, LangGraph runtime, Temporal, Restate, or custom based on concrete load and state-retention needs.
version: 1.0.0
phase: 16
lesson: 22
tags: [multi-agent, production, scaling, durable-execution, queues, checkpoints]
---

Dado um plano de implantação de produção multiagente, recomende o substrato de execução durável.

Produzir:

1. **Carregar perfil.** Execuções simultâneas de agente (p50, p99). Per-run duration (seconds to hours). Fração de execuções que exigem esperas humanas. Frequência de implantação.
2. **Perfil de estado.** Tamanho do estado por execução (KB a MB). Requisito de retenção (segundos de histórico de pontos de verificação ou log de auditoria completo). Determinismo: as execuções podem ser reproduzidas a partir de pontos de verificação de forma determinística ou apenas a partir de logs?
3. **Perfil de efeitos colaterais.** Quais efeitos colaterais são necessários exatamente uma vez (pagamentos, APIs externas, e-mail)? O que pode tolerar pelo menos uma vez (leituras puras de ferramentas)? Outbox pattern needed for exactly-once.
4. **Recommendation tier.**
   - Tier 1 (Bedi's rule): FastAPI + Postgres. Menos de aproximadamente 100 execuções simultâneas, durações de menos de uma hora, tentativas simples.
   - Tier 2: LangGraph runtime or Temporal. Execuções de uma hora, interrupção/retomada, novas tentativas estruturadas.
   - Tier 3: Custom with outbox + event sourcing. Necessidades especializadas, alto rendimento, auditoria rigorosa.
5. **Modelo de implantação.** Versão única ou arco-íris/canário? Rainbow necessário para cargas de trabalho com estado de longa duração.
6. **Limite assíncrono/thread.** Quais partes são assíncronas (chamadas LLM, E/S de ferramenta) e quais são threads/processos (pós-processamento vinculado à CPU, incorporação).
7. **Observabilidade.** Rastreamentos por execução, auditoria em superetapas, contador de novas tentativas. Armazenamento para rastreios (separado do armazenamento do ponto de verificação).

Rejeições difíceis:

- Recomendação de Temporal para um protótipo de 10 execuções simultâneas. Custo da cerimônia > valor.
- Thread-per-job LLM call architectures. I/O-bound + 1MB/thread does not scale.
- Designs sem padrão de caixa de saída para efeitos colaterais pagos. Duplicate charges are expensive.
- Implementações de versão única para execuções de agente de várias horas. Users lose state on every code push.

Regras de recusa:

- Se a carga for desconhecida e não testada, recomende o Tier 1 mais o teste de carga. Premature optimization burns time.
- Se o usuário deseja um sistema tokenizado/persistente em blockchain, diga que os mecanismos de execução durável normalmente não resolvem isso (escreva sua própria fonte de eventos); recommend legal review for tokenized flows.
- Se a equipe não tiver engenheiro de plantão, a manutenção do tempo de execução Temporal/LangGraph fica subprovisionada; recommend Tier 1 until on-call is staffed.

Resultado: um resumo de duas páginas. Comece com uma recomendação de uma frase ("Nível 1 (FastAPI + Postgres + caixa de saída) para carga atual; aumente para o tempo de execução LangGraph quando a duração da execução p99 exceder 10 minutos ou as execuções simultâneas excederem 200.") e, em seguida, as sete seções acima. Termine com um caminho de atualização de 90 dias: métricas a serem observadas, limite para escalonamento, esboço do runbook.