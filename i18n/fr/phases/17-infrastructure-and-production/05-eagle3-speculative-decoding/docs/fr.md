# EAGLE-3 Décodage spéculatif dans la production

> Le décoding spéculatif associe un modèle rapide à celui cible. Le projet propose des jetons K; l'objectif est vérifié en un seul forward; les jetons acceptés sont gratuits. En 2026, EAGLE-3 est la variante de la classe de production  il entraîne un chef de projet sur les états cachés du modèle cible plutôt que sur les jetons bruts, poussant le taux d'acceptation alpha dans la bande de 0,6-0,8 sur le chat général. La bonne question n'est pas "combien rapide est le projet" mais "qu'est-ce que l'alpha sur mon trafic?" Si l'alpha tombe en dessous de ~0.55, le décoding spéculatif est négatif net à haute simultanéité parce que chaque projet rejeté coûte un deuxième passe cible. Cette leçon vous apprend à mesurer l'alpha d'abord et à tourner le drapeau en second.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy acceptance-rate simulator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 10 · 18 (Multi-Token Prediction)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Nombre des trois générations de décoding spéculatif et expliquer ce que l'Eagle-3 change de l'Eagle-2 et d'un modèle classique de projet.
- Définir le taux d'acceptation alpha, calculer l'accélération attendue à partir d'alpha et K (longueur du projet), et identifier l'alpha de rupture équilibrée pour votre concurrence cible.
- Expliquez pourquoi le décoding spéculatif est opt-in (pas par défaut) dans vLLM 2026 et pourquoi l'activer sans mesurer alpha est un modèle anti-production.
- Écrivez un plan de mesure: quel est le point de référence, quelle est la distribution de la demande, quel point de concurrence, quelle est la mesure à utiliser.

## Le problème

Le décodeur est lié à la mémoire. Sur un H100 exécutant Llama 3.3 70B FP8, chaque étape de décodeur lit tous les ~ 70 Go de poids de HBM et émet un jeton par séquence.

Le décoding spéculatif exploite le fossé. Générez des jetons candidats K avec un modèle de projet bon marché, puis demandez au modèle cible de vérifier tous les K dans un seul passe à l'avant. Chaque jeton vérifié est effectivement gratuit (amortisé dans un lot de K à l'avant que la cible aurait dû faire de toute façon).

L'approche classique du modèle de projet utilise un modèle plus petit de la même famille (Llama 3.2 1B rédaction pour Llama 3.3 70B). Il fonctionne mais le taux d'acceptation est médiocre  la distribution du modèle plus petite diverge de l'objectif. L'Eagle, puis l'Eagle-2, puis l'Eagle-3 entraînent une tête de projet légère directement sur les états internes du modèle cible, de sorte que la distribution du projet suit la cible beaucoup plus de près. C'est pourquoi Alpha passe de 0,4 avec le modèle de projet à 0,6-0,8 avec EAGLE-3.

Le capture: EAGLE-3 est accepté dans le vLLM 2026. `speculative_config`Les équipes qui le déploient sans mesurer l'alpha sur leur trafic réel voient souvent la latence de la queue s'aggraver, pas s'améliorer.

## Le concept

### Ce que le décoding spéculatif achète réellement

Sans décode spécifique, le coût par jeton est un cible à l'avant.`1 + K * alpha`- Le rappel est ...`(1 + K * alpha) / (1 + epsilon)`où epsilon est le coût de la révision des projets. pour K=5, alpha=0,7:`(1 + 5*0.7) / (1 + 0.1) = 4.5 / 1.1 = 4.1x`Les chiffres du monde réel se regroupent autour de 2-3 fois parce que l'alpha est rarement aussi élevé sur le trafic de production et l'epsilon grandit à haute taille de lot.

### Pourquoi alpha est la seule métrique qui compte

Les jetons rejetés ne disparaissent pas  ils forcent une deuxième cible à la première jeton rejetée. Pour une charge de travail où l'alpha tombe à 0,4, vous payez des frais généraux de projet plus de vérification plus de ré-roll. À haute simultanéité (disons 256 simultanément), le lot de décode est déjà assez grand pour que l'écart entre "target seul" et "target avec vérifier" diminue. En dessous de l'alpha 0.55 sur la plupart des appareils de 2026, le décode des spécifications est négatif net.

Alpha varie selon la charge de travail. Sur le chat général de style ShareGPT, EAGLE-3 entraîné sur ShareGPT atteint 0,6-0,8. En ce qui concerne le trafic spécifique au domaine (code, médical, juridique), le chef de projet formé aux données générales tombe à 0,4-0,6. La formation d'un chef de projet spécifique au domaine récupère alpha  c'est un travail de formation léger et rapide par rapport à la finition cible. Les valeurs de la phase 7 · 16 et de la phase 10 · 15 sont plus élevées (0,85 et plus). Ce sont des taux par jeton sur les points de référence de chat qui correspondent aux données de formation du projet. Planifiez avec les bandes de cette page et mesurez alpha sur votre propre trafic.

### Des générations d'AIGLE à un coup d'œil

- **Classic draft model**: petit modèle de même famille. Alpha 0.3-0.5. Infrastructure simple  deux modèles chargés, projet de course K en avant par cible en avant.
- **EAGLE-1 (2024)**L'objectif est de maintenir la tête de projet unique en état caché (dernier niveau).
- **EAGLE-2 (2025)**: longueur adaptative du projet et des projets basés sur des arbres (vérifiez plusieurs branches dans un seul passage cible). Alpha ~ 0,6-0,7.
- **EAGLE-3 (2025-2026)**: tête de projet entraînée sur plusieurs couches cibles (pas seulement la dernière), meilleure alignement. alpha ~ 0,6-0,8 sur le chat général.

### La recette de production de 2026

1. Modèle de port cible clair. Mesurer la TTFT de référence, le LTI, le débit à la simultanéité cible.
2. Activer le projet EAGLE-3 via vLLM `speculative_config`- Retournez le point de référence.
3. Taux d' acceptation de journaux alpha. vLLM V1 rapporte ceci comme `spec_decode_metrics.accepted_tokens_per_request`Divisez par la longueur requise pour obtenir l'alpha.
4. Si l'alpha < 0,55 est appliquée à la distribution du trafic de production, désactiver le décodeur des spécifications ou entraîner un projet EAGLE-3 spécifique au domaine.
5. Confirme que le P99 ITL n'a pas empiré.

### Le piège de production: P99 queue

La moyenne ITL diminue avec le décode spécifique. P99 peut empirer si vous ne réglez pas. Les projets rejetés déclenchent une séquence de deux passes (draft + verifier-fail + ré-rollo).

### Lorsque l'Eagle-3 est déjà déployé

Google a déployé le décoding spéculatif dans AI Overviews en 2025 (même qualité, réponse plus rapide). vLLM V1 vaisseaux `speculative_config`SGLang prend en charge EAGLE-3 comme voie de projet recommandée pour les charges de travail lourdes.

### - Je ne peux pas faire de calcul.

Accélération attendue: `S(alpha, K) = (1 + K*alpha) / (1 + verify_overhead)`- Je suis en train de régler .`S = 1`résolve pour alpha: `alpha_breakeven = verify_overhead / K`. Pour les charges de vérification typiques ~0,15 et K=5: `alpha_breakeven = 0.03`Mais c'est le mathématique de décode brut. À haute simultanéité, le coût de vérification augmente et le lot de décode amorte déjà les lectures de mémoire à travers les séquences, donc l'équilibre alpha_breakeven efficace monte à ~ 0,45-0,55 en pratique.

### Quand ne pas utiliser le décoding spéculatif

- Génération hors ligne de série 1, où la latence n'a pas d'importance.
- Les résultats sont très courts (moins de 50 jetons).
- Des domaines spécialisés sans chef de projet.
- Assumant que chaque paire de fonctionnalités est composée. Vérifiez la matrice de compatibilité vLLM pour votre version: v0.18.0 marque le décoding spéculatif compatible avec le pré-remplissage en morceaux.

```figure
mx-speculative-tree
```

## Utilisez-le

`code/main.py`Simulation d'une boucle de décode avec et sans décode spéculative sur une gamme de valeurs alpha et de longueurs de projet K. Il imprime l'alpha-partie, la vitesse mesurée et le comportement de la queue.

## La faire partir

Cette leçon produit `outputs/skill-eagle3-rollout.md`. Compte tenu d'un modèle cible, d'une description de la distribution du trafic et d'un objectif de simultanée, il produit un plan de déploiement EAGLE-3 en étapes  référence de base, permet la configuration, la mesure alpha, la porte sur alpha >= 0,55, voir P99 ITL.

## Exercices

1. On court .`code/main.py`À K=5, quelle alpha vous faut pour une accélération de 2x ? Pour une accélération de 3x ?
2. Imaginez que le trafic de production divise 70% le chat général, 30% le code. Le chat général atteint alpha 0.7 avec EAGLE-3 formé sur ShareGPT; le code atteint alpha 0.4.
3. Lisez le VLLM `speculative_config`Nommer les trois modes (modèle de projet, EAGLE, N-gramme) et vérifier les caractéristiques de chacun composé dans votre version vLLM.
4. Vous voyez une baisse moyenne de l'ITL de 25% après avoir activé EAGLE-3 mais P99 ITL a augmenté de 15%.
5. Comptez le coût de mémoire de la tête de projet EAGLE-3 pour Llama 3.3 70B. Comment se compare-t-il à l'exécution de Llama 3.2 1B comme un projet classique?

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Speculative decoding | "draft plus verify" | Propose K tokens with a cheap model, verify all K in one target forward |
| Acceptance rate alpha | "spec accept rate" | Fraction of draft tokens accepted by the target; the only metric that matters |
| Draft length K | "spec k" | How many tokens the draft proposes per target forward; typical 4-8 |
| Verify overhead epsilon | "spec overhead" | Extra cost to verify-and-reroll vs a plain target forward; grows with batch |
| EAGLE-3 | "latest EAGLE" | 2025-2026 variant; trains draft head on multiple target layers; alpha 0.6-0.8 on general chat |
| `speculative_config` | "vLLM spec config" | The explicit opt-in in vLLM V1; no default means no acceleration |
| N-gram spec decode | "N-gram draft" | GPU-side draft using N-gram lookups in the prompt; chunked-prefill-compatible |
| Break-even alpha | "no-op alpha" | Alpha at which spec decode gives zero speedup; watch this at production concurrency |
| Rejected-draft two-pass | "reroll cost" | Two target forwards when drafts reject; drives P99 tail |

## Pour en savoir plus

- [vLLM — Speculative Decoding docs](https://docs.vllm.ai/en/latest/features/spec_decode/) source officielle sur `speculative_config`et la compatibilité avec le préchargement en morceaux dans V1.
- [vLLM Speculative Config API](https://docs.vllm.ai/en/latest/api/vllm/config/speculative/) l'ensemble exact du champ.
- [EAGLE paper (arXiv:2401.15077)](https://arxiv.org/abs/2401.15077) la formule originale de la tête de projet de l'Eagle.
- [EAGLE-2 paper (arXiv:2406.16858)](https://arxiv.org/abs/2406.16858) projets adaptatifs et arbres.
- [UC Berkeley EECS-2025-224](https://www2.eecs.berkeley.edu/Pubs/TechRpts/2025/EECS-2025-224.html) système de MLL efficace avec décoding spéculatif.
- [BentoML — Speculative Decoding](https://bentoml.com/llm/inference-optimization/speculative-decoding) Liste de contrôle de déploiement de la production.
