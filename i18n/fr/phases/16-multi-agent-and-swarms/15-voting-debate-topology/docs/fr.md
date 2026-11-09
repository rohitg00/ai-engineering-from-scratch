# Le vote, l'auto-cohérence et la topologie du débat

> L'agrégation la moins chère: échantillon N d'agents indépendants, majorité-vot. Wang et coll. 2022 auto-consistance a fait cela avec un modèle échantillonné N fois.**heterogeneous**Les agents pour échapper à la monoculture  différents modèles, différents signaux, différentes températures, différents contextes. Au-delà du vote majoritaire, le débat sur la topologie est important: MultiAgentBench (arXiv:2503.01935, ACL 2025) a évalué la coordination étoile / chaîne / arbre / graphique et a trouvé **graph best for research**AgentVerse (ICLR 2024) documente deux modèles émergents  comportements volontaires et comportements de conformité  et la conformité est à la fois une caractéristique (trouver un consensus) et un risque (pensée de groupe, leçon 24).

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 07 (Society of Mind and Debate), Phase 16 · 14 (Consensus and BFT)
**Time:** ~75 minutes

## Problème

Le débat peut améliorer la précision (Du et al., arXiv:2305.14325). Il peut également la dégrader.

1. Qui parle à qui (topologie).
2. Combien de tours (Du 2023: les tours et les agents comptent indépendamment).
3. Si les agents sont hétérogènes (les différents modèles de base brisent la monoculture).
4. Si une voix d'adversaire est présente (stain-manning vs. paille-manning).

Les équipes qui "exécuter 5 agents et voter" sur une tâche sont souvent régressés par rapport à un seul agent. Les échecs ne sont pas aléatoires. Ils suivent la topologie et l'hétérogénéité. Cette leçon est la carte topologique.

## Concept

### Autosatisfaction, ligne de base pour un modèle unique

Wang et coll. 2022 (" L'auto-cohérence améliore la chaîne de raisonnement de la pensée ") ont échantillonné le même modèle N fois à une température > 0 et voté majoritairement sur les réponses de la voie de raisonnement. Le résultat sur GSM8K: des gains substantiels avec N = 40 échantillons sur un seul décode avide. L'auto-cohérence est le précurseur de l'agent unique au vote multi-agent.

Limit: l'auto-cohérence utilise un modèle de base. Les erreurs sont corrélatives par construction. Si le modèle a un biais systématique, tous les échantillons N le partagent.

### Le vote multi-agents, l'extension hétérogène

Remplacez les échantillons N par des agents N * différents * différents. Modèles de base différents (Claude, GPT, Llama), différentes instructions, accès à des outils différents. L'avantage: erreurs non corrélatives. Coût: différents agents coûtent des montants différents; leur coordination ajoute des frais généraux.

Le nom canonique de 2026 pour le débat hétérogène est **A-HMAD** Débat hétérogène multi-agent adversaire. Pas universellement adopté, mais les articles utilisent le terme pour "débat sur différents modèles, ce qui réduit les erreurs corrélatives de l'effondrement de la monoculture".

### Les quatre topologies

```
star                chain               tree                graph

    ┌─A─┐           A─B─C─D         ┌──A──┐              A───B
    │   │                           │     │              │ × │
    B   C                           B     C              D───C
    │   │                          / \   / \
    D   E                         D   E F   G           (fully connected)
```

Une étoile: un hub, les autres ne parlent qu'à un hub.
Chaîne: linéaire, chaque agent voit la sortie de l'autre.
Arbre: hiérarchique, utilisé par les systèmes d'agents hiérarchiques (leçon 06).
Graphique: tout à tout. Inclut une clique entièrement connectée et des DAG arbitraires.

### La taxe de coordination (Bénéfice multi-agent)

MultiAgentBench (MARBLE, ACL 2025, arXiv:2503.01935) a comparé l'étoile, la chaîne, l'arbre, le graphique sur une suite de tâches comprenant la recherche, le codage et la planification.

- **Graph**La topologie gagne sur les tâches de recherche.
- **Star**Les résultats obtenus par les tests de recherche sont les suivants:
- **Chain**les gains sur les pipelines étape par étape (réfinition progressive).
- **Coordination tax**Le coût des montres et des jetons augmente plus vite que la qualité.

Le plafond de 4 agents est empirique, pas fondamental. Il reflète la capacité de contexte du LLM 2026: le contexte de chaque agent se remplit de résultats de pairs, et la valeur marginale de l'agent N + 1 additionnel diminue une fois que tout le monde peut voir tout le monde.

### Stratégies de débat multi-agents (" Devrions-nous devenir fous ? ")

ArXiv:2311.17371 est l'enquête de 2023 sur les stratégies MAD. Les principales conclusions reproduites par d'autres: les variantes MAD qui sont * structurellement similaires* à l'auto-cohérence (échantillonnage indépendant + aggregation) ont souvent un rendement inférieur à l'auto-cohérence lors de l'utilisation du même budget.

### Les modèles émergents

Le projet de loi de l'Union européenne sur les droits de l'hommehttps://proceedings.iclr.cc/paper_files/paper/2024/file/578e65cdee35d00c708d4c64bce32971-Paper-Conference.pdf) documentent deux comportements qui émergent du débat multi-agents même sans conception explicite:

- **Volunteer.**Un agent offre de l'aide ("Je peux faire la prochaine étape") sans être prévenu.
- **Conformity.**Un agent ajuste sa position pour s'adapter à un critique, même si le critique a tort.

La conformité est la raison pour laquelle le débat jusqu'à l'accord récompense les intimidateurs.

### Hétérogénéité: le bouton réel qui déplace la précision

Un schéma 2024-2026 dans la littérature pratique: échanger un de vos agents N pour un modèle de base différent donne une augmentation de précision plus grande que d'augmenter N par 1. L'intuition est monoculture  chaque nouvelle source d'erreur indépendante vaut plus qu'un échantillon corrélateur supplémentaire.

Dans la limite, l'hétérogénéité bat la numerité.

### Méthodes du jury

Le cadre Sibyl (cité dans la littérature Minsky-LLM) formalite un " jury "  un petit ensemble d'agents spécialisés qui affinent les réponses en votant à chaque étape. Contrairement au vote à la majorité ordinaire, un jury a des rôles: un agent interroge, un fournit le contexte, un marque la plausibilité. Les méthodes du jury sont un point intermédiaire entre le vote ordinaire (bon marché, enclin à la monoculture) et le MAD complet (bon marché, enclin à la conformité).

### Lorsque le vote avec débat domine

- La question a une vérité fondamentale (facts, mathématiques, comportement de code).
- Les agents peuvent accéder à différentes sources ou outils (l'hétérogénéité est disponible).
- Les tours sont délimités (2-3 typiquement) et il y a un juge ou un vérificateur séparé.
- Le budget permet de 3 à 5 agents. Au-delà de 5 à 7 sur la topologie graphique, l'impôt de coordination domine.

### Quand le vote avec le débat fait mal

- Les agents convergent pour trouver la réponse la plus sûre, pas la plus correcte.
- Tous les agents partagent un modèle de base.
- Les tours sont illimités, la conformité gagne à chaque fois.
- La tâche est simple: un agent unique avec une cohérence à N = 5 est moins cher et aussi précis.

```figure
sw-debate-topology
```

## Faites-le

`code/main.py`les implémentations:

- `run_star(agents, hub, question)` Les sondages de chaque travailleur, les agrégats.
- `run_chain(agents, question)` raffinement séquentiel.
- `run_tree(root, children, question)` hiérarchique avec aggregation de profondeur-2.
- `run_graph(agents, question, rounds)`- Débat général, coups limités.
- Un cadran d' hétérogénéité scripté: chaque agent a un `error_bias`indiquant son erreur systématique.
- Une corde de mesure qui exécute chaque topologie à N=3, 5, 7 et rapporte (exactitude, total_tokens, wallclock_simulated).

Je vais courir .

```
python3 code/main.py
npx tsx code/main.ts
```

Expérience attendue: table de topologie × N → (exactitude, jetons, latence). Graphique gagne à N=3-5 sur les tâches de recherche; étoile gagne sur les tâches factuelles rapides; graphique à N=7 montre la taxe de coordination (la latence gonfle plus vite que la précision).

## Utilisez-le

`outputs/skill-topology-picker.md`est une compétence qui lit une description de tâche et recommande une topologie (étoile / chaîne / arbre / graphique), un N (nombre d'agents), un profil d'hétérogénéité (modèles de base à utiliser) et une ligne ronde.

## La faire partir

Pour tout ensemble:

- Commencez par **self-consistency at N=5**Il est le modèle de base bon marché.
- Mettre à jour à **heterogeneous voting at N=3**Si la précision est importante, mesurez le delta.
- Ne pas passer à **debate topology**si la tâche est structurée (recherche, plusieurs étapes) et que des tours limités sont faisables.
- Si une minorité a toujours raison, vous avez un signal de diversité.
- "Mieux précis à 10 fois le coût" est une décision commerciale.

## Exercices

1. On court .`code/main.py`. Tracer la courbe de coordination-taxe pour la topologie du graphique: précision vs N, jetons vs N. À quel N la courbe s'inflecte?
2. Comment la base de préjugés identique se compare-t-elle à la base de préjugés de l'attaque de monoculture de la leçon 14 ?
3. Ajouter un rôle de "juger" à la topologie du graphique qui ne vote pas, mais marque seulement le consensus final.
4. Lisez le document AgentVerse (ICLR 2024). Identifiez quel comportement émergent votre mise en œuvre présente le plus fortement. Pouvez-vous attirer le comportement opposé par un changement rapide?
5. Lisez MultiAgentBench (arXiv:2503.01935) Section 4 (expériences topologiques).

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Self-consistency | "Sample N times, vote" | Wang 2022. Single model, N temperature>0 samples, majority vote on reasoning paths. |
| Heterogeneity | "Different models" | Ensemble of different base models or prompt families. Breaks monoculture. |
| MAD | "Multi-agent debate" | Generic term for agents exchanging critiques over rounds. See Du 2023. |
| A-HMAD | "Adversarial Heterogeneous MAD" | MAD variant emphasizing different models + adversarial structure. |
| Topology | "Who talks to whom" | Star, chain, tree, graph. Determines information flow. |
| Coordination tax | "Diminishing returns" | Above ~4 agents on graph, cost grows faster than quality. |
| Volunteer behavior | "Unprompted help" | AgentVerse emergent pattern: an agent offers to take a step. |
| Conformity behavior | "Agreement under pressure" | AgentVerse emergent pattern: an agent aligns with a critic. |
| Jury | "Small specialized panel" | Sibyl-style ensemble with roles (examiner, context, scorer). |

## Pour en savoir plus

- [Wang et al. — Self-Consistency Improves Chain of Thought Reasoning](https://arxiv.org/abs/2203.11171) L'indice de base pour un modèle unique
- [Du et al. — Improving Factuality and Reasoning via Multiagent Debate](https://arxiv.org/abs/2305.14325) Les deux agents et les tours sont indépendants
- [MultiAgentBench / MARBLE](https://arxiv.org/abs/2503.01935) référence de topologie montrant le graphique le mieux adapté à la recherche, chaîne pour les pipelines
- [Should we be going MAD?](https://arxiv.org/abs/2311.17371) Enquête sur la stratégie MAD; découvre que la MAD perd souvent à cause de l'auto-cohérence à un budget égal
- [AgentVerse (ICLR 2024)](https://proceedings.iclr.cc/paper_files/paper/2024/file/578e65cdee35d00c708d4c64bce32971-Paper-Conference.pdf) modèles émergents de volontariat et de conformité
- [MARBLE repo](https://github.com/ulab-uiuc/MARBLE) mise en œuvre des indices de référence
