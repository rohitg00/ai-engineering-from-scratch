---
name: runtime-shape
description: Escolha um formato de tempo de execução de produção (solicitação-resposta, streaming, fila, evento, cron, durável) e conecte a observabilidade.
version: 1.0.0
phase: 14
lesson: 29
tags: [production, runtime, queue, event, durable, observability]
---

Dada uma classe de tarefa (duração esperada, contagem de etapas, tipo de gatilho, orçamento de latência), escolha o formato do tempo de execução.

Decisão:

1. <30s, o usuário espera -> **solicitação-resposta**.
2. UX progressiva ou voz -> **streaming**.
3. De minutos a horas, o usuário não espera -> **baseado em fila**.
4. Reativo a eventos externos -> **orientado por eventos**.
5. Limpeza periódica -> **cron**.
6. Qualquer uma das opções acima onde o custo de reinicialização é alto -> adicione **execução durável**.

Produzir:

1. O andaime de forma em sua pilha.
2. Observabilidade: spans OTel GenAI (Lição 23), backend conectado (Lição 24).
3. Para fila: DLQ + política de novas tentativas + métrica de profundidade da fila.
4. Para evento: registro de assinante explícito + caminho de reprodução.
5. Para cron: bloqueie o arquivo ou bloqueie distribuído para evitar execuções sobrepostas.
6. Para durabilidade: back-end do checkpointer + semântica de currículo.

Rejeições difíceis:

- HTTP síncrono para uma tarefa de 5 minutos. Os usuários desligam; os trabalhadores se amontoam.
- Baseado em fila sem DLQ. Os trabalhos fracassados ​​desaparecem.
- Trabalho em segundo plano sem exportação de rastreamento. Falhas invisíveis até que os usuários reclamem.
- "Nenhum estado durável, vamos apenas tentar novamente." Horizontes longos devem ser verificados.

Regras de recusa:

- Se o produto tiver requisitos de SLA + repetição, recuse a topologia swarm + tempo de execução não durável.
- Se a tarefa estiver vinculada à conformidade, recuse a execução orientada por eventos sem trilha de auditoria.
- Se o usuário quiser cron + sem bloqueio, recuse. As execuções cron sobrepostas são, na melhor das hipóteses, trabalho duplicado e, na pior, corrupção de dados.

Saída: andaime de tempo de execução + ganchos de observabilidade + README com SLA, política de repetição, escolha de ponto de verificação. Termine com "o que ler a seguir" apontando para a Lição 23 (OTel), Lição 24 (observabilidade) ou Lição 17 (Agentes Gerenciados para longa duração hospedada).