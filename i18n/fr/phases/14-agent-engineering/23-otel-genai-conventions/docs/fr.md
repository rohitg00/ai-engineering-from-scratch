# Conventions sémantiques de génération d'Aï OpenTelemetry

> Le génAI SIG d'OpenTelemetry (lancé en avril 2024) définit le schéma standard de télémétrie d'agent. Les noms de domaine, les attributs et les règles de capture de contenu convergent entre les fournisseurs, de sorte que les traces d'agent signifient la même chose dans Datadog, Grafana, Jaeger et Honeycomb.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 13 (LangGraph), Phase 14 · 24 (Observability Platforms)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Nommer les catégories de génération d'intervalle: modèle/client, agent, outil.
- Distinguer`invoke_agent`Les écarts de client versus internes et lorsque chacun s'applique.
- Liste des attributs de GenAI de premier niveau: nom du fournisseur, modèle de demande, identifiant de la source de données.
- Expliquer le contrat de capture de contenu: opt-in, `OTEL_SEMCONV_STABILITY_OPT_IN`, recommandation de référence externe.

## Le problème

Chaque fournisseur invente ses propres noms de champs. Les équipes d'opérations finissent par construire des tableaux de bord par cadre.

## Le concept

### Catégories de champs

1. **Model / client spans.**Couvrir les appels LLM bruts. émis par les SDK du fournisseur (Anthropic, OpenAI, Bedrock) et les adaptateurs de modèles de cadre.
2. **Agent spans.** `create_agent`(lorsque l'agent est construit) et `invoke_agent`(lorsqu'il fonctionne).
3. **Tool spans.**Un par invocation d'outil; connecté à l'espace d'agent par relation parent-enfant.

### Nom de l'agent

- Nom de l'espagnol: `invoke_agent {gen_ai.agent.name}`si nommé; retour à `invoke_agent`- Je suis désolé .
- Une espèce de spande:
  - **CLIENT** pour les services d'agents à distance (API OpenAI Assistants, Agents Bedrock).
  - **INTERNAL** pour les cadres d'agents en cours de processus (LangChain, CrewAI, local ReAct).

### Attributs clés

- `gen_ai.provider.name` `anthropic`- Je suis là .`openai`- Je suis là .`aws.bedrock`- Je suis là .`google.vertex`- Je suis désolé .
- `gen_ai.request.model` le modèle d'identification.
- `gen_ai.response.model` le modèle résolu (peut différer de la demande en raison du routage).
- `gen_ai.agent.name` Identifiant de l'agent.
- `gen_ai.operation.name` `chat`- Je suis là .`completion`- Je suis là .`invoke_agent`- Je suis là .`tool_call`- Je suis désolé .
- `gen_ai.data_source.id` pour les RAG: quel corpus ou magasin a été consulté.

Des conventions spécifiques à la technologie existent pour Anthropic, Azure AI Inference, AWS Bedrock, OpenAI.

### Capture de contenu

La règle par défaut: les instruments ne DEVENT PAS capturer les entrées/sorties par défaut.

- `gen_ai.system_instructions`
- `gen_ai.input.messages`
- `gen_ai.output.messages`

Le modèle de production recommandé: stocker le contenu à l'extérieur (S3, votre magasin de journaux), enregistrer les références sur les intervalles (identifiants de pointeur, pas de prose).

### Stabilité

La plupart des conventions sont expérimentales à partir de mars 2026.

```
OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental
```

Les cartes Datadog v1.37+ génAI attribue nativement dans son schéma d'observabilité LLM. D'autres backends (Grafana, Honeycomb, Jaeger) prennent en charge les attributs bruts.

### Où ce modèle va mal

- **Capturing full prompts in spans.**Les informations personnelles, les secrets, les données des clients dans des traces que les opérations peuvent lire.
- **No `gen_ai.provider.name`.**Les tableaux de bord multi-fournisseurs se cassent lorsque l'attribution est manquante.
- **Spans without parent links.**Les outils orphelins s'étendent, ils propagent toujours le contexte.
- **Not setting stability opt-in.**Vos attributs peuvent être renommés lors de la mise à niveau.

```figure
ae-genai-span-tree
```

## Faites-le

`code/main.py`met en œuvre un émetteur stdlib d'épanouissement correspondant aux conventions de GenAI:

- `Span`avec le schéma d'attribut GenAI.
- `Tracer`avec `start_span`, des contextes enlisés.
- Un agent scripté qui émet:`create_agent`- Je suis là .`invoke_agent`(INTERNAL), par outil,`chat`les cours de droit.
- Un mode de capture de contenu qui stocke les invites à l'extérieur et enregistre les identifiants sur les intervalles.

- Je vais le faire.

```
python3 code/main.py
npx tsx code/main.ts
```

Sortie: un arbre de débit avec tous les attributs GenAI requis, et un "marché externe" montrant les références de contenu opt-in.

## Utilisez-le

- **Datadog LLM Observability**(v1.37+) des attributs de cartes natifs.
- **Langfuse / Phoenix / Opik**(Létion 24)  auto-instrument de l'écosystème.
- **Jaeger / Honeycomb / Grafana Tempo** traces OTel brutes; construire des tableaux de bord à partir des attributs GenAI.
- **Self-hosted** exécuter le Collecteur OTel avec un processeur GenAI.

## La faire partir

`outputs/skill-otel-genai.md`Les fils OTel GenAI s'étendent sur un agent existant avec des défauts de capture de contenu et de stockage de référence externe.

## Exercices

1. Instruisez votre leçon 01 ReAct loop avec `invoke_agent`(INTERNAL) + spans par outil. Envoyez à une instance Jaeger.
2. Ajouter la capture de contenu en mode "références seulement": les requêtes à SQLite, les attributs de durée ne comportent que des identifiants de rangée.
3. Lisez la spécification pour `gen_ai.data_source.id`- Envoyez-le dans votre recherche de leçon 9.
4. Réglage `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental`et vérifier que vos attributs ne sont pas renommés par le collectionneur.
5. Construire un tableau de bord: "quelles erreurs d'outil corrélataient avec quels modèles" à partir des attributs GenAI seulement.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| GenAI SIG | "OpenTelemetry GenAI group" | OTel working group defining the schema |
| invoke_agent | "Agent span" | Name of the span representing an agent run |
| CLIENT span | "Remote call" | Span for a call to a remote agent service |
| INTERNAL span | "In-process" | Span for an in-process agent run |
| gen_ai.provider.name | "Provider" | anthropic / openai / aws.bedrock / google.vertex |
| gen_ai.data_source.id | "RAG source" | Which corpus/store a retrieval hit |
| Content capture | "Prompt logging" | Opt-in capture of messages; store externally in prod |
| Stability opt-in | "Preview mode" | Env var to pin experimental conventions |

## Pour en savoir plus

- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) la spécification
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) Généraux par défaut
- [AutoGen v0.4 (Microsoft Research)](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) Des espaces OTel intégrés
- [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview) Propagation du contexte de trace W3C
