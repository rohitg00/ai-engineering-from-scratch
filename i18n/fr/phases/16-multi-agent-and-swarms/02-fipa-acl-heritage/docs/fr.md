# L'héritage des lois FIPA-ACL et du discours

> Avant MCP, avant A2A, il y avait FIPA-ACL. En 2000, la Fondation pour les agents physiques intelligents (FIPA, devenue un comité de normes de la Société informatique IEEE en 2005) a ratifié un langage de communication d'agent avec vingt performatifs, deux langages de contenu et un ensemble de protocoles d'interaction  contrat net, abonnement / notification, demande-quand. Il a disparu de l'industrie parce que les coûts généraux ontologiques étaient trop lourds pour le Web, mais le réveil LLM des systèmes multi-agents réimplemente tranquillement les mêmes idées sans la sémantique formelle: les contrats JSON représentent les performatifs, le langage naturel représente les ontologies. Cette leçon prend au sérieux la FIPA-ACL pour que vous puissiez voir quelles décisions du protocole 2026 sont réinventées, quelles sont les nouveautés, et où la vague actuelle va redécouvrir les problèmes déjà résolus dans les années 2000.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 01 (Why Multi-Agent)
**Time:** ~60 minutes

## Problème

Le paysage du protocole d'agent 2026 est occupé: MCP pour les outils, A2A pour les agents, ACP pour l'audit des entreprises, ANP pour la confiance décentralisée, NLIP pour le contenu en langage naturel, plus CA-MCP et deux douzaines de propositions de recherche.

La lecture honnête est que la plupart d'entre eux redécouvrent un arbre de décision très spécifique de vingt ans. La théorie des actes de discours d'Austin (1962) et de Searle (1969) nous a donné " les déclarations sont des actions. " KQML (1993) a transformé cela en un protocole de câble. FIPA-ACL (ratifié en 2000) a produit la normalisation de référence: vingt performatives, langages de contenu SL0/SL1, protocoles d'interaction pour le réseau de contrat et les abonnés-notifiants. JADE et JACK étaient les plateformes de référence Java. L'effort s'est évanoui vers 2010 parce que les coûts ontologiques étaient trop lourds et que le web gagnait.

Quand vous regardez MCP `tools/call`En effet, les données de référence de la FIPA sont les données de référence de la CA-MCP, et elles sont les données de référence de la CA-MCP.

## Concept

### Actes de discours, en un paragraphe

Austin a remarqué que certaines phrases ne décrivent pas le monde, mais le changent. "Je promets. " "Je demande. " "Je déclare". Il appelait ces déclarations performatives. Searle a formalisé cinq catégories: affirmative, directive, commissaire, expressive et déclarative. KQML (Finin et coll., 1993) a rendu cela opérationnel pour les agents logiciels: un message est un performatif (l'action) plus un contenu (de quoi l'action parle). FIPA-ACL a nettoyé les lacunes de KQML et standardisé environ vingt performatives.

### Les vingt performances de la FIPA (liste partielle)

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

La liste complète est disponible `fipa00037.pdf`Le point est que chacun d'eux correspond à un protocole primitif qu'un LLM ajoute finalement.

### Message canonique FIPA-ACL

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

Sept champs contiennent l'enveloppe du protocole; un champ (`content`Le reste des champs sont exactement ce que vous réinventez chaque fois que vous renforcez les essais, le fillage et l'ontologie sur un protocole JSON.

### Les deux plates-formes héritées

**JADE**(Java Agent DEvelopment framework, 19992020s) était le temps d'exécution le plus utilisé conforme à la FIPA. Les agents ont étendu une classe de base, échangé des messages ACL, exécuté à l'intérieur des conteneurs et coordonné en utilisant des "comportements".

**JACK**(Software orienté vers les agents, commercial) a mis l'accent sur le raisonnement BDI (Crédition-Desei-Intention) en plus des messages FIPA.

Les deux ont diminué une fois que la pile Web a mangé des cas d'utilisation multi-agents.

### Pourquoi la FIPA a disparu

- **Ontology overhead.**La FIPA a exigé une ontologie partagée pour analyser `content`L'accord sur les ontologies est un processus de normes de plusieurs années.
- **Formal semantics nobody used.**SL (langue sémantique) a donné des conditions de vérité rigoureuses, mais la plupart des systèmes de production utilisaient du contenu sous forme libre et ignoraient le formalisme.
- **Tooling lock-in.**JADE était uniquement en Java, Jack était commercial.
- **The internet won the stack.**REST, puis JSON-RPC, puis gRPC a remplacé le transport de l'ACL.

### Le renouveau de la LLM est FIPA-lite

Comparer une FIPA `request`à un PCM `tools/call`- Le numéro de la liste:

```
(request                                {
  :sender  agent1                         "jsonrpc": "2.0",
  :receiver tool-server                   "method":  "tools/call",
  :content "(lookup stock IBM)"           "params":  {"name":"lookup_stock",
  :ontology finance                                   "arguments":{"symbol":"IBM"}},
  :conversation-id c42                    "id": 42
)                                        }
```

La même enveloppe, syntaxe différente. Les deux portent: qui, qui, intention, charge utile, identité de corrélation.

L'enquête de 2025 de Liu et coll. ("A Survey of Agent Interoperability Protocols: MCP, ACP, A2A, ANP", arXiv:2505.02279) rend cette lignée explicite: MCP correspond aux actes de parole utilisés par les outils, A2A aux actes de parole par les agents, ACP aux actes de parole auditifs, ANP aux extensions d'identité décentralisée.

### Le compromis, clairement déclaré

**What FIPA gave you and modern specs drop:**

- La sémantique formelle, vous pouvez la prouver.`inform`implique que l'expéditeur croit au contenu.
- Un catalogue canonique des performatifs  vous n'avez pas à réaffirmer "nous devrions avoir un `cancel`Je suis là.
- Décennie de modèles d'interaction-protocole  contract-net, abonnez-notifiez, proposez-acceptez  avec des propriétés de précision connues.

**What modern specs give you and FIPA did not:**

- Charges utiles natives JSON compatibles avec tous les outils modernes.
- Contenu en langage naturel que les LLM peuvent interpréter sans ontologie codée à la main.
- Le transport par pile Web (HTTP, SSE, WebSocket).
- Découverte des capacités via MCP en direct `server/discover`et les cartes d'agent A2A.

Une sémantique plus flexible pour une mise en œuvre plus facile.

### Protocoles d'interaction qui valent la peine d'être portés

FIPA a envoyé ~ 15 protocoles d'interaction.

1. **Contract Net Protocol (CNP).**Problèmes de gestion `cfp`(appel à propositions); les soumissionnaires répondent par `propose`Le processus de négociation est le plus souvent utilisé pour les négociations.
2. **Subscribe/Notify.**L' abonné envoie `subscribe`; l' éditeur envoie `inform`C'est chaque bus d'événements en 2026.
3. **Request-When.**"Faire X lorsque la condition Y est valide". Action retardée avec des préconditions.

Chaque carte est propre sur les files d'attente de messages modernes, les sondages HTTP + ou le streaming SSE.

### Ce qui se brise quand on laisse tomber l'ontologie

Sans ontologie partagée, les agents déduisent le sens du contenu du langage naturel.**semantic drift**: deux agents utilisent le même mot (`"customer"`En effet, les données de l'analyse de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur

L'atténuation sans avoir recours à l'ontologie complète:

- Schéma JSON sur `content` rejette les erreurs structurelles du fil.
- Les objets de type (A2A)  rejettent la mauvaise modalité.
- Le performatif explicite dans l'enveloppe  rend l'intention sans ambiguïté même lorsque le contenu est un langage naturel.

### Les spécifications 2026 correspondant au patrimoine de l'acte de la parole

| Modern spec | FIPA analog | What it keeps | What it drops |
|---|---|---|---|
| MCP `tools/call` | `request` | explicit intent, correlation id | formal semantics, ontology |
| MCP `resources/read` | `query-ref` | explicit intent, correlation id | formal semantics |
| A2A Task lifecycle | contract-net + request-when | async lifecycle, state transitions | formal completeness guarantees |
| A2A streaming events | subscribe/notify | async push | typed-predicate subscription |
| CA-MCP shared context | blackboard (Hayes-Roth 1985) | multi-writer shared memory | logical consistency model |
| NLIP | natural-language content | LLM-native | schema |

En lisant le tableau de haut en bas, le modèle est: conservez la structure primitive, abandonnez le formalisme, laissez les LLM traiter l'ambiguïté.

```figure
sw-contract-net
```

## Faites-le

`code/main.py`Il décode et décode l'enveloppe ACL canonique et montre comment chaque forme de message MCP / A2A se réduit aux mêmes sept champs.

- Encode cinq messages de type MCP et A2A en FIPA-ACL.
- Décode FIPA-ACL à l'équivalent moderne.
- Fonctionne dans un contrat de jouet négociation net entre un gestionnaire et trois soumissionnaires en utilisant `cfp`- Je suis là .`propose`- Je suis là .`accept-proposal`- Je suis là .`reject-proposal`- Je suis désolé .

Je vais courir .

```
python3 code/main.py
npx tsx code/main.ts
```

La sortie est une trace côte à côte montrant chaque message moderne dans sa forme JSON 2026 et sa forme FIPA-ACL, puis un aller-retour d'une offre de réseau de contrat.

## Utilisez-le

`outputs/skill-fipa-mapper.md`Il est également possible de lire les spécifications du protocole d'agent et de produire le cartographie FIPA-ACL.`inform`avec la syntaxe JSON ? "

## La faire partir

Ne ramenez pas la FIPA-ACL, ramenez sa liste de contrôle:

- Quelle est l'intention primitive (performative) de chaque message?
- Y a-t-il une identification de corrélation pour la réponse à la demande et l'annulation ?
- Y a-t-il un langage de contenu explicite (JSON-RPC, texte simple, artifact de type structuré)?
- Les protocoles d'interaction sont-ils de première classe, ou vous réimplémenterez le réseau de contrat à partir de zéro ?
- Que se passe-t-il lorsque deux agents ne sont pas d'accord sur la signification du contenu (drift sémantique)?

Documentez ces cinq questions pour tout nouveau protocole avant de le mettre en production.

## Exercices

1. On court .`code/main.py`- Observer le codage aller-retour. Identifier le performatif FIPA correspondant à `tools/call`- Je suis là .`resources/read`, et la création de tâches A2A.
2. Extension de la démo du réseau de contrat avec un `cancel`Le système de gestion de l'entreprise est un système performatif qui permet au gestionnaire de retirer la tâche à mi-chemin.`cancel`Vous ne résolvez pas ça par vous-même ?
3. Lire la structure des messages ACL de la FIPA (http://www.fipa.org/specs/fipa00037/) sections 4.14.3. Choisissez un performatif non couvert dans cette leçon et décrivez son analogique JSON-RPC moderne.
4. Lisez Liu et coll., arXiv:2505.02279. Pour chacune des MCP, A2A, ACP, ANP, énumérez les familles performatives FIPA qu'elles conservent et déposent.
5. Conceptez un schéma JSON minimal pour le `content`champ d' un `request`Ce schéma vous donne quoi que le langage naturel pur ne donne pas, et combien ça coûte ?

## Les termes clés

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

## Pour en savoir plus

- [Liu et al. — A Survey of Agent Interoperability Protocols: MCP, ACP, A2A, ANP](https://arxiv.org/html/2505.02279v1) l'enquête canonique de 2025 reliant les spécifications modernes au patrimoine de la FIPA
- [FIPA ACL Message Structure Specification (fipa00037)](http://www.fipa.org/specs/fipa00037/) le format de l'enveloppe 2000 ratifié
- [FIPA Communicative Act Library Specification (fipa00037)](http://www.fipa.org/specs/fipa00037/) le catalogue performatif complet
- [MCP specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28) l'équivalent actuel d'utilisation des outils sans état de `request`- Je suis là.`query-ref`
- [A2A specification](https://a2a-protocol.org/latest/specification/) l'équivalent moderne de l'agent-peer de la réseau de contrat et de l'abonnement-notification
