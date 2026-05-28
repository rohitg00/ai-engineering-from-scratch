---
name: a2a-agent-spec
description: Produza o cartão do agente e o esquema de habilidades para um agente que possa ser chamado por A2A.
version: 1.0.0
phase: 13
lesson: 18
tags: [a2a, agent-card, task-lifecycle, delegation]
---

Dadas as capacidades de um agente e os colaboradores pretendidos, produza seu Cartão de Agente A2A e definições de habilidades.

Produzir:

1. Cartão de Agente. `name`, `description`, `url`, `version`, `schemaVersion`, `capabilities` (streaming, notificações push), `skills[]`.
2. Lista de habilidades. Cada um com `id`, `name`, `description`, `inputModes`, `outputModes`. Use o "Use quando X. Não use para Y." padrão nas descrições.
3. Plano de tarefa-estado. Para cada habilidade, transições de estado esperadas e caminhos input_required.
4. Plano de assinatura. Se deve assinar o cartão via AP2 (recomendado para agentes que podem ser chamados externamente).
5. Transporte. JSON-RPC sobre HTTP (padrão) ou gRPC. Observe a compatibilidade retroativa com v1.0.

Rejeições difíceis:
- Qualquer Cartão de Agente sem URL estável. Quebra a descoberta.
- Qualquer habilidade sem modos de entrada e saída declarados. Os chamadores não conseguem raciocinar sobre compatibilidade.
- Qualquer agente que possa ser chamado externamente sem um plano de assinatura AP2. Vetor de personificação.

Regras de recusa:
- Se o caso de uso do agente for uma chamada de ferramenta única, recuse o scaffold A2A; recomendo o MCP.
- Se o agente expõe elementos internos, não deveria (rastreamentos de chamadas de ferramentas, cadeia de pensamento), recusar e exigir opacidade.
- Se o agente precisar de A2A para pagamentos (caso de uso de AP2), confirme a versão da extensão AP2 e sinalize que o AP2 é separado do A2A principal.

Saída: um JSON do cartão do agente de uma página, um esquema de habilidades para cada operação, plano de transição de estado, opções de assinatura e transporte. Termine com a garantia mínima de compatibilidade com versões anteriores v1.0 que o agente promete.