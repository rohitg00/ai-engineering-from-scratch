# Modèles d'orchestration: superviseur, groupe, hiérarchique

> Quatre modèles d'orchestration se reproduisent dans les cadres 2026: supervisor-worker, swarm / peer-to-peer, hiérarchique, débat.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 12 (Workflow Patterns), Phase 14 · 25 (Multi-Agent Debate)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Nombrez les quatre modèles d'orchestration récurrents et le moment où chacun s'adapte.
- Décrivez la recommandation LangChain 2026: supervision basée sur des appels outils contre des bibliothèques de superviseurs.
- Expliquez la règle de "construire le bon système" d'Anthropic et comment elle empêche le choix de la topologie.
- Mettre en œuvre les quatre en stdlib contre un LLM écrit commun.

## Le problème

Les équipes cherchent "multi-agent" avant de l'avoir besoin. Quatre modèles se reproduisent dans les cadres; une fois que vous pouvez les nommer, vous pouvez choisir le bon  ou sauter la topologie entièrement.

## Le concept

### Travailleur-surveillant

- Un programme de gestion de la gestion des risques est envoyé à des agents spécialisés.
- Il décide: retourner à lui-même, remettre à un spécialiste, mettre fin.
- Les spécialistes ne parlent pas entre eux; tout le routage passe par le superviseur.

Cadres: LangGraph `create_supervisor`, les ouvriers de l'orchestre anthropologique, le processus hiérarchique de l'équipage.

**2026 LangChain recommendation:**faire la surveillance par des appels directs aux outils plutôt que `create_supervisor`- vous décidez exactement ce que chaque spécialiste voit.

### Les groupes de personnes

- Les agents se détachent directement sur une surface d'outils partagée.
- Pas de routeur central.
- Réduction de la latence par rapport à celle du superviseur (moins de sauts).
- Plus difficile à raisonner sur (pas de point de contrôle unique).

Cadres: topologie de swarm LangGraph, délivrance SDK OpenAI Agents (lorsque tous les agents peuvent délivrer à tous les autres).

### La hiérarchie

- Superviseurs gérant sous-superviseurs gérant les travailleurs.
- Implémenté en tant que sous-graphes encastrés dans LangGraph; équipages encastrés dans CrewAI.
- Équelles à des populations d'agents de grande taille au coût de la complexité opérationnelle.

Lorsque vous en avez besoin: lorsque le budget contextuel d'un seul superviseur ne peut contenir des descriptions de tous les spécialistes.

### Débat

- Propositions parallèles + critique croisée itérative (leçon 25).
- Pas vraiment orchestration  plus de vérification  mais apparaît comme un choix de topologie dans les cadres.

### Les équipages autonomes et les flux déterministes

CrewAI forme deux modes de déploiement:

- **Flow**pour l'automatisation déterministe basée sur des événements (point de départ recommandé pour la production).
- **Crew**pour une collaboration autonome fondée sur les rôles.

Ceci est orthogonal aux quatre modèles ci-dessus mais correspond à la topologie: Flow est généralement supervisor ou hiérarchique; Crew est généralement supervisor avec un routeur LLM.

### Les conseils de l'anthropique

" Le succès dans le domaine de la maîtrise de la loi ne consiste pas à construire le système le plus sophistiqué, mais à construire le système approprié pour vos besoins. "

Règlement de décision:

1. Un agent unique + des modèles de flux de travail (leçon 12)  commencent ici.
2. - le personnel de supervision  lorsque vous avez 2 à 4 spécialistes.
3. Swarm  quand la latence compte plus que la clarté du raisonnement.
4. Hiérarchique  seulement lorsque le budget de l'autorité de surveillance échoue.
5. Débat lorsque l'exactitude importe plus que le coût.

### Où ce modèle va mal

- **Topology-first thinking.**"Nous avons besoin de multi-agent" avant d'identifier le problème que le multi-agent résolve.
- **Bouncing handoffs in swarm.**A -> B -> A -> B. Utilisez des compteurs de sauterelles.
- **Fake hierarchy.**Trois couches parce que "entreprise"; deux équipes réelles.

```figure
orchestration-pattern
```

## Faites-le

`code/main.py`met en œuvre les quatre modèles dans stdlib contre un LLM écrit:

- `Supervisor`- Le routeur central.
- `Swarm` Peer-to-peer avec des remises directes.
- `Hierarchical` les superviseurs des superviseurs.
- `Debate` propositions parallèles + critique.

Chaque modèle gère la même tâche à trois intentions (revers / bug / vente).

- Je vais le faire.

```
python3 code/main.py
npx tsx code/main.ts
```

Résultats: trace par modèle + nombre d'options. Supervisor est le plus propre; swarm est le plus court; hiérarchique est le plus profond; débat est le plus coûteux.

## Utilisez-le

- **LangGraph**pour les sous-graphes supervisants et hiérarchiques (subgraphes en nid).
- **OpenAI Agents SDK**pour les remises en tant qu'outils (en forme de superviseur).
- **CrewAI Flow**pour la détermination de la production.
- **Custom**Pour le débat ou quand vous voulez le contrôle exact.

## La faire partir

`outputs/skill-orchestration-picker.md`choisit une topologie et la met en œuvre.

## Exercices

1. Convertir un superviseur en essaim en enlevant le routeur.
2. Ajoutez un compteur de saut au swarm: rejet après 3 remises.
3. Construire un système hiérarchique à deux niveaux pour un domaine spécialisé de 12 spécialistes.
4. Profiliser les quatre modèles sur une charge de travail en forme de production.
5. Lisez le post " Construire des agents efficaces " de Anthropic.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Supervisor-worker | "Router + specialists" | Central LLM dispatches to specialists; they don't talk to each other |
| Swarm | "Peer-to-peer" | Direct handoffs via shared tools; no central router |
| Hierarchical | "Supervisors of supervisors" | Nested subgraphs for large populations |
| Debate | "Proposer + critique" | Parallel proposers, cross-critique (Lesson 25) |
| Tool-call-based supervision | "Supervisor without a library" | Implement supervisor as direct tool calls for context control |
| Crew | "Autonomous team" | CrewAI's role-based collaboration mode |
| Flow | "Deterministic workflow" | CrewAI's event-driven production mode |

## Pour en savoir plus

- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) cinq modèles + agent vs flux de travail
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) superviseur, essaim, hiérarchique
- [CrewAI docs](https://docs.crewai.com/en/introduction) équipage contre flux
- [Du et al., Society of Minds (arXiv:2305.14325)](https://arxiv.org/abs/2305.14325) Modèle de débat
