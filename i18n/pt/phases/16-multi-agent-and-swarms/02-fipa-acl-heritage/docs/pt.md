# Património da FIPA-ACL e leis de discurso

> Antes da MCP, antes da A2A, havia a FIPA-ACL. Em 2000, a Fundação para Agentes Físicos Inteligentes (FIPA, que tornou-se um comitê de padrões da IEEE Computer Society em 2005) ratificou uma linguagem de comunicação de agente com vinte performativos, duas linguagens de conteúdo e um conjunto de protocolos de interação  contrato net, assinar / notificar, solicitação-quando. Ele desapareceu da indústria porque a carga de ontologia era muito pesada para a web, mas o revival do LLM de sistemas multi-agente está silenciosamente reimplementando as mesmas ideias sem a semântica formal: os contratos JSON representam os performativos, a linguagem natural representa as ontologias. Esta lição leva a sério a FIPA-ACL para que você possa ver quais decisões do protocolo 2026 são reinvenções, que são novidades, e onde a onda atual vai redescobrir problemas já resolvidos na década de 2000.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 01 (Why Multi-Agent)
**Time:** ~60 minutes

## Problemas

O cenário do protocolo de agentes para 2026 está ocupado: MCP para ferramentas, A2A para agentes, ACP para auditoria empresarial, ANP para confiança descentralizada, NLIP para conteúdo em língua natural, além de CA-MCP e duas dúzias de propostas de investigação.

A leitura honesta é que a maioria deles está redescobrindo uma árvore de decisão muito específica de vinte anos. A teoria do discurso-ato de Austin (1962) e Searle (1969) nos deu "expresões são ações". A FIPA-ACL (ratificada em 2000) produziu a normalização de referência: vinte performativos, linguagens de conteúdo SL0/SL1, protocolos de interação para a rede de contratos e subscrição-notificação. JADE e JACK foram as plataformas de referência Java. O esforço desvaneceu-se em torno de 2010 porque a ontologia sobrecarga era muito pesada e a web estava ganhando.

Quando olhamos para o MCPs`tools/call`O processo de criação de um novo sistema de gestão de dados é um processo de desenvolvimento de dados que permite a criação de um novo sistema de gestão de dados, que permite a criação de um novo sistema de gestão de dados, que permite a criação de um novo sistema de gestão de dados, que permite a criação de novos sistemas de gestão de dados, que permite a criação de novos sistemas de gestão de dados, que permitem a criação de novos sistemas de gestão de dados, que permitem a criação de novos sistemas de gestão de dados, que permitem a criação de novos sistemas de gestão de dados, que permitem a criação de novos sistemas de gestão de dados, que permitem a criação de novos sistemas de gestão de dados, que permitem a criação de novos sistemas de gestão de dados, que permitem a criação de novos sistemas de gestão de dados, que permitam a criação de novas tecnologias de gestão de dados e que permitem a criação de novas tecnologias de gestão de dados.

## Conceptos

### Acto de discurso, num parágrafo

Austin notou que algumas frases não descrevem o mundo, mas o mudam. "Prometho". "Pedito". "Declaro". Ele chamou estas declarações performativas. Searle formalizou cinco categorias: assertivo, diretivo, comissório, expressivo e declarativo. A KQML (Finin et al., 1993) tornou operacional para agentes de software: uma mensagem é um performativo (a ação) mais conteúdo (o que a ação é sobre). A FIPA-ACL limpou as lacunas da KQML e padronizou cerca de vinte performativos.

### Os vinte performativos da FIPA (lista parcial)

| Performative | Intent |
|---|---|
| `inform` | "I tell you P is true" |
| `request` | "I ask you to do X" |
| `query-if` | "Is P true?" |
| `query-ref` | "What is the value of X?" |
| `propose` | "I propose we do X" |
| `accept-proposal` | "I accept the proposal" |
| `reject-proposal` | "I reject the proposal" |
| `agree` | "I agree to do X" |
| `refuse` | "I refuse to do X" |
| `confirm` | "I confirm P is true" |
| `disconfirm` | "I deny P" |
| `not-understood` | "Your message did not parse" |
| `cfp` | "Call for proposals on X" |
| `subscribe` | "Notify me when X changes" |
| `cancel` | "Cancel the ongoing X" |
| `failure` | "I tried X and failed" |

A lista completa está aqui .`fipa00037.pdf`O ponto não é memorizá-lo. O ponto é que cada um deles corresponde a um protocolo primitivo que um LLM eventualmente adiciona novamente.

### Mensagem canónica FIPA-ACL

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

Sete campos contêm o envelope do protocolo; um campo (`content`O resto dos campos são exatamente o que você reinventa cada vez que você conecta retries, threading e ontologia em um protocolo JSON.

### As duas plataformas legais

**JADE**(Java Agent DEvelopment framework, 19992020s) foi o tempo de execução mais usado de conformidade com a FIPA. Agentes estenderam uma classe base, trocaram mensagens ACL, executaram dentro de contentores e coordenaram usando "comportamentos".

**JACK**(Software orientado para agentes, comercial) enfatizou o raciocínio BDI (Crédito-Desejo-Intenção) em cima das mensagens FIPA.

Ambos diminuíram quando a pilha de web comeu casos de uso de multi-agentes. MCP e A2A são os "containers" de tempo de execução de 2026.

### Por que a FIPA desapareceu

- **Ontology overhead.**A FIPA exigia uma ontologia compartilhada para análise `content`Concordar em ontologias é um processo de padrões de anos. A web acabou de usar HTTP + JSON.
- **Formal semantics nobody used.**SL (Linguagem Semântica) deu condições rigorosas de verdade, mas a maioria dos sistemas de produção usava conteúdo de forma livre e ignorava o formalismo.
- **Tooling lock-in.**O JADE era apenas para Java, o JACK era comercial.
- **The internet won the stack.**REST, depois JSON-RPC, então gRPC substituído transporte de ACL.

### O revival do LLM é FIPA-lite

Comparar uma FIPA `request`para um MCP `tools/call`- Não .

```
(request                                {
  :sender  agent1                         "jsonrpc": "2.0",
  :receiver tool-server                   "method":  "tools/call",
  :content "(lookup stock IBM)"           "params":  {"name":"lookup_stock",
  :ontology finance                                   "arguments":{"symbol":"IBM"}},
  :conversation-id c42                    "id": 42
)                                        }
```

O mesmo envelope, sintaxe diferente. Ambos carregam: quem, quem, intenção, carga útil, correlação id. Nem é uma revolução sobre o outro  eles são diferentes trade-offs no mesmo projeto.

A pesquisa de 2025 de Liu et al. ("A Survey of Agent Interoperability Protocols: MCP, ACP, A2A, ANP", arXiv:2505.02279) torna esta linhagem explícita: MCP corresponde a atos de fala de uso de ferramentas, A2A a atos de fala de agente-peer, ACP a atos de fala de auditoria-trail, ANP a extensões de identidade descentralizada. As novas especificações são descendentes do ACL com sintaxe JSON e semântica mais solta.

### A compensação, claramente declarada

**What FIPA gave you and modern specs drop:**

- Semântica formal  você pode provar `inform`implica que o remetente acredita no conteúdo.
- Um catálogo canônico de performativos  não é preciso re-argumentar "deveríamos ter um `cancel`" ? "
- Décadas de padrões de interação-protocolo  contrato-rede, assinar-notificar, propor-aceitar  com propriedades de corretão conhecidas.

**What modern specs give you and FIPA did not:**

- Cargas úteis nativas JSON compatíveis com todas as ferramentas modernas.
- Conteúdo em linguagem natural que os LLM possam interpretar sem ontologia codificada à mão.
- Transporte de pilha de web (HTTP, SSE, WebSocket).
- Descoberta de capacidade através de MCPs em directo `server/discover`E os cartões de agente A2A.

Semântica de intenções mais flexível para uma implementação mais fácil.

### Protocolos de interação que valham a pena ser portados

A FIPA enviou cerca de 15 protocolos de interação. Três vale a pena levar para os sistemas multi-agente LLM:

1. **Contract Net Protocol (CNP).**Questões de gerente `cfp`(convocatória de propostas); os licitantes respondem com `propose`• o gerente aceita/rechaça. Este é o padrão canônico do mercado de tarefas (fase 16 · 16 de negociação).
2. **Subscribe/Notify.**Assinador envia `subscribe`; editor envia `inform`É o que acontece em todos os eventos de 2026.
3. **Request-When.**"Faça X quando a condição Y é válida". Ação retardada com pré-condições. O analógico 2026 é tarefas diferidas em motores de fluxo de trabalho duradouros (Fase 16 · 22 Escalagem de Produção).

Cada mapa mostra limpa linha de mensagens modernas, pesquisas HTTP + ou streaming SSE.

### O que rompe quando você deixa cair a ontologia

Sem uma ontologia compartilhada, os agentes deduzem o significado a partir do conteúdo em linguagem natural.**semantic drift**: dois agentes usam a mesma palavra (`"customer"`O requerimento ontológico da FIPA teria rejeitado a mensagem no momento da análise.

Mitigations sem entrar em ontologia completa:

- JSON Schema em `content` rejeita erros estruturais no fio.
- Artefactos de tipo (A2A)  rejeita modalidade errada.
- O performativo explícito no envelope  torna a intenção inequívoca mesmo quando o conteúdo é linguagem natural.

### As especificações de 2026, mapeadas para o patrimônio de fala-ato

| Modern spec | FIPA analog | What it keeps | What it drops |
|---|---|---|---|
| MCP `tools/call` | `request` | explicit intent, correlation id | formal semantics, ontology |
| MCP `resources/read` | `query-ref` | explicit intent, correlation id | formal semantics |
| A2A Task lifecycle | contract-net + request-when | async lifecycle, state transitions | formal completeness guarantees |
| A2A streaming events | subscribe/notify | async push | typed-predicate subscription |
| CA-MCP shared context | blackboard (Hayes-Roth 1985) | multi-writer shared memory | logical consistency model |
| NLIP | natural-language content | LLM-native | schema |

Leindo a tabela de cima para baixo, o padrão é: manter a estrutura primitiva, deixar cair o formalismo, deixar LLMs papel sobre a ambigüidade.

```figure
sw-contract-net
```

## Construí-lo

`code/main.py`Implementa um tradutor FIPA-ACL de pure-stdlib. Ele codifica e decodifica o envelope ACL canônico e mostra como cada forma de mensagem MCP / A2A se reduz aos mesmos sete campos.

- Encode cinco mensagens de estilo MCP e A2A como FIPA-ACL.
- Decodifica a FIPA-ACL para o equivalente moderno.
- Executa um contrato de brinquedo Negociação de rede entre um gerente e três licitantes usando `cfp`- Não .`propose`- Não .`accept-proposal`- Não .`reject-proposal`- Não .

- Correr .

```
python3 code/main.py
npx tsx code/main.ts
```

A saída é um rastro lado a lado mostrando cada mensagem moderna em sua forma JSON 2026 e sua forma FIPA-ACL, em seguida, uma viagem de ida e volta de uma oferta de rede de contrato. Os mesmos protocolos primitivos sobrevivem à viagem de ida e volta; apenas a sintaxe difere.

## Usá-lo

`outputs/skill-fipa-mapper.md`É uma habilidade que lê qualquer especificação do protocolo de agente e produz o mapeamento FIPA-ACL.`inform`com a sintaxe JSON?"

## Envia-o

Não traga a FIPA-ACL de volta.

- Qual é a intenção primitiva (performativa) de cada mensagem?
- Existe uma identificação de correlação para a resposta-requisito e cancelamento?
- Existe uma linguagem de conteúdo explícito (JSON-RPC, texto simples, artefato de tipo estruturado)?
- Os protocolos de interação são de primeira classe, ou estão a reimplementar a rede de contratos a partir do zero?
- O que acontece quando dois agentes discordam sobre o significado do conteúdo (drift semântico)?

Documentar estas cinco perguntas para qualquer novo protocolo antes de enviá-lo para produção.

## Exercícios

1. Corra .`code/main.py`- Observar a codificação de ida e volta. Identificar qual o performativo da FIPA corresponde `tools/call`- Não .`resources/read`, e criação de tarefas A2A.
2. Extender a demonstração da rede de contratos com um `cancel`O que é que o gerente faz quando o problema é que o gerente não consegue fazer a tarefa?`cancel`Resolver essa retemporada sozinho não?
3. Leia a estrutura de mensagens da FIPA ACL (http://www.fipa.org/specs/fipa00037/) secções 4.14.3. Escolha um performativo não abrangido nesta lição e descreva o seu analogo JSON-RPC moderno.
4. Leia Liu et al., arXiv:2505.02279. Para cada um dos MCP, A2A, ACP, ANP, lista as famílias performativas FIPA que eles mantêm e deixam.
5. Desenhar um JSON-Schema mínimo para o `content`campo de uma `request`O que é que esse esquema dá que a linguagem natural pura não dá e quanto custa?

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Speech act | "An utterance that does something" | Austin/Searle: utterances as actions. The theoretical parent of ACL. |
| FIPA | "That old XML thing" | Foundation for Intelligent Physical Agents. Standardized ACL in 2000; became an IEEE Computer Society standards committee in 2005. |
| ACL | "Agent Communication Language" | FIPA's envelope format: performative + content + metadata. |
| Performative | "The verb" | The intent class of a message: `inform`, `request`, `propose`, `cfp`, etc. |
| KQML | "FIPA's predecessor" | Knowledge Query and Manipulation Language (1993). Simpler, narrower. |
| Ontology | "Shared vocabulary" | A formal definition of the concepts the content language talks about. |
| SL0 / SL1 | "FIPA content languages" | Semantic Language levels 0 and 1 — the formal content language family. |
| Contract Net | "Task market" | Manager issues cfp; bidders propose; manager accepts. The canonical interaction protocol. |
| Interaction protocol | "Pattern of messages" | A sequence of performatives with known correctness: request-when, subscribe-notify, etc. |

## Mais leitura

- [Liu et al. — A Survey of Agent Interoperability Protocols: MCP, ACP, A2A, ANP](https://arxiv.org/html/2505.02279v1) a pesquisa canónica de 2025 que liga as especificações modernas ao património da FIPA
- [FIPA ACL Message Structure Specification (fipa00037)](http://www.fipa.org/specs/fipa00037/) o formato do envelope de 2000 ratificado
- [FIPA Communicative Act Library Specification (fipa00037)](http://www.fipa.org/specs/fipa00037/) o catálogo completo de desempenho
- [MCP specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28) o equivalente atual de utilização de ferramentas sem estado de `request`- Não .`query-ref`
- [A2A specification](https://a2a-protocol.org/latest/specification/) o equivalente moderno de agente-peer de contrato-net e assinatura-notificação
