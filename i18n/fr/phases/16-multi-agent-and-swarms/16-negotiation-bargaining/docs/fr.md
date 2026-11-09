# Les négociations et les négociations

> Les agents négocient des ressources, des prix, des affectations de tâches et des conditions. L'ensemble de référence de 2026 est clair: NegotiationArena (arXiv:2402.05863) montre que les LLM peuvent améliorer les paiements de ~20% via la manipulation de la personnalité ("désespoir"); " Mesurer les capacités de négociation " (arXiv:2402.15813) montre que l'acheteur est plus difficile que le vendeur et que l'échelle ne les aide pas  leur**OG-Narrator**(Générateur d'offres déterministes + narrator de LLM) a poussé le taux de négociation de 26,67% à 88,88%; la grande compétition de négociation autonome (arXiv:2503.06416) a mené environ 180 000 négociations et a constaté que**chain-of-thought-concealing**Les agents gagnent en cachant le raisonnement des homologues; Bhattacharya et coll. 2025 sur les métriques du projet de négociation de Harvard classé Llama-3 le plus efficace, Claude-3 le plus agressif, GPT-4 le plus juste. Cette leçon met en œuvre le protocole de réseau de contrat (l'ancêtre de la FIPA, leçon 02), câble un acheteur / vendeur de style LLM, exécute une décomposition de style OG-Narrateur et mesure comment le taux de transaction change avec chaque choix structurel.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 02 (FIPA-ACL Heritage), Phase 16 · 09 (Parallel Swarm Networks)
**Time:** ~75 minutes

## Problème

Les deux agents doivent s'entendre sur un prix. Laissant à eux-mêmes des indications purement linguistiques, les LLM 2024-2026 concluront des transactions à des taux étonnamment bas (~ 27% sur des offres strictement paramétrisées dans arXiv:2402.15813).

Le problème principal est que les LLM confondent deux emplois  décider de l'offre et de raconter l'offre. OG-Narrateur les a séparés: un générateur d'offres déterministe compute les mouvements numériques; le LLM ne raconte que. Le taux de transaction augmente à ~89%.

Ce qui reflète une conclusion classique multi-agent: découpler le mécanisme de la couche de communication gagne. Le protocole de réseau de contrat (FIPA, 1996; Smith, 1980) est le mécanisme de référence du marché des tâches.

## Concept

### Réseau de contrat, en un seul paragraphe

Le protocole de 1980 de Smith sur le réseau des contrats: a **manager**diffuse une **call for proposals (cfp)**- le président .**bidders**répondez avec **propose**messages contenant leurs offres; le gestionnaire choisit un gagnant et envoie **accept-proposal**au gagnant et **reject-proposal**Le gagnant fait le travail.**refuse**L' FIPA a codifié cette proposition comme:`fipa-contract-net`protocole d'interaction.

### Pourquoi OG-Narrateur gagne

"Mesurer les capacités de négociation des modèles linguistiques" (arXiv:2402.15813) a observé que:

- Les LLM enfreignent souvent les règles de négociation (offre à des prix absurdes, ignorez les ZOPA de l'autre partie).
- Ils s'ancrent mal (acceptent de mauvaises offres d'abord; contre-offres à des montants symboliques plutôt que stratégiques).
- Les modèles plus grands rendent le langage plus plausible avec une erreur stratégique similaire.

La décomposition du narrateur:

```
           ┌──────────────────┐        ┌──────────────────┐
  state  → │ offer generator  │ price → │  LLM narrator    │ → message
           │  (deterministic) │        │  (writes the     │
           │                  │        │   human-style    │
           └──────────────────┘        │   accompaniment) │
                                       └──────────────────┘
```

Le générateur d'offres est une stratégie de négociation classique: un modèle de négociation de Rubinstein, une stratégie de Zeuthen ou un simple coup de tête sur le prix.

Le taux de transaction augmente parce que:
- Les prix restent dans la zone de négociation.
- Les ancres sont stratégiques, pas émotionnelles.
- Le LLM fait ce qu'il est bon à faire: écrire.

### Les résultats de négociationArena

Le rapport de référence canonique est fourni par arXiv:2402.05863.

- Les LLM peuvent améliorer les paiements de ~20% en adoptant des personas ("Je suis désespérément prêt à vendre ce vendredi")  La manipulation de la personnalité est une véritable tactique.
- Les agents équitables/coopératifs sont exploités par ceux qui sont opposés; la défense exige une contre-position explicite.
- Les couples symétriques convergent à des résultats inéquitables sur environ 40% des scénarios de référence.

Ce n'est pas "les LLM sont de mauvais négociateurs". C'est "les LLM négocient trop comme les humains, y compris les parties exploitables".

### Le cauchemar de la chaîne de pensée

Le Grand Concours de négociation autonome (arXiv:2503.06416) a mené environ 180 000 négociations sur de nombreuses stratégies de LLM. Les gagnants ont caché leur raisonnement à leurs homologues:

- Si un agent imprime "Je vais seulement à$75; my reservation price is $70" dans un scratchpad visible au public, l'adversaire le lit.
- Les gagnants calculent la stratégie en privé; le canal de sortie ne contient que l'offre et le minimum de narration requis.

Il s'agit d'un écho de 2026 de la théorie classique du jeu (Aumann 1976 sur la rationalité et l'information): révéler votre valorisation privée coûte la rémunération. LLM ne l'intuition et heureusement taper leurs réserves dans des traces de raisonnement qui deviennent visibles à l'autre.

Résumé de l'ingénierie: séparer le contexte privé du scratchpad du contexte public.

### Bhattacharya et coll. 2025  classement des modèles

Sur les mesures du projet de négociation de Harvard (négociation en principe, respect de la BATNA, réciprocité des intérêts):

- **Llama-3**était le plus efficace pour négocier des offres (taux de transaction + remboursement).
- **Claude-3**Il a été le négociateur le plus agressif (ancres élevés, concessions tardives).
- **GPT-4**était le plus équitable (moins de variance de rémunération entre les couples).

Il s'agit d'un instantané de 2025. Le point n'est pas lequel modèle gagne en avril 2026  c'est que les différents modèles de base ont des styles de négociation persistants.

### Allocation des tâches par contrat net + LLM

La réutilisation moderne du réseau de contrat pour les LLM multi-agents:

1. L'agent directeur décompose une tâche en unités.
2. Les émissions `cfp`avec une description des tâches aux agents des travailleurs.
3. Chaque travailleur retourne une offre: `(price, eta, confidence)`où le prix pourrait être des jetons, des unités de calcul ou des dollars.
4. Le gestionnaire choisit les gagnants (singles ou multiples, selon la tâche) et les prix.
5. Les travailleurs rejetés sont libres de faire des offres pour d'autres tâches.

Cette échelle dépasse bien 100 travailleurs parce que la coordination est de diffusion et de réponse, pas de chat synchrone.

### L'entreprise de gestion des droits de propriété intellectuelle et des parties prenantes

NeurIPS 2024 (https://proceedings.neurips.cc/paper_files/paper/2024/file/984dd3db213db2d1454a163b65b84d08-Paper-Datasets_and_Benchmarks_Track.pdf) introduit des jeux scortables multipartis avec **secret scores**et **minimum-acceptance thresholds**. Chaque partie prenante possède des services publics privés; le LLM doit les déduire des messages. C'est la généralisation de la négociation bipartite à la formation de coalitions de N-partis.

### La règle de la narration contre le mécanisme

Dans tous les critères de référence de négociation de 2024 à 2026, la règle d'ingénierie constante est la suivante:

> Laissez le LLM raconter, ne laissez pas le LLM calculer l'offre.

Si l'offre doit être un nombre (prix, ETA, quantité), générez-la déterministiquement à partir de l'état de négociation et faites en sorte que le LLM produise le cadrage.

```figure
a5-og-narrator
```

## Faites-le

`code/main.py`les implémentations:

- `ContractNetManager`- Je suis là .`ContractNetTask`- Je suis là .`Bid` gestionnaire + soumissionnaires, diffusion de la télévision, collecte de propositions, récompense.
- `og_narrator_bargain(state, rng)` Acheteur OG-Narrateur: concession déterministe de style Zeuthen vers le milieu.
- `seller_response(state, rng)` politique déterministe de contre-offre du vendeur (la vérité structurelle de base pour les deux styles).
- `naive_llm_bargain(state, rng)` simulation d'une négociation entièrement LLM: choisit des prix avec une forte variance, souvent en dehors de la ZOPA.
- Mesure: taux de transaction sur 1000 essais avec prix de réservation frais échantillonnés par essais.

Je vais courir .

```
python3 code/main.py
npx tsx code/main.ts
```

Les résultats attendus: taux de transaction naïf-LLM ~65-75%; taux de transaction OG-Narrateur ~85-95%; l'écart de 15-25 points est l'avantage structurel de décomposer la génération d'offres de la narration.

## Utilisez-le

`outputs/skill-bargainer-designer.md`Il conçoit un protocole de négociation: qui génère des offres (déterministique ou LLM), qui raconte, comment les scratchpads privés se séparent des messages publics et comment le taux de transaction est surveillé.

## La faire partir

Liste de contrôle des négociations de production:

- **Separate scratchpad.**L'État privé n'atteint jamais le contexte de l'autre.
- **Deterministic offer generation.**Prix, quantités, dates d'arrivée: calculer, ne pas demander.
- **Validate all incoming offers**rejeter les offres hors ZOPA à la limite du protocole.
- **Bound rounds.**3 à 5 coups maximum; escalade à la médiation en cas d'impasse.
- **Measure deal rate and payoff variance**Une baisse du taux d'opération est un symptôme  souvent une dérive rapide ou une attaque par contrepartie.
- **Log all rejected proposals**Pour les gestionnaires de réseau de contrats, les soumissionnaires perdants doivent comprendre pourquoi.

## Exercices

1. On court .`code/main.py`Confirme que OG-Narrateur est plus que naïf-LLM sur le taux de transaction.
2. Mise en œuvre **persona-based payoff improvement**L'acheteur adopte un personnage " désespéré d'acheter cette semaine " dans le récit seulement, offre générateur inchangé.
3. Implémentation de la chaîne de pensée **concealment**: maintenir une chaîne de scratchpad privée qui n'est pas transmise à la contrepartie.
4. Lorsque toutes les offres dépassent la réserve, comment le gestionnaire décide-t-il entre le prix le plus bas et le prix le plus élevé?
5. Lisez Bhattacharya et collègues 2025 sur les métriques du projet de négociation de Harvard. Implémenter deux négociateurs avec des styles différents (agressif contre juste). Mesurer la variance de rémunération sous des paires symétriques et asymétriques.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Contract Net | "Task market" | Smith 1980, FIPA 1996. cfp + propose + accept/reject. The canonical task-market. |
| ZOPA | "Zone of possible agreement" | Overlap between buyer's max and seller's min. Offers outside it cannot close. |
| BATNA | "Best alternative to a negotiated agreement" | Your fallback if this deal fails. Sets your reservation price. |
| OG-Narrator | "Offer generator + narrator" | Decomposition: deterministic offer, LLM narration. |
| Zeuthen strategy | "Risk-minimizing concession" | Classical offer-generator that concedes based on risk limits. |
| Rubinstein bargaining | "Alternating-offer equilibrium" | Game-theoretic model for infinite-horizon bargaining with discounting. |
| CoT concealment | "Hide your reasoning" | Winners in arXiv:2503.06416 kept private scratchpads; public channel shows offer only. |
| Persona manipulation | "Emotional posturing" | arXiv:2402.05863: ~20% payoff gain from desperation/urgency personas. |

## Pour en savoir plus

- [NegotiationArena](https://arxiv.org/abs/2402.05863) l'indice de référence; constatations sur la manipulation et l'exploitation de la personne
- [Measuring Bargaining Abilities of Language Models](https://arxiv.org/abs/2402.15813) OG-Narrateur et le résultat de l'acheteur-plus dur que le vendeur
- [Large-Scale Autonomous Negotiation Competition](https://arxiv.org/abs/2503.06416) ~ 180 000 négociations; la dissimulation de la chaîne de pensée gagne
- [LLM-Stakeholders Interactive Negotiation (NeurIPS 2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/984dd3db213db2d1454a163b65b84d08-Paper-Datasets_and_Benchmarks_Track.pdf) Jeux scortables multi-partis avec des utilitaires secrets
- [Smith 1980 — The Contract Net Protocol](https://ieeexplore.ieee.org/document/1675516) le mécanisme classique, IEEE Transactions sur ordinateur
