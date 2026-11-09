# Équipe rouge: PAIR et attaques automatisées

> Chao, Robey, Dobriban, Hassani, Pappas, Wong (NeurIPS 2023, arXiv:2310.08419). PAIR  Rapid Automatic Iterative Refinement  est le jailbreak automatique de boîte noire canonique. Un LLM attaquant avec un système de red-team prompt propose à plusieurs reprises des jailbreaks pour un LLM cible, en accumulant des tentatives et des réponses dans son propre historique de chat comme rétroaction dans le contexte. PAIR réussit généralement dans les 20 requêtes, des ordres de magnitude plus efficaces que GCG (la recherche de gradients au niveau des jetons de Zou et coll.), et sans avoir besoin d'accès à la boîte blanche. PAIR est maintenant une ligne de base standard dans JailbreakBench (arXiv:2404.01318) et HarmBench, aux côtés de GCG, AutoDAN, TAP et Persuasive Adversarial Prompt.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, mock PAIR loop against a toy target)
**Prerequisites:** Phase 18 · 01 (instruction-following), Phase 14 (agent engineering)
**Time:** ~75 minutes

## Objectifs d'apprentissage

- Décrire l'algorithme PAIR: prompt du système d'attaque, raffinement itératif, rétroaction dans le contexte.
- Expliquez pourquoi PAIR est strictement plus efficace que GCG lorsque la cible est la boîte noire.
- Nombre de quatre autres lignes de base d'attaque automatisée (GCG, AutoDAN, TAP, PAP) et indiquez une caractéristique distinctive de chacune.
- Décrivez les protocoles d'évaluation JailbreakBench et HarmBench et ce que signifie " taux de réussite des attaques " sous chacun d'eux.

## Le problème

Le red-teaming était une activité manuelle. Un petit nombre de testeurs experts ont construit des instructions adversitaires et suivi celles qui fonctionnaient. Cela n'est pas à l'échelle: le taux de réussite des attaques a besoin d'un échantillon statistique, et la cible est une cible mobile avec chaque version du modèle. PAIR opère le red-teaming comme un problème d'optimisation avec une cible de boîte noire.

## Le concept

### Algorithme de paiement

Les entrées:
- Cible LLM T (le modèle que nous attaquons).
- Le juge LLM J (se marque si une réponse est une jailbreak).
- Attacker LLM A (l'optimisateur de l'équipe rouge).
- C'est une ligne de but G: "répondez avec [instruction nuisible]."
- Budget K (généralement 20 requêtes).

Boucle, pour k en 1..K:
1. A est incité par l'objectif G et l'historique des paires (prompte, réponse) jusqu'à présent.
2. Un émet une nouvelle demande $p_k$- Je suis désolé .
3. Envoyez $p_k$à T; recevoir une réponse $r_k$- Je suis désolé .
4. J score $(p_k, r_k)$sur le but.
5. Si le score >= seuil, arrêtez  jailbreak trouvé.
6. Autrement, ajouter $(p_k, r_k)$à l'histoire de A; continuez.

Résultat empirique (NeurIPS 2023): > 50% taux de réussite des attaques contre GPT-3.5-turbo, Llama-2-7B-chat; requêtes moyennes à succès dans la plage 10 à 20.

### Pourquoi PAIR est efficace

GCG (Zou et coll. 2023) recherche les suffixes de jetons adversitaires par gradient; il nécessite un accès à un modèle de boîte blanche et produit des suffixes illisibles. PAIR est une boîte noire et produit des attaques en langage naturel qui se transférent entre les modèles.

### Attaques automatisées connexes

- **GCG (Zou et al. 2023, arXiv:2307.15043).**La recherche de suffixes adversitaires au niveau des jetons.
- **AutoDAN (Liu et al. 2023).**La recherche évolutionniste des instincts, guidée par un objectif hiérarchique.
- **TAP (Mehrotra et al. 2024).**Arbre d'attaques avec taille  branches multiples déploiements de style PAIR.
- **PAP (Zeng et al. 2024).**Les instructions adverse persuasives  encodent les techniques de persuasion humaine comme des modèles de persuasion.

### JailbreakBench et HarmBench

Les deux (2024) standardisent l'évaluation:

- JailbreakBench (arXiv:2404.01318). 100 comportements nuisibles dans 10 catégories de politiques OpenAI. Taux de réussite des attaques (ASR) comme la métrique principale.
- HarmBench (Mazeika et coll. 2024). 510 comportements dans 7 catégories, avec des tests de dommages sémantiques et fonctionnels. Compares 18 attaques contre 33 modèles.

Les attaques comparées nécessitent des budgets correspondants; une RSA de 90% à 200 requêtes n'est pas comparable à une RSA de 85% à 20.

### Pourquoi il importe pour les déploiements de 2026

Chaque laboratoire frontalier effectue désormais des tests de PAIR et de TAP contre des modèles de production avant leur sortie.

### Là où cela s'inscrit dans la phase 18

La leçon 12 est la base de l'attaque automatisée. La leçon 13 (Many-Shot Jailbreaking) est une exploitation complémentaire de longueur. La leçon 14 (ASCII Art / Visual) est une attaque de codage. La leçon 15 (Indirect Prompt Injection) est la surface d'attaque de production de 2026. La leçon 16 couvre les homologues de l'outil de défense (Llama Guard, Garak, PyRIT).

```figure
al-pair-loop
```

## Utilisez-le

`code/main.py`Le juge note la réponse. Vous regardez l'attaquant réussir dans ~5-15 itérations contre le filtre de mots clés et échouer contre un filtre sémantique.

## La faire partir

Cette leçon produit `outputs/skill-attack-audit.md`- compte tenu d'un rapport d'évaluation de l'équipe rouge, il vérifie: quelles attaques ont été menées (PAIR, GCG, TAP, AutoDAN, PAP), à quel budget chacune a été menée, avec quel juge, sur quel comportement nocif a été mis en place (JailbreakBench, HarmBench, interne).

## Exercices

1. On court .`code/main.py`- Mesurer les requêtes moyennes à succès pour les trois stratégies d'attaque intégrées. Expliquer quelle hypothèse de défense cible exploite chacune.

2. Mettre en œuvre une quatrième stratégie d'attaque (p. ex., traduction dans une autre langue, codage base64) Rapporte les nouvelles requêtes moyennes à succès contre le filtre de mots clés et le filtre sémantique cible.

3. Lisez Chao et coll. 2023 Figure 5 (comparaison PAIR vs GCG). Décrivez deux scénarios où le GCG est préféré malgré l'avantage d'efficacité de PAIR.

4. JailbreakBench rapporte ASR contre un ensemble d'objectifs fixes. Concevoir une métrique supplémentaire qui mesure la diversité d'attaque (variance des demandes de succès). Expliquer pourquoi la diversité est importante pour l'évaluation de la défense.

5. TAP (Mehrotra 2024) étend PAIR avec branchage + taille.`code/main.py`et décrire le coût computationnel par rapport au taux de réussite.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| PAIR | "automated jailbreak" | Prompt Automatic Iterative Refinement; attacker-LLM + judge-LLM loop |
| GCG | "gradient jailbreak" | White-box token-level gradient search for adversarial suffixes |
| Attack success rate (ASR) | "% jailbreaks at k queries" | Primary metric; must be reported with query budget and judge identity |
| Judge LLM | "the scorer" | LLM that grades whether a response satisfies the harmful goal |
| JailbreakBench | "the evaluation" | Standardized harmful-behaviour set with tagged categories |
| HarmBench | "the broader bench" | 510 behaviours, functional + semantic harm tests |
| TAP | "tree of attacks" | PAIR with branching + pruning; better ASR at higher compute |

## Pour en savoir plus

- [Chao et al. — Jailbreaking Black Box LLMs in Twenty Queries (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) Papers de l'entreprise, NeurIPS 2023
- [Zou et al. — Universal and Transferable Adversarial Attacks on Aligned LLMs (arXiv:2307.15043)](https://arxiv.org/abs/2307.15043) papier GCG
- [Chao et al. — JailbreakBench (arXiv:2404.01318)](https://arxiv.org/abs/2404.01318) évaluation standardisée
- [Mazeika et al. — HarmBench (ICML 2024)](https://arxiv.org/abs/2402.04249) évaluation plus large
