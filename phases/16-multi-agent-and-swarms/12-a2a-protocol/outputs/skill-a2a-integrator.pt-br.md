---
name: a2a-integrator
description: Projete uma integração A2A entre dois agentes – Cartão de Agente, esquemas de tarefas, autenticação, streaming ou pesquisa.
version: 1.0.0
phase: 16
lesson: 12
tags: [multi-agent, a2a, protocol, interoperability, google]
---

Dados dois sistemas de agentes que precisam interoperar, produza o plano de integração A2A: conteúdo do cartão de agente, esquemas de tarefas, autenticação, modo de transporte.

Produzir:

1. **Cartão de Agente.** Nome, versão, habilidades, endpoints, modalidades suportadas (texto, estruturado, imagem, áudio, vídeo), protocol_version, declaração de autenticação.
2. **Esquemas de tarefas por habilidade.** Esquema JSON de entrada + esquema JSON de artefato. Seja explícito – os clientes validarão.
3. **Escolha de autenticação.** Token de portador (OAuth2 ou opaco), mTLS ou solicitações assinadas. Justifique dado o modelo de ameaça (internet pública, VPC, misto).
4. **Modo de transporte.** Pesquisa versus streaming SSE versus retornos de chamada de webhook. Streaming para tarefas de longa duração ou com muito progresso; pesquisa para tarefas curtas.
5. **Limites de taxa.** Limites por cliente e por tarefa. Proteção contra abusos.
6. **Idempotência.** Estratégia para solicitações `POST /tasks` duplicadas (chave de tarefa do lado do cliente, desduplicação do lado do servidor).
7. **Tratamento de falhas.** Estados de tarefas além de `failed` (retriable vs fatal), política de mensagens mortas, esquema de artefato de erro.
8. **Divisão MCP vs A2A.** Se o agente remoto usar MCP internamente, observe quais ferramentas são expostas ou mantidas internamente.

Rejeições difíceis:

- Cartões de Agente sem versão de protocolo declarada.
- Esquemas de tarefas que são texto de formato livre quando o caso de uso justifica estrutura.
- Auth=none em implantações de Internet pública.

Regras de recusa:

- Se ambos os agentes forem executados no mesmo processo, recuse A2A e recomende chamadas diretas de Python/JS. A2A é para limites entre sistemas.
- Se os requisitos de latência forem inferiores a 100 ms de ida e volta, recuse A2A e recomende RPC direto com um esquema compartilhado.
- Caso o agente remoto não declare um Cartão de Agente, recuse a integração e recomende a publicação de um primeiro.

Resultado: um resumo de integração de uma página. Feche com o JSON do cartão do agente colado in-line para que a engenharia possa colocá-lo em `/.well-known/agent.json`.