# Agents multimodels et utilisation informatique (Capstone)

> Le produit frontier 2026 est un agent multimodal qui lit des captures d'écran, clique sur des boutons, navigue sur les interfaces Web, remplit des formulaires et complète des flux de travail de bout en bout. SeeClick et CogAgent (2024) ont prouvé que la première étape de l'interface graphique était la mise en terre. Ferret-UI a ajouté mobile. ChartAgent a introduit l'utilisation d'outils visuels pour les graphiques. VisualWebArena et AgentVista (2026) sont les points de référence de la poursuite frontalière  et même Gemini 3 Pro et Claude Opus 4.7 score ~30% sur les tâches difficiles d'AgentVista. Cette pierre angulaire regroupe tous les fils de la phase 12: la perception (VLM haute résolution), le raisonnement (LLM avec utilisation d'outils), la mise à terre (sortie de coordonnées), la mémoire à long horizon et l'évaluation.

**Type:** Capstone
**Languages:** Python (stdlib, action schema + agent loop skeleton), TypeScript
**Prerequisites:** Phase 12 · 05 (LLaVA), Phase 12 · 09 (Qwen-VL JSON), Phase 14 (Agent Engineering)
**Time:** ~240 minutes

## Objectifs d'apprentissage

- Conception d'un boucle d'agent multimodal: percevoir → raison → action → observer → répétition.
- Construisez un schéma de sortie de mise à terre de l'interface graphique (coordonnées de clic, texte de type, défilement, glisser) que le VLM peut émettre sous forme de JSON.
- Comparer les agents à capture d'écran seulement avec les agents à arbres d'accessibilité avec les agents hybrides.
- Configurez une évaluation de référence multimodale sur une petite tranche de VisualWebArena.

## Le problème

Un flux de travail sur le site de réservation: " Trouvez-moi un vol pour Tokyo pour le 15 avril, siège d'allée sous 800 $, réservez-le. "

Un agent multimodal doit:

1. Prenez une capture d'écran du navigateur.
2. Parser la capture d'écran + URL + objectif dans un plan.
3. Émettez une action structurée: cliquez (à x,y), tapez "Tokyo" (à l'élément E), faites défiler vers le bas, sélectionnez (bouton radio).
4. Appliquez l'action au navigateur.
5. Observez l' état nouveau (prochain capture d' écran).
6. Répétez jusqu'à ce que la tâche soit terminée.

Chaque étape est un appel VLM multimodal. La sortie VLM doit être JSON parseable. Les erreurs se composent à travers les étapes, donc la récupération est importante.

## Le concept

### L'interface graphique de la terre  la primitive

La mise à terre de l'interface graphique est: donné un capture d'écran et une instruction de langage naturel, sortez la coordonnée (x, y) pour cliquer (ou autre action).

SeeClick (arXiv:2401.10935) est le premier résultat ouvert à l'échelle: affiner un VLM sur des données GUI synthétiques + réelles, les coordonnées de sortie en tant que jetons de texte ordinaires.

CogAgent (arXiv:2312.08914) a ajouté 1120x1120 de haute résolution de codage pour les interfaces utilisateurs denses. Score: ~84% sur la navigation Web.

Ferret-UI (arXiv:2404.05719) se concentre sur les interfaces mobiles, s'intègre avec les données d'accessibilité iOS.

Le format de sortie est généralement JSON:

```json
{"action": "click", "x": 384, "y": 220, "element_desc": "Search button"}
```

Le `element_desc`aide à la récupération: si les coordonnées dérivent entre les captures d'écran, l'indice sémantique permet au système de replanter.

### Schèmes d'action

Un schéma d'action typique comporte 6 à 10 types d'action:

- `click`Les points suivants:
- `type`: (texte, x?, y?)
- `scroll`: (direction, montant)
- `drag`Les produits de la production de produits de haute qualité
- `select`: (option_index)
- `hover`Les points suivants:
- `navigate`- Je suis désolé.
- `wait`Les résultats de l'enquête
- `done`: (succès, explication)

L'agent émet une action par étape. L'enveloppe du navigateur exécute et renvoie l'état nouveau.

### Capture d'écran seulement contre accessibilité

Deux modes d'entrée:

- Capture d'écran seulement: image complète, aucune information structurelle.
- Arbre d'accessibilité: informations structurées sur l'accessibilité DOM / iOS. Beaucoup plus fiable pour la mise à terre; fonctionne lorsque l'arbre est disponible.
- Hybride: les deux, avec l'arbre comme fondateur fiable pour les actions atomiques et la capture d'écran pour le contexte sémantique.

Les agents de production utilisent des hybrides lorsque cela est possible. L'automatisation du navigateur (Sélénium + accessibilité) a toujours l'arbre; les applications de bureau le font parfois.

### Mémoire à long horizon

Un flux de travail de 20 étapes génère 20 captures d'écran. Le contexte du VLM se remplit rapidement.

- Chaîne de résumé: après chaque 5 étapes, résumer ce qui s'est passé, laisser tomber les anciens captures d'écran.
- Skip-frame: conservez la première, la dernière et chaque troisième capture d'écran.
- Log enregistré par l'outil: exécuter des actions, garder un journal texte de ce qui a été fait; ne regardez pas à nouveau les anciens captures d'écran.

L'API de Claude utilise le modèle du journal, plus simple et plus fiable.

### Utilisation d'outils visuels

L'agent de graphique (arXiv:2510.04514) introduit l'utilisation d'outils visuels pour la compréhension des graphiques: crop, zoom, OCR, appel de détection externe. L'agent peut exécuter "crop to region (100, 200, 300, 400) puis appeler OCR" comme appel d'outil. L'outil renvoie du texte; le VLM continue à raisonner.

Ce modèle généralise: l'interrogatoire de marque, l'annotation de région et les outils de détection externes correspondent tous au même schéma "expédier un appel d'outil, recevoir une réponse structurée".

### Les critères de référence de 2026

- ScreenSpot Pro. L'interface graphique est basée sur environ 1 000 captures d'écran Web.
- VisualWebArena. tâches Web de bout en bout (boutique, forum, annonces classifiées). SOTA ouvert ~ 20%. Gemini 3 Pro ~ 27%.
- AgentVista (arXiv:2602.23166). Le point de référence le plus difficile de 2026. Flux de travail réaliste sur 12 domaines. Modèles frontaliers score 27-40%; modèles ouverts 10-20%.
- WebArena / WebShop. Les critères de référence plus anciens; saturés par frontière.

### Pourquoi c'est toujours difficile

Les écarts de performance des agents:

1. "Cliquez le petit X" échoue souvent à la résolution mobile.
2. Après 10 actions, l'agent dérive de la cible.
3. Rétablissement d'erreur. Lorsqu'un clic échoue (tous bons), la détection + récupération est rarement une formation de données.
4. Le saut entre onglets ou longs formulaires perd son état.

Directions de recherche: architectures de mémoire, replanification explicite, vérification multimodal (écran correspondant à la réussite de l'action).

### La pierre angulaire construit-il

La tâche principale: construire un agent d'utilisation informatique qui:

1. Lisez le capture d'écran HTML + d'une page de simulation du site de réservation.
2. Planifie une séquence en plusieurs étapes: recherche → sélection → remplissage du formulaire → soumission.
3. Émet des actions JSON correspondant au schéma d'action.
4. Évalué sur une tranche fixe de 10 tâches.

La leçon fournit un code d'échafaudage facile à étendre dans un navigateur réel.

```figure
mm-agent-loop
```

## Utilisez-le

`code/main.py`est l'échafaudage en pierre de taille:

- Définition JSON du schéma d' action (10 actions: les neuf énumérées ci-dessus plus `screenshot_region`, un outil de culture + zoom).
- Faux état de navigateur comme dicté.
- Le squelette de boucle d'agent: état de réception, émission d'action, application, boucle.
- Un mini-benchmark de 10 tâches (pages synthétiques) pour mesurer le taux de réussite de bout en bout.
- Crochet de récupération d'erreur pour une action échouée.

## La faire partir

Cette leçon produit `outputs/skill-multimodal-agent-designer.md`. Compte tenu d'un produit d'utilisation informatique (domaine, ensemble d'action, cible d'évaluation), il conçoit la boucle complète de l'agent, la stratégie de mémoire, le mode de mise à terre et le score de référence attendu.

## Exercices

1. Le schéma du code ajoute un `screenshot_region`Les actions principales sont les 9 actions principales.

2. Lisez AgentVista (arXiv:2602.23166). Décrivez la catégorie de tâches la plus difficile et pourquoi les modèles frontaliers échouent toujours.

3. Compression de la mémoire à long horizon: concevoir une chaîne de synthèse avec ≤4 captures d'écran maintenues en direct, n'importe quel numéro enregistré.

4. Construire un crochet de récupération d'erreur: en cas d'échec de l'action (bouton non trouvé), que fait ensuite l'agent ?

5. Comparer Claude 4.7 à écran hybride + arbre d'accessibilité Qwen2.5 VL sur 10 tâches Web.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| GUI grounding | "Click coordinates" | Model outputs (x,y) for the target of an instruction on a screenshot |
| Action schema | "Tool definitions" | JSON description of valid actions (click, type, scroll, drag) |
| Accessibility tree | "Structured DOM" | Machine-readable UI hierarchy from browser/iOS APIs |
| Hybrid agent | "Screenshot + tree" | Uses both image and structured info; more reliable than either alone |
| Visual tool use | "Zoom/crop/detect" | Agent calls external vision tools (OCR, detection) mid-plan |
| Summary-chain | "Memory compression" | Periodic text summaries replace long screenshot history |
| VisualWebArena | "E2E web bench" | 2024 benchmark for end-to-end web tasks |
| AgentVista | "2026 hard bench" | 12-domain realistic workflows; even Gemini 3 Pro scores ~30% |

## Pour en savoir plus

- [Cheng et al. — SeeClick (arXiv:2401.10935)](https://arxiv.org/abs/2401.10935)
- [Hong et al. — CogAgent (arXiv:2312.08914)](https://arxiv.org/abs/2312.08914)
- [You et al. — Ferret-UI (arXiv:2404.05719)](https://arxiv.org/abs/2404.05719)
- [ChartAgent (arXiv:2510.04514)](https://arxiv.org/abs/2510.04514)
- [Koh et al. — VisualWebArena (arXiv:2401.13649)](https://arxiv.org/abs/2401.13649)
- [AgentVista (arXiv:2602.23166)](https://arxiv.org/abs/2602.23166)
