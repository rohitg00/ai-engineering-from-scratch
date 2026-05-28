---
name: actor-runtime
description: Crie um tempo de execução de ator em formato AutoGen v0.4 com estado privado, caixa de entrada por ator, IPC somente mensagem, isolamento de falhas e uma fila de mensagens mortas.
version: 1.0.0
phase: 14
lesson: 14
tags: [autogen, actor-model, messaging, fault-isolation, dead-letter]
---

Dada uma tarefa multiagente, produza um tempo de execução de ator e os atores de agente necessários.

Produzir:

1. Um tipo `Message` com `sender`, `recipient`, `topic`, `body`, `mid`.
2. Uma classe base `Actor` com `receive(message, runtime)`. O estado do ator é privado.
3. Um `Runtime` com uma fila compartilhada, `send()`, `run_until_idle()` e uma fila de devoluções. As exceções nos manipuladores vão para DLQ; não se propague.
4. Um auxiliar de topologia: RoundRobin (rotação fixa), Seletor (LLM escolhe a seguir) ou transmissão personalizada.
5. Ganchos de observabilidade por mensagem: emita spans OTel com `gen_ai.agent.name` e `gen_ai.operation.name` conforme Lição 23.

Rejeições difíceis:

- Passagem síncrona de mensagens que bloqueia o remetente até que o destinatário retorne. Esse é o modelo v0.2; ele quebra o isolamento de falhas.
- Estado mutável compartilhado entre atores. Os atores leem o estado por meio de mensagens ou não leem.
- Um tempo de execução que propaga exceções do manipulador. As falhas pertencem ao DLQ; deixe outros atores continuarem correndo.

Regras de recusa:

- Se a tarefa tiver apenas dois atores com vaivém fixo, recuse o enquadramento do ator e sugira uma cadeia imediata (Lição 12). Os atores ganham custos quando há >=3 atores ou simultaneidade assíncrona.
- Se o usuário desejar "modo síncrono" para "depuração mais fácil", recuse. Sugira registro + rastreamento (Lição 23).
- Se o domínio for estritamente solicitação/resposta com um único especialista, sugira roteamento (Lição 12) em vez de uma equipe de atores.

Saída: `message.py`, `actor.py`, `runtime.py`, `teams.py`, `README.md` explicando a política DLQ, a escolha da topologia e como os spans OTel são conectados. Termine com "o que ler a seguir" apontando para a Lição 25 (debate multiagente) se os atores negociarem, a Lição 23 (OTel) se o rastreamento for necessário ou o Microsoft Agent Framework se você quiser o tempo de execução voltado para o futuro.