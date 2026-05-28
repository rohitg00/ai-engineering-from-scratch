# Herança do FIPA-ACL e Ato de Fala

> Antes do MCP, antes do A2A, existiu o FIPA-ACL. Em 2000 a IEEE Foundation for Intelligent Physical Agents ratificou uma linguagem de comunicação de agentes com vinte performativas, duas linguagens de conteúdo e um conjunto de protocolos de interação — contract net, subscribe/notify, request-when. Ele desapareceu da indústria porque o overhead de ontologia era pesado demais pra web, mas a revivência de sistemas multi-agent por LLMs está silenciosamente reimplementando as mesmas ideias sem a semântica formal: contratos JSON substituem as performativas, linguagem natural substitui as ontologias. Esta lição estuda o FIPA-ACL a sério pra você ver quais decisões de protocolo de 2026 são reinvenção, quais são novidade, e pra onde a onda atual vai redescobrir problemas que os anos 2000 já resolveram.

**Tipo:** Aprender
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 16 · 01 (Por que Multi-Agent)
**Tempo:** ~60 minutos

## Problema

O cenário de protocolos de agente de 2026 é corrido: MCP pra tools, A2A pra agents, ACP pra auditoria corporativa, ANP pra confiança descentralizada, NLIP pra conteúdo em linguagem natural, além de CA-MCP e duas dúzias de propostas de pesquisa. Cada eespecificaçãoificação se apresenta como fundamental.

A leitura honesta é que a maioria deles está redescobrindo uma árvore de decisão muito eespecificaçãoífica de vinte anos atrás. A teoria de atos de fala de Austin (1962) e Searle (1969) nos deu "enunciados são ações." KQML (1993) transformou isso num protocolo de comunicação. FIPA-ACL (ratificado em 2000) produziu a padronização de referência: vinte performativas, linguagens de conteúdo SL0/SL1, protocolos de interação pra contract-net e subscribe-notify. JADE e JACK foram as plataformas de referência Java. O esforço desapareceu por volta de 2010 porque o overhead de ontologia era pesado e a web estava vencendo.

Quando você olha o `tools/call` do MCP, o ciclo de vida de tarefas do A2A, ou o armazenamento de contexto compartilhado do CA-MCP, você está olhando uma versão mais leve e nativa de JSON dos decisões do FIPA. Conhecer a herança te diz duas coisas: quais "inovações" novas são na verdade reinvenções, e quais modos de falha antigos os novos protocolos vão redescobrir.

## Conceito

### Atos de fala, num parágrafo

Austin notou que algumas frases não descrevem o mundo — elas mudam o mundo. "Eu prometo." "Eu peço." "Eu declaro." Ele chamou esses enunciados performativos. Searle formalizou cinco categorias: assertiva, direta, comissiva, expressiva, declarativa. KQML (Finin et al., 1993) tornou isso operacional pra software agents: uma mensagem é uma performática (a ação) mais conteúdo (sobre o que é a ação). FIPA-ACL limpou as lacunas do KQML e padronizou ao redor de vinte performativas.

### As vinte performativas do FIPA (lista parcial)

| Performática | Intenção |
|---|---|
| `inform` | "Eu digo que P é verdadeiro" |
| `request` | "Eu peço pra você fazer X" |
| `consulta-if` | "P é verdadeiro?" |
| `consulta-ref` | "Qual é o valor de X?" |
| `propose` | "Eu proponha que façamos X" |
| `accept-proposal` | "Eu aceito a proposta" |
| `reject-proposal` | "Eu rejeito a proposta" |
| `agree` | "Eu concordo em fazer X" |
| `refuse` | "Eu me recuso a fazer X" |
| `confirm` | "Eu confirmo que P é verdadeiro" |
| `disconfirm` | "Eu nego P" |
| `not-understood` | "Sua mensagem não foi parseada" |
| `cfp` | "Chamada pra propostas sobre X" |
| `subscribe` | "Notifique-me quando X mudar" |
| `cancel` | "Cancele o X em andamento" |
| `failure` | "Tentei X e falhei" |

A lista completa está em `fipa00037.pdf` (Estrutura de Mensagens FIPA ACL). O ponto não é memorizar — o ponto é que cada uma dessas corresponde a uma primitiva que um protocolo LLM eventualmente volta a adicionar.

### Mensagem canônica FIPA-ACL

```
(inform
  :sender       agent1@platform
  :receiver     agent2@platform
  :content      "((price IBM 83))"
  :language     SL0
  :ontology     finance
  :protocol     fipa-request
  :conversation-id   conv-42
  :reply-with   msg-17
)
```

Sete campos carregam o envelope do protocolo; um campo (`content`) carrega o payload. O resto dos campos são exatamente o que você reinventa toda vez que enfileira retries, threading e ontologia num protocolo JSON.

### As duas plataformas legadas

**JADE** (Java Agent DEvelopment framework, 1999–2020s) foi o runtime mais usado compatível com FIPA. Agents estendiam uma classe base, trocavam mensagens ACL, rodavam dentro de containers e coordenavam usando "behaviors." A biblioteca de protocolos de interação vinha com contract-net, subscribe-notify, request-when e propose-accept.

**JACK** (Agent Oriented Software, comercial) enfatizava raciocínio BDI (Belief-Desire-Intention) sobre mensagens FIPA. Mais formal, menos adotado.

Ambos declinaram quando a stack web comeu os casos de uso multi-agent. MCP e A2A são os "containers" runtime de 2026.

### Por que o FIPA desapareceu

- **Overhead de ontologia.** O FIPA exigia uma ontologia compartilhada pra parsear o `content`. Concordar sobre ontologias é um processo de padronização que leva anos. A web simplesmente usou HTTP + JSON.
- **Semântica formal que ninguém usava.** SL (Semantic Language) dava condições de verdade rigorosas, mas a maioria dos sistemas em produção usava conteúdo livre e ignorava o formalismo.
- **Lock-in de ferramentas.** O JADE era só Java; o JACK era comercial. Times poliglotes contornaram os dois.
- **A internet venceu a stack.** REST, depois JSON-RPC, depois gRPC substituíram o transporte do ACL.

### A revivência de LLMs é FIPA-lite

Compare um `request` do FIPA com um `tools/call` do MCP:

```
(request                                {
  :sender  agent1                         "jsonrpc": "2.0",
  :receiver tool-server                   "method":  "tools/call",
  :content "(lookup stock IBM)"           "params":  {"name":"lookup_stock",
  :ontology finance                                   "arguments":{"symbol":"IBM"}},
  :conversation-id c42                    "id": 42
)                                        }
```

Mesmo envelope, sintaxe diferente. Ambos carregam: quem, pra quem, intenção, payload, id de correlação. Nenhum é uma revolução sobre o outro — são tradeoffs diferentes no mesmo design.

O survey de 2025 de Liu et al. ("A Survey of Agent Interoperability Protocols: MCP, ACP, A2A, ANP", arXiv:2505.02279) torna essa linhagem explícita: MCP corresponde a atos de fala de uso de tools, A2A a atos de fala entre pares, ACP a atos de fala de trilha de auditoria, ANP a extensões de identidade descentralizada. As novas especificaçãos são descendentes do ACL com sintaxe JSON e semântica mais solta.

### O tradeoff, dito de forma simples

**O que o FIPA te dava e as especificaçãos modernas abandonam:**

- Semântica formal — você pode provar que `inform` implica que o remetente acredita no conteúdo.
- Um catálogo canônico de performativas — você não precisa re-debatir "devemos ter um `cancel`?".
- Décadas de padrões de protocolo de interação — contract-net, subscribe-notify, propose-accept — com propriedades de correção conhecidas.

**O que as especificaçãos modernas te dão e o FIPA não dava:**

- Payloads nativos de JSON compatíveis com toda ferramenta moderna.
- Conteúdo em linguagem natural que LLMs podem interpretar sem uma ontologia codificada à mão.
- Transporte da stack web (HTTP, SSE, WebSocket).
- Descoberta de capacidades via documentos auto-descritivos (`listTools` do MCP, Agent Card do A2A).

Semântica de intenção mais solta pra implementação mais fácil. Esse é o tradeoff exato.

### Protocolos de interação que vale a pena portar

O FIPA entregou ~15 protocolos de interação. Três valem a pena levar pra sistemas multi-agent com LLMs:

1. **Contract Net Protocol (CNP).** O gerente emite `cfp` (chamada pra propostas); licitantes respondem com `propose`; o gerente aceita/rejeita. É o padrão canônico de mercado de tarefas (Fase 16 · 16 Negociação).
2. **Subscribe/Notify.** Assinante envia `subscribe`; publicador envia `inform` sempre que o tópico muda. É todo event-bus em 2026.
3. **Request-When.** "Faça X quando a condição Y valer." Ação atrasada com pré-condições. O equivalente em 2026 são tarefas adiadas em engines de workflow duráveis (Fase 16 · 22 Escala de Produção).

Cada um se mapeia limpidamente pra filas de mensagens modernas, HTTP + polling, ou streaming SSE.

### O que quebra quando você larga a ontologia

Sem uma ontologia compartilhada, agentes inferem significado do conteúdo em linguagem natural. O modo de falha documentado em 2026 é **deriva semântica**: dois agentes usam a mesma palavra (`"customer"`) pra conceitos sutilmente diferentes, o agente destinatário age na interpretação errada, nenhum validador de schema pega. O requisito de ontologia do FIPA teria rejeitado a mensagem no tempo de parsing.

Mitigações sem ir full ontologia:

- JSON Schema no `content` — rejeita erros estruturais no nível da transmissão.
- Artefatos tipados (A2A) — rejeita modalidade errada.
- Performática explícita no envelope — torna a intenção inequívoca mesmo quando o conteúdo é linguagem natural.

### As especificaçãos de 2026, mapeadas pra herança de atos de fala

| Spec moderna | Análogo FIPA | O que mantém | O que abandona |
|---|---|---|---|
| MCP `tools/call` | `request` | intenção explícita, id de correlação | semântica formal, ontologia |
| MCP `resources/read` | `consulta-ref` | intenção explícita, id de correlação | semântica formal |
| Ciclo de vida de Tarefa A2A | contract-net + request-when | ciclo de vida assíncrono, transições de estado | garantias de completude formais |
| Eventos de streaming A2A | subscribe/notify | push assíncrono | assinatura por predicado tipado |
| Contexto compartilhado CA-MCP | blackboard (Hayes-Roth 1985) | memória compartilhada multi-escrita | modelo de consistência lógica |
| NLIP | conteúdo em linguagem natural | nativo pra LLM | schema |

Lendo a tabela de cima pra baixo, o padrão é: manter a primitiva estrutural, abandonar o formalismo, deixar os LLMs taparem a ambiguidade.

## Construa

`code/main.py` implementa um tradutor FIPA-ACL puro com stdlib. Ele codifica e decodifica o envelope ACL canônico e mostra como cada formato de mensagem MCP / A2A se reduz aos mesmos sete campos. A demo:

- Codifica cinco mensagens no estilo MCP e A2A como FIPA-ACL.
- Decodifica FIPA-ACL de volta pro equivalente moderno.
- Roda uma negociação de Contract Net de brinquedo entre um gerente e três licitantes usando `cfp`, `propose`, `accept-proposal`, `reject-proposal`.

Execute:

```
python3 code/main.py
```

A saída é um trace lado a lado mostrando cada mensagem moderna tanto na forma JSON de 2026 quanto na forma FIPA-ACL, depois um round-trip de uma proposta de contract-net. As mesmas primitivas de protocolo sobrevivem ao round-trip; só a sintaxe muda.

## Use

`outputs/skill-fipa-mapper.md` é uma skill que lê qualquer especificação de protocolo de agente e produz o mapeamento FIPA-ACL. Use antes de adotar um novo protocolo pra responder: "Isso é genuinamente novo, ou é `inform` com sintaxe JSON?"

## Entregue

Não traga o FIPA-ACL de volta. Traga de volta seu checklist:

- Qual é a primitiva de intenção (performática) de cada mensagem?
- Há um id de correlação pra request-response e cancelamento?
- Há uma linguagem de conteúdo explícita (JSON-RPC, texto simples, artefato tipado estruturado)?
- Protocolos de interação são de primeira classe, ou você está reimplementando contract-net do zero?
- O que acontece quando dois agentes discordam sobre o significado do conteúdo (deriva semântica)?

Documente essas cinco perguntas pra qualquer novo protocolo antes de levá-lo pra produção.

## Exercícios

1. Execute `code/main.py`. Observe o round-trip de codificação. Identifique qual performática do FIPA corresponde a `tools/call`, `resources/read` e criação de tarefa A2A.
2. Estenda a demo de contract-net com uma performática `cancel` que permite ao gerente retirar a tarefa no meio da licitação. Qual caso de falha o `cancel` resolve que retries sozinhos não resolvem?
3. Leia a Estrutura de Mensagens FIPA ACL (http://www.fipa.org/especificaçãos/fipa00037/) seções 4.1–4.3. Escolha uma performática não coberta nesta lição e descreva seu análogo JSON-RPC moderno.
4. Leia Liu et al., arXiv:2505.02279. Pra cada um de MCP, A2A, ACP, ANP, liste as famílias de performáticas FIPA que mantêm e abandonam.
5. Projet um JSON-Schema mínimo para o campo `content` de uma performática `request` no seu próprio sistema. O que esse schema te dá que puro linguagem natural não dá, e quanto custa?

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Ato de fala | "Um enunciado que faz algo" | Austin/Searle: enunciados como ações. O pai teórico do ACL. |
| FIPA | "Aquela coisa antiga de XML" | IEEE Foundation for Intelligent Physical Agents. Padronizou o ACL em 2000. |
| ACL | "Agent Communication Language" | O formato de envelope do FIPA: performática + conteúdo + metadados. |
| Performática | "O verbo" | A classe de intenção de uma mensagem: `inform`, `request`, `propose`, `cfp`, etc. |
| KQML | "O predecessor do FIPA" | Knowledge Query and Manipulation Language (1993). Mais simples, mais estreito. |
| Ontologia | "Vocabulário compartilhado" | Uma definição formal dos conceitos que a linguagem de conteúdo fala. |
| SL0 / SL1 | "Linguagens de conteúdo do FIPA" | Semantic Language níveis 0 e 1 — a família de linguagens de conteúdo formal. |
| Contract Net | "Mercado de tarefas" | Gerente emite cfp; licitantes propõem; gerente aceita. O protocolo de interação canônico. |
| Protocolo de interação | "Padrão de mensagens" | Uma sequência de performativas com correção conhecida: request-when, subscribe-notify, etc. |

## Leitura Complementar

- [Liu et al. — A Survey of Agent Interoperability Protocols: MCP, ACP, A2A, ANP](https://arxiv.org/html/2505.02279v1) — o survey canônico de 2025 conectando especificaçãos modernas à herança do FIPA
- [Eespecificaçãoificação de Estrutura de Mensagens FIPA ACL (fipa00037)](http://www.fipa.org/especificaçãos/fipa00037/) — o formato de envelope ratificado em 2000
- [Eespecificaçãoificação da Biblioteca de Atos Comunicativos FIPA (fipa00037)](http://www.fipa.org/especificaçãos/fipa00037/) — o catálogo completo de performativas
- [Eespecificaçãoificação MCP 2025-11-25](https://modelcontextprotocol.io/especificaçãoification/2025-11-25) — o equivalente moderno de uso de ferramentas pra `request`/`consulta-ref`
- [Eespecificaçãoificação A2A](https://a2a-protocol.org/latest/especificaçãoification/) — o equivalente moderno de agent-para-pair pra contract-net e subscribe-notify
