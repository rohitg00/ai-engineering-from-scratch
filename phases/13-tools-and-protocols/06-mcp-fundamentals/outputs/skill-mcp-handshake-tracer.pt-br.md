---
name: mcp-handshake-tracer
description: Given a pcap-style transcript of an MCP client-server conversation, annotate every message with its primitive, lifecycle phase, and capability dependency.
version: 1.0.0
phase: 13
lesson: 06
tags: [mcp, json-rpc, lifecycle, capabilities]
---
---
name: mcp-handshake-tracer
description: Given a pcap-style transcript of an MCP client-server conversation, annotate every message with its primitive, lifecycle phase, and capability dependency.
version: 1.0.0
phase: 13
lesson: 06
tags: [mcp, json-rpc, lifecycle, capabilities]
---

Dada uma sequência de envelopes JSON-RPC 2.0 capturados de uma sessão MCP, produza um passo a passo que nomeie o primitivo, a fase do ciclo de vida e o sinalizador de capacidade subjacente de cada mensagem.

Produzir:

1. Anotação por mensagem. Para cada `{request, response, notification}`, indique: direção (cliente-servidor ou servidor-cliente), primitiva (ferramentas/recursos/prompts/raízes/amostragem/elicitação/ciclo de vida), fase do ciclo de vida e o sinalizador de capacidade que teve que ser negociado para que esta mensagem fosse válida.
2. Verificação de capacidade. Reconstrua a troca `initialize` a partir da transcrição e liste todos os recursos negociados. Sinalize qualquer mensagem que possa violar um recurso ausente.
3. Diagnóstico de erros. Para cada erro JSON-RPC, nomeie o código e a causa mais provável de acordo com o contexto circundante.
4. Auditoria de integralidade. Sinalize uma transcrição que está faltando um dos seguintes: notificação `initialize`, `initialized`, pelo menos um `tools/list` ou equivalente, desligamento normal.
5. Conformidade com as especificações. Verifique os parâmetros de cada solicitação em relação ao conjunto de campos mínimos da especificação 2025-11-25. Omissões de sinalização.

Rejeições difíceis:
- Qualquer mensagem que use um método fora do conjunto permitido pela especificação sem um prefixo `x-`.
- Qualquer mensagem `sampling/createMessage` quando o cliente não declarou a capacidade `sampling`.
- Qualquer invocação antes da chegada de `notifications/initialized`.

Regras de recusa:
- Se solicitado a auditar uma transcrição de um protocolo não MCP, recuse e aponte a especificação A2A (Fase 13 · 19) como alternativa.
- Se solicitado a “consertar” a transcrição, recuse. Esta habilidade anota; não reescreve. Correções de rota por meio do SDK de implementação.

Saída: uma linha anotada por mensagem na ordem de chegada: `[phase/primitive/capability] <method or result shape>`. Termine com um resumo de três linhas nomeando quaisquer violações de capacidade e quaisquer etapas ausentes do ciclo de vida.