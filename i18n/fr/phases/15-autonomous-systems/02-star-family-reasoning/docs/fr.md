# STAR, V-STAR, SILENT-STAR  Réflexion autodidacte

> La plus petite boucle d'auto-amélioration possible se trouve à l'intérieur de la logique. Un modèle génère une chaîne de pensées, garde celles qui arrivent à des réponses correctes, et les maîtrise. C'est le STAR. V-STaR ajoute un vérificateur donc la sélection des délais d'inférence est meilleure. Quiet-STaR pousse la raison à chaque marque. Les trois fonctionnent. Aucun d'entre eux n'est magique. La boucle préserve tout raccourci qui arrive pour atteindre la bonne réponse.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, bootstrap-loop simulator)
**Prerequisites:** Phase 13 · 01-03 (Reasoning and CoT), Phase 15 · 01 (long-horizon framing)
**Time:** ~60 minutes

## Le problème

La façon la plus simple d'enseigner à un modèle à raisonner est de recueillir des traces de raisonnement écrites par l'homme.

STaR (Self-Teught Reasoner, Zelikman et al., 2022) demande: que se passe-t-il si le modèle écrit ses propres raisonnements et les classe par rapport aux réponses connues ?

1. Prenez une trace de raisonnement plus une réponse.
2. Si la réponse finale est correcte, conservez la trace.
3. - Une bonne réglage des traces.
4. Je répète.

Il fonctionne. GSM8K et CommonsenseQA ont tous deux amélioré sans nouvelle annotation humaine. Mais la boucle a un biais intégré: toute raison qui a produit la bonne réponse est conservée, indépendamment du fait que le raisonnement lui-même était solide. V-STaR (Hosseini et coll., 2024) le corrige avec un vérificateur appris; Quiet-STaR (Zelikman et coll., 2024) généralise l'idée à per-token rationnels internes.

## Le concept

### STaR: démarrage sur ce qui a fonctionné

Commencez par un modèle de base avec une faible capacité de raisonnement. Pour chaque problème de formation, prenez un échantillon de raisonnement plus une réponse. Si la réponse correspond à l'étiquette, gardez le triple (problème, raisonnement, réponse).

Si le modèle ne peut jamais résoudre un problème, la boucle ne peut pas apprendre à partir de lui.**rationalization**Pour les problèmes qui ne sont pas satisfaits, injectez la réponse correcte comme indice et réinvitez le modèle à produire une justification qui en débouche.

Résultat dans le document original (Zelikman et coll., 2022): un modèle de base GPT-J s'est amélioré sur GSM8K de 5,8% à 10,7% grâce à des tours répétés de STaR avec une rationalisation  environ 5 points de pourcentage absolus. Sur CommonsenseQA, le GPT-J 6B formé par STaR a atteint 72,5%, comparable à un GPT-3 175B (~73%)

### V-STaR: former un vérificateur avec le DPO

Les STaR rejettent les rationales incorrectes. Hosseini et coll. (2024) ont observé que ce sont aussi des données: chaque paire de (rationale, "est-ce correct") peut former un vérificateur. Ils utilisent l'optimisation des préférences directes sur les solutions correctes et incorrectes pour construire un classement.

Delta déclaré: +4 à +17 points de pourcentage par rapport aux lignes de base précédentes d'auto-amélioration sur GSM8K et MATH, la plupart des gains provenant de l'utilisation du vérificateur pour la sélection du temps d'inférence plutôt que pour la mise au point fine supplémentaire du générateur.

### Quiet-STaR: rationaux internes par jeton

Zelikman et coll. (2024) ont demandé: que se passe-t-il si le modèle apprend à générer une courte rationalisation interne à chaque position de jeton, pas seulement entre problème et réponse? Quiet-STaR entraîne un modèle à émettre une "pensée" cachée avant chaque jeton prédit, puis mélange la prédiction consciente de la pensée avec la prédiction de base via un poids appris.

Résultat: Mistral 7B a obtenu des améliorations absolues de zéro coup sur GSM8K de 5,9% à 10,9% et CommonsenseQA de 36,3% à 47,2% sans ajustement spécifique à la tâche.

### Pourquoi les trois ont- ils un souci commun pour la sécurité ?

Les trois méthodes utilisent la réponse finale comme le signal de gradient. Une logique qui atteint la bonne réponse par un raisonnement erroné  exploitant un raccourci, devinant ou utilisant un schéma non généralisant  est renforcée positivement. Sur les problèmes de distribution, le raccourci fonctionne. Sur les problèmes de distribution, il se brise silencieusement.

Le vérificateur de V-STaR atténue en apprenant à classer les rationales, mais le vérificateur est formé sur le même ensemble d'étiquettes. Il peut apprendre à préférer le raisonnement incorrect bien formaté à l'incertitude honnête. La conception plus sûre consiste à combiner les données de style STaR avec (a) des modèles de récompense supervisés par le processus (récompenser les étapes intermédiaires, pas seulement les réponses) et (b) une évaluation OOD prolongée qui rompt des raccourcis simples.

### Comparaison

| Method | Training signal | Inference cost | Data waste | Known failure mode |
|---|---|---|---|---|
| STaR | keep (rationale, answer) if correct | 1x | discards all incorrect rationales | shortcut rationales |
| STaR + rationalization | above + correct-answer hinted retries | 1x | less | rationalized rationales may be implausible |
| V-STaR | STaR + DPO verifier from both classes | Nx (best-of-N) | minimal | verifier can reinforce confident wrongness |
| Quiet-STaR | per-token rationale + mixing weight | 1.5-3x | minimal | still answer-conditioned gradient |

### Là où cela se trouve dans la pile 2026

Le STAR est vieux. Mais le modèle réapparaît partout en 2025-2026. RL sur les problèmes mathématiques vérifiables (DeepSeek-R1, Kimi-k1.5, o1) est le signal de gradient de réponse conditionné de STaR, augmenté. Les modèles de récompense des processus (Lightman et coll., 2023; "Vérifions étape par étape" d'OpenAI) sont l'alternative supervisée par le processus. AlphaEvolve (leçon 3) est STaR pour le code, avec un évaluateur de programme au lieu d'une étiquette. Darwin Godel Machine (Légion 4) est STaR pour l'échafaudage agent lui-même.

Comprendre le STaR fait tous ces clics. C'est la boucle d'auto-amélioration minimale viable.

```figure
reflection-loop
```

## Utilisez-le

`code/main.py`Il utilise une boucle STaR simulée sur une tâche arithmétique de jouet.

- Comment la précision surpasse les tirs de lance-tampons.
- Comment les raccourcis se glissent: le simulateur comprend une classe de logiciels "farouches" qui obtient la bonne réponse 40% du temps mais généralise mal.
- Comment un vérificateur (style V-STaR) aide à l'inférence mais ne peut pas éliminer complètement les raccourcis introduits lors de la formation.

## La faire partir

`outputs/skill-star-loop-reviewer.md`vous aide à vérifier un projet de logiciel de raisonnement autodidacte avant de vous entraîner à le faire.

## Exercices

1. Exécutez le simulateur. Définissez la fréquence de raccourci à zéro, puis à 0,4. Quelle est la différence de précision finale entre les deux courses, même si les deux atteignent > 90% sur la distribution de l'entraînement?

2. Ajoutez un test OOD prolongé au simulateur. Découvrez les problèmes d'une distribution différente et évaluez le modèle démarré sur les ensembles en distribution et OOD. Quantifiez l'écart.

3. Lisez le papier Quiet-STaR (arXiv:2403.09629) Section 3. Expliquez le jeton "fin de la pensée" et la tête de poids de mélange en trois phrases chacune.

4. Comparer le filtre de conservation de la qualité de STaR à une alternative supervisée par le processus qui récompense chaque étape rationnelle de manière indépendante.

5. Conception d'une évaluation qui capturerait les rationales des raccourcis dans un modèle déployé.

## Les termes clés

| Term | What people say | What it actually means |
|---|---|---|
| STaR | "Self-Taught Reasoner" | Fine-tune on model-generated rationales that land correct answers; repeat |
| Rationalization | "Hinted retry" | Inject the correct answer and re-prompt for a rationale on problems the base model fails |
| V-STaR | "Verifier STaR" | DPO-train a verifier on both correct and incorrect rationales, use it for inference-time selection |
| Quiet-STaR | "Per-token rationales" | Generate hidden thoughts at every token position; mix with baseline prediction |
| Answer-conditioned gradient | "Outcome-based signal" | The training loop rewards final answers, not reasoning steps |
| Process reward model | "Step-level verifier" | Reward model trained on per-step correctness, not outcome — contrasts with STaR |
| Shortcut rationale | "Right answer, wrong reasoning" | A rationale that reaches the label via a non-generalizing pattern; STaR keeps these |

## Pour en savoir plus

- [Zelikman et al. (2022). STaR: Bootstrapping Reasoning With Reasoning](https://arxiv.org/abs/2203.14465) le papier original.
- [Hosseini et al. (2024). V-STaR: Training Verifiers for Self-Taught Reasoners](https://arxiv.org/abs/2402.06457) ajoute un vérificateur DPO pour la sélection du temps d'inférence.
- [Zelikman et al. (2024). Quiet-STaR: Language Models Can Teach Themselves to Think Before Speaking](https://arxiv.org/abs/2403.09629) rationales internes par jeton.
- [Lightman et al. (2023). Let's Verify Step by Step](https://arxiv.org/abs/2305.20050) modèles de récompense de processus, le signal de gradient alternatif.
- [DeepSeek-R1 paper (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) RL sur les tâches vérifiables, STaR étendu à la formation frontalière.
