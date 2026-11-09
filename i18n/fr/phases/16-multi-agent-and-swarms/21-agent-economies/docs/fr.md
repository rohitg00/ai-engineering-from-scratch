# Économie des agents, incitations aux jetons, réputation

> Les agents autonomes à long horizon (curve de travail de 1 à 8 heures de METR) ont besoin d'un agent économique.**5-layer stack**est: **DePIN**(compute physique) → **Identity**(DIDs du W3C + capital de réputation) → **Cognition**(RAG + MCP) → **Settlement**(abstraction du compte) → **Governance**Les réseaux d'incitations aux agents de production comprennent:**Bittensor**(les sous-réseaux de TAO récompensent les modèles spécifiques à la tâche), **Fetch.ai / ASI Alliance**(Token ASI-1 Mini LLM + FET), et **Gonka**(PoW basé sur un transformateur qui réaffecte l'informatique aux tâches d'IA productives).**Shapley-value credit attribution**Les résultats de recherche sur les données de recherche et de recherche sont également très intéressants.**token auctions**Cette leçon construit un marché d'agents minimal, applique l'attribution de crédit Shapley à un pipeline multi-agents, et exécute une vente aux enchères de jetons de deuxième prix afin que la machine de théorie du jeu atterrisse concrètement.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 16 (Negotiation and Bargaining), Phase 16 · 09 (Parallel Swarm Networks)
**Time:** ~75 minutes

## Problème

Les systèmes multi-agents deviennent compliqués lorsque les agents produisent de la valeur conjointement mais doivent être récompensés individuellement. Les mécanismes classiques  partage égal, dernier contributeur prend tout  sont injustes ou jouables. La récompense basée sur la coalition par les valeurs de Shapley est juste par construction mais coûteuse à calculer. La littérature 2025-2026 pousse à des approximations utiles: le prélèvement d'échantillons de Shapley, les enchères monotones d'agrégation et la réputation sur la chaîne qui s'accumule à partir de contributions confirmées.

Au-delà de l'attribution de crédit, le domaine s'est tourné vers des agents économiques réels: Bittensor TAO récompense le calcul minier pour affiner les modèles spécifiques au sous-réseau, Fetch.ai/ASI récompense l'utilisation de la mini-LLC ASI-1 avec des jetons FET, Gonka réaffecte la preuve de travail des transformateurs vers des tâches d'IA productives.

Cette leçon traite les économies d'agents comme une famille de problèmes spécifiques  attribution de crédit, conception de mécanisme et réputation  et construit chacune avec les mathématiques minimales afin que les idées restent.

## Concept

### La pile de 5 couches d'agent-économie

1. **DePIN (physical compute).**Une infrastructure décentralisée qui loue des GPU, du stockage, de la bande passante, des sous-réseaux de Bittensor, du Render Network, Akash, pas spécifique à l'agent, les agents l'utilisent.
2. **Identity.**Les identifiants décentralisés (DID) du W3C donnent à chaque agent une ID durable indépendante de toute plateforme. La réputation accumule à la DID. Le protocole réseau d'agent (ANP) utilise la DID comme couche de découverte.
3. **Cognition.**Le cycle de raisonnement de l'agent: LLM + RAG + MCP. C'est ce que construisent les autres phases.
4. **Settlement.**L'abstraction des comptes (ERC-4337) permet aux agents de payer le gaz à partir de leurs propres soldes sans détenir d'ETH. Les agents peuvent payer pour des services, entre eux ou calculer.
5. **Governance.**Les DAO agencés: structures de gouvernance où les humains *et* les agents votent sur les changements de protocole, avec le pouvoir de vote lié à la réputation.

Tous les systèmes de production n'utilisent pas les cinq. Bittensor utilise 1, 2, partiellement 3, partiellement 4, aucun des 5.

### Bittensor, Fetch.ai, Gonka  ce qui fonctionne

**Bittensor (TAO).**Les sous-réseaux sont des tâches spécialisées (modélisation de langage, génération d'images, prévision). Les mineurs soumettent des sorties de modèle. Les validateurs les classent; le score pondéré par les enjeux distribue les récompenses TAO. Chaque sous-réseau a sa propre évaluation.

**Fetch.ai / ASI Alliance.**L'ASI-1 Mini LLM fonctionne sur le réseau de Fetch.ai; les utilisateurs paient des jetons FET pour l'inférence.

**Gonka.**Prouver le travail du transformateur: le " travail " est des passes avant d'un transformateur. Les mineurs gagnent en exécutant des tâches d'inférence qui ont connu des sorties correctes (à partir des données de formation). PoW productif des ressources au lieu de PoW basé sur le hachage.

Les trois sont de qualité de production à partir d'avril 2026. La distribution des paiements diffère.

### Attribution de crédit à valeur Shapley

Trois agents collaborent sur une tâche.

Value de Shapley: la répartition unique de crédit répondant à quatre axiomes (efficacité, symétrie, linéalité, nul).`i`- Le numéro de la liste:

```
shapley(i) = (1/N!) * sum over all orderings O of (v(S_i_O ∪ {i}) - v(S_i_O))
```

où `S_i_O`est l' ensemble d' agents avant `i`dans l'ordre `O`. En pratique: énumérer toutes les permutations, enregistrer la contribution marginale de chaque agent dans chaque permutation, moyenne.

Pour N=3, il y a 6 permutations. Pour N=10, 3.6M  donc en pratique vous prenez des échantillons d'ordres plutôt que de les énumérer.

### Enchère à prix de seconde instance pour l'agrégation

Google Research ("Mécanisme de conception pour les grands modèles linguistiques") propose des enchères de jetons à prix second pour l'agrégation des résultats de la LLM. Configuration: N agents proposent chacun une finition; chacun a une valeur privée pour être sélectionné. Le vendeur choisit la proposition de valeur la plus élevée et paie la valeur la plus élevée. En agrégation monotone (la valeur dépend de la proposition choisie, pas du nombre de soumissions), c'est vrai  les agents proposent leur vraie valeur.

Pourquoi cela importe pour les systèmes de LLM: vous pouvez externaliser les tâches de finalisation à plusieurs agents avec des prix différents; l'enchère choisit le meilleur + paie équitablement, et les agents n'ont aucune incitation à faire des déclarations erronées.

### Capitaux de réputation

Un score de réputation lié à la DID s'accumule à partir de contributions confirmées.

```math
\text{rep}(i, t+1) = \alpha \cdot \text{rep}(i, t) + (1 - \alpha) \cdot \text{contribution\_quality}(i, t)
```

Avec un facteur de décomposition `alpha`Près de 1. réputation:

- Il est bon marché de lire pour les décisions de routage ("envoyer des tâches difficiles à des agents de haute réputation").
- Il est coûteux à forger (il s'accumule au fil du temps, lié à la DID).
- Peut être réduit: les contributions qui échouent à la vérification soustraire.

### AAMAS 2025 LaMAS décentralisée

La proposition LaMAS (AAMAS 2025) combine: l'identité DID, l'attribution de crédit à valeur Shapley et un mécanisme d'enchères simple.

### Où l'économie s'effondre

- **Price oracle manipulation.**Si la fonction de crédit peut être jouée, les agents le feront.
- **Sybil attacks.**Un opérateur fait tourner N faux agents pour gonfler leur propre contribution.
- **Verification cost.**L'attribution de crédit est juste comme le vérificateur.Si la vérification est bon marché (petit LLM), elle peut être jouée; si elle est coûteuse (panneau humain), le système n'est pas à l'échelle.
- **Regulatory overhang.**Les économies d'agents se croisent avec la réglementation financière. Bittensor, Fetch et Gonka travaillent tous dans des zones grises légales dans certaines juridictions à partir de 2026.

### Lorsque les économies d'agents ont du sens

- **Open networks with heterogeneous operators.**Aucune équipe ne contrôle tous les agents.
- **Verifiable outputs.**Sans vérification, l'attribution du crédit est une devinette.
- **Long-horizon workflows.**Les tâches simples ne bénéficient pas de l'accumulation de réputation.
- **Tokenized payments are legally viable**dans votre juridiction.

Dans les systèmes d'entreprise fermés, l'économie cède la place à une allocation plus simple (les gestionnaires attribuent du travail, les mesures sont internes).

```figure
swarm-auction
```

## Faites-le

`code/main.py`les implémentations:

- `shapley(value_fn, agents)` calcul exact de Shapley par énumération pour petit N.
- `second_price_auction(bids)` mécanisme véridique; le gagnant paie le deuxième plus élevé.
- `Reputation` réputation liée à la DID avec déclin exponentiel et coupures.
- Trois agents collaborent, et Shapley attribue le crédit exact.
- Démo 2: cinq agents proposent une place de travail; la deuxième vente aux enchères choisit le gagnant + paiement.
- Démo 3: 100 tours de tâches attribuées à des agents avec une représentation hétérogène; routage pondéré par une représentation bat au hasard.

Je vais courir .

```
python3 code/main.py
npx tsx code/main.ts
```

Résultats attendus: valeurs Shapley pour chaque agent; résultat de la vente aux enchères montrant un équilibre de l'offre vraie; routage pondéré par répétition montrant un gain de qualité de 10-20% par rapport au hasard après le réchauffement.

## Utilisez-le

`outputs/skill-economy-designer.md`Il conçoit une économie d'agent minimale: choix de couche d'identité, mécanisme d'attribution du crédit, mécanisme de paiement, règle de réputation.

## La faire partir

Diriger une économie d'agents en 2026:

- **Start with reputation, not tokens.**La réputation est bon marché à mettre en œuvre et précieuse à elle seule; les jetons ajoutent une complexité juridique et économique.
- **Verify before you reward.**Ne distribuez jamais de crédit sans vérification indépendante.
- **Shapley-sample, not Shapley-exact.**Prenons l'échantillon de 100 à 1000 commandes; l'énumération exacte ne s'établit pas.
- **Cap decay factor and floor reputation.**La décomposition illimitée efface les contributeurs légitimes; la décomposition trop lente récompense les agents obsolètes à forte réaction.
- **Audit mechanisms adversarially.**Chaque mécanisme a une théorie du jeu, vous voulez trouver les trous, pas les attaquants.

## Exercices

1. On court .`code/main.py`Confirmer la somme des valeurs de Shapley à la valeur totale (axiome d'efficacité). Modifier la fonction de valeur; les allouements de Shapley changent-ils dans la direction attendue?
2. Implémenter Shapley *sampling* (Monte Carlo sur K ordonnements). Comment K affecte-t-il la précision des approximations ?
3. La mise en œuvre d'une phase de formation de coalition avant l'enchère: les agents peuvent se fusionner en équipes et faire des offres en tant qu'unité.
4. Lisez le message de conception de mécanisme de recherche de Google. Identifiez une hypothèse qui, si violée, enfreint la véracité.
5. Lisez le document LaMAS décentralisé AAMAS 2025. Implémenter leur Shapley pas sur 10 agents sur une tâche synthétique. Combien de temps prend le calcul exact?

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| DePIN | "Decentralized physical infrastructure" | Token-incentivized compute/storage/bandwidth. Bittensor, Akash, Render. |
| DID | "Decentralized identifier" | W3C spec for portable IDs. Agent reputation binds to DID, not to a platform. |
| ERC-4337 | "Account abstraction" | Contract accounts that can sponsor gas, enabling agent payments. |
| Shapley value | "Fair credit attribution" | Unique allocation satisfying efficiency, symmetry, linearity, null. |
| Second-price auction | "Vickrey auction" | Truthful mechanism: winner pays second-highest bid. Monotone aggregation compatible. |
| Reputation capital | "Accumulated quality score" | DID-bound score from confirmed contributions; decays over time. |
| Agentic DAO | "Agents + humans govern" | DAO with agent voters as first-class, voting power tied to reputation. |
| TAO / FET / GPU credits | "Token denominations" | Bittensor TAO, Fetch.ai FET, various DePIN tokens. |

## Pour en savoir plus

- [The Agent Economy](https://arxiv.org/abs/2602.14219) Enquête de 2026 sur la pile de cinq couches d'agents-économie
- [Google Research — Mechanism design for large language models](https://research.google/blog/mechanism-design-for-large-language-models/) ventes aux enchères symboliques avec aggregation monotone
- [AAMAS 2025 — decentralized LaMAS](https://www.ifaamas.org/Proceedings/aamas2025/pdfs/p2896.pdf) attribution de crédit à valeur Shapley
- [Bittensor TAO documentation](https://docs.bittensor.com/) Structure du sous-réseau et répartition des récompenses
- [Fetch.ai / ASI Alliance](https://fetch.ai/) ASI-1 Mini LLM et jeton FET
- [W3C Decentralized Identifiers (DIDs) spec](https://www.w3.org/TR/did-core/) fondation de l'identité
