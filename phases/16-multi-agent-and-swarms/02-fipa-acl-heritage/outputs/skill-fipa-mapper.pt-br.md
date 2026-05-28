---
name: fipa-mapper
description: Mapeie qualquer especificação de protocolo de agente 2026 (MCP, A2A, ACP, ANP, CA-MCP, NLIP ou uma nova) em performativos e protocolos de interação FIPA-ACL para decidir o que é novidade genuína e o que é reinvenção.
version: 1.0.0
phase: 16
lesson: 02
tags: [multi-agent, protocols, FIPA, speech-acts, interoperability]
---

Dada uma nova especificação de protocolo de agente, produza o mapeamento FIPA-ACL para que o leitor possa dizer quais partes são reinvenções e quais são estruturas novas e genuínas.

Produzir:

1. **Mapeamento de envelope.** Para cada tipo de mensagem definido pela especificação, nomeie o performativo FIPA mais próximo (`inform`, `request`, `query-if`, `query-ref`, `propose`, `accept-proposal`, `reject-proposal`, `cfp`, `subscribe`, `cancel`, `failure`, `not-understood` ou um dos outros ~20). Se não houver ajustes performativos, descreva a lacuna com precisão.
2. **Modelo de correlação.** Como a especificação correlaciona solicitações com respostas, cancelamento com a solicitação original e eventos transmitidos com a assinatura? Compare com os campos `:conversation-id` e `:reply-with` do FIPA.
3. **Posição de linguagem de conteúdo.** A especificação exige um esquema de conteúdo (artefatos digitados, esquema JSON), aceita linguagem natural ou deixa-a aberta? Compare com os campos SL0/SL1 e ontologia da FIPA.
4. **Biblioteca de protocolos de interação.** Quais protocolos de interação FIPA são implementáveis ​​além das especificações: rede de contrato, assinatura-notificação, solicitação-quando, proposta-aceitação? Nomeie as mensagens que implementariam cada uma.
5. **Modelo de descoberta.** Como um agente encontra contrapartes e capacidades (MCP `listTools`, Cartão Agente A2A, ANP DID + metaprotocolo)? Compare com o facilitador de diretórios e o serviço de páginas amarelas da FIPA.
6. **Reinvenção versus novidade.** Produza uma pequena tabela com três colunas: [Conceito FIPA, especificações modernas equivalentes, o que mudou]. Marque cada linha como [reinvenção] ou [estrutura nova]. Uma linha é uma "estrutura nova" somente quando a especificação introduz uma primitiva que o FIPA não tinha - identidade descentralizada, artefatos multimodais digitados e conteúdo interpretável por LLM são os candidatos comuns.

Rejeições difíceis:

- Qualquer mapeamento que reivindique uma especificação é “revolucionário” sem mostrar uma primitiva que o FIPA não tinha. A teoria dos atos de fala + a sobrecarga da ontologia foram o modo de falha, não os primitivos.
- Comparações de frameworks que ignoram a camada de descoberta. Uma especificação sem descoberta é incompleta e não é nova.
- Declarações como “Protocolo X substitui FIPA” sem abordar o que acontece quando dois agentes discordam sobre o significado do conteúdo (deriva semântica).

Regras de recusa:

- Se a especificação for pré-padronização (rascunho com menos de 6 meses, sem implementações públicas), declare que o mapeamento é provisório e sinalize as três alterações mais prováveis.
- Se a especificação for de código fechado ou somente empresarial (alguns tipos de ACP), mapeie o que está documentado e nomeie as lacunas.
- Se o usuário fornecer apenas uma postagem no blog (sem documento de especificações), solicite as especificações antes de mapear.

Resultado: um resumo de uma página. Comece com um resumo de uma única frase ("O protocolo X é FIPA `request`/`subscribe` com sintaxe JSON e uma camada de descoberta baseada em DID"), depois as seis seções acima e um parágrafo final respondendo: "Qual antigo modo de falha FIPA esta especificação redescobrirá?"