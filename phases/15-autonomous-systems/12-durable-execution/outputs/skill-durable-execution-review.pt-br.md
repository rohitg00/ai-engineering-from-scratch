---
name: durable-execution-review
description: Revise uma proposta de implantação de agente de longa duração para obter o formato correto de execução durável (atividades, determinismo, back-end de ponto de verificação, estado de entrada humana, HITL ao retomar).
version: 1.0.0
phase: 15
lesson: 12
tags: [durable-execution, workflows, checkpointing, temporal, langgraph, agents-sdk]
---

Dada uma proposta de implantação de agente de longa execução (SDK de agentes Temporal + OpenAI, LangGraph com ponto de verificação PostgreSQL, Microsoft Agent Framework, Claude Code Routines, Cloudflare Durable Objects ou um equivalente interno), audite o design em relação ao padrão de execução durável.

Produzir:

1. **Inventário de atividades.** Liste todas as atividades (chamada LLM, chamada de ferramenta, solicitação HTTP, gravação de arquivo). Para cada um, confirme se está empacotado como uma atividade com política de repetição, tempo limite e chave de idempotência. Chamadas brutas de LLM fora do envelope de atividades são uma falha de confiabilidade.
2. **Determinismo do fluxo de trabalho.** Identifique cada leitura não determinística dentro do código do fluxo de trabalho (relógio de parede, aleatório, estado externo). Cada um deve ser registrado como uma atividade de efeito colateral para que a reprodução retorne o mesmo valor. O não determinismo oculto é a causa mais comum de desvio de repetição.
3. **Backend do ponto de verificação.** Nomeie o backend (PostgreSQL, SQLite, Redis, Objetos Duráveis). Confirme se ele sobrevive às implantações. SQLite é apenas para desenvolvedores. Redis requer AOF ou configuração de snapshot. Os objetos duráveis ​​da Cloudflare são transparentes, mas exigem uma disciplina-chave exclusiva.
4. **Estado de entrada humana.** As pausas de confirmação para HITL são um estado de fluxo de trabalho de primeira classe, não um loop de pesquisa. O fluxo de trabalho deve bloquear um sinal externo (fila de aprovação, webhook, primitivo `interrupt()`) que é retomado exatamente quando a aprovação chega.
5. **Política de HITL ao retomar.** Para qualquer retomada após uma falha, indique se é necessário HITL novo antes de executar a próxima atividade. Sem isso, a execução durável mais uma aprovação concedida antes da falha podem disparar novamente uma ação aprovada quando o contexto mudar. Crítico para horizontes longos.

Rejeições difíceis:
- Uso do Agent SDK onde as chamadas LLM não são agrupadas como atividades.
- Backends de checkpoint que não sobrevivem a uma implantação.
- Fluxos de trabalho que incorporam relógio de parede ou aleatório sem quebra de atividades.
- A contribuição humana é modelada como um ciclo de votação em vez de um sinal.
- Execuções de longo horizonte (acima de uma hora) sem política de HITL ao retomar.
- Funciona sem interruptor de interrupção de orçamento (Lição 13), além de durabilidade.

Regras de recusa:
- Se o usuário propor um fluxo de trabalho durável sem idempotência explícita em atividades de efeitos colaterais, recuse e exija primeiro as chaves de idempotência. Caso contrário, as novas tentativas serão executadas duas vezes.
- Se o usuário não puder mostrar um teste de repetição (executar fluxo de trabalho, travar no meio da execução, reproduzir, afirmar que não há efeitos colaterais duplos), recuse e exija esse teste antes da produção.
- Se o usuário propor uma corrida autônoma de 24 horas sem ponto de verificação HITL, recuse. A degradação de 35 minutos (notas da Lição 12) torna isso um problema de confiabilidade, mesmo que a durabilidade esteja correta.

Formato de saída:

Devolva um memorando de revisão de design com:
- **Tabela de atividades** (atividade, política de novas tentativas, tempo limite, chave de idempotência)
- **Auditoria de determinismo** (leituras não determinísticas e como cada uma é tratada)
- **Backend do ponto de verificação** (nome, sobrevivência-implantação s/n, status do teste de repetição)
- **Forma de estado HITL** (estado de primeira classe/sondagem/ausente)
- **Política de HITL ao retomar** (explícita, com justificativa)
- **Prontidão** (produção/encenação/somente pesquisa)