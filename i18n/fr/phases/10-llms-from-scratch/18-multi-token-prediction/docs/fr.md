# Prédiction multi-tokens (MTP)

> Chaque LLM autorégressif de GPT-2 à Llama 3 est à une perte par position: prédire le prochain jeton. DeepSeek-V3 a ajouté une deuxième perte par position: prédire le jeton après cela. Les paramètres 14B supplémentaires (sur un modèle 671B) ont été distillés dans le modèle principal par le débit de gradient, et les têtes MTP formées ont été réutilisées à l'inférence comme des dessinateurs de décoding spéculatif avec une acceptation de 80%+. La capacité de 1,8 fois de génération est gratuite. Cette leçon construit le module MTP séquentiel du rapport technique DeepSeek, calcule la perte et la disposition des paramètres de tête partagée, et explique pourquoi MTP conserve la chaîne causale alors que le MTP parallèle original de Gloeckle et al. l'a cassé.

**Type:** Build
**Languages:** Python (stdlib), Rust
**Prerequisites:** Phase 10 · 04 (pre-training a mini GPT), Phase 10 · 15 (speculative decoding)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Indiquer l'objectif de formation MTP et déduire la perte commune sur les profondeurs de prédiction.
- Expliquez la différence entre les têtes MTP parallèles de Gloeckle et coll. (2024) et les modules MTP séquentiels de DeepSeek-V3 et expliquez pourquoi la conception séquentielle préserve la chaîne causale.
- Comptez le paramètre et le coût de la mémoire de l'ajout de modules MTP à une course de pré-entraînement.
- Mettre en œuvre un module MTP à partir de zéro: l'intégration partagée, le bloc transformateur par profondeur, la projection et la tête de sortie partagée.

## Le problème

La prédiction du prochain jeton est l'objectif standard de formation LLM. Chaque état caché est supervisé pour prédire exactement une chose: le jeton immédiatement suivant. C'est un signal étonnamment faible. La plupart des informations d'une séquence dépassent une structure, une cohérence, une réalité, un flux arithmétique. Le modèle doit les apprendre en accumulant de nombreux signaux d'un seul jeton sur des milliards de jetons.

MTP demande: et si chaque état caché était supervisé pour prédire plusieurs tokens futurs à la fois ? Le produit est le produit de l'industrie de l'industrie de l'électricité. (Meta, 2024) a montré que cela aide. Leur mise en œuvre a placé plusieurs têtes de sortie indépendantes sur le dos de la colonne vertébrale, chacune prédisant un décalage différent. Parallèlement, simple, mais les têtes ont vu le même état caché sans aucune affinité hiérarchique et les prédictions ne se sont pas chaînées causellement, de sorte qu'elles ne pouvaient pas être utilisées pour le décoding spéculatif.

DeepSeek-V3 (décembre 2024) a redessiné MTP en tant que modules séquentiels qui maintiennent la chaîne causale à chaque profondeur de prédiction.`t+1`de `h_i^(0)`, puis prédit .`t+2`De l' état caché .`h_i^(1)`qui combiné `h_i^(0)`avec le `E(t+1)`Chaque profondeur est son propre petit bloc transformateur. L'intégration partagée et la tête de sortie partagée maintiennent modeste le paramètre de décomposition. À l'échelle de DeepSeek-V3, 14B paramètres supplémentaires sur les modules MTP en plus des poids du modèle principal 671B. Ce 2% de décomposition achète des signaux d'entraînement plus denses ET un projet de décoding spéculatif prêt à l'inférence.

Cette leçon construit un seul module MTP et la perte de profondeur D à partir de zéro.

## Le concept

### La recette MTP séquentielle

DeepSeek-V3 ajoute `D`Les modules MTP sur le modèle principal.`t_{i+1}`- Chaque module`k`(pour `k = 1..D`) prédit le symbole `k`pas plus loin, `t_{i+k+1}`, avec un préfixe par position `i`- Je suis désolé .

Module `k`est composé de:

- Un bloc de transformateur `T_k`avec son propre attention et MLP.
- Une matrice de projection `M_k`qui combine l'état caché de profondeur précédent avec l'intégration du symbole de vérité de fond de profondeur suivant.
- L' intégration partagée `E`(même que le modèle principal).
- Le chef de sortie partagé `Out`(même que le modèle principal).

En formation, pour un préfixe par position `i`, l' état caché par profondeur est:

```math
\begin{aligned}
h_i^{(0)} &= \text{main model backbone at position } i \\
h_i^{(k)} &= T_k\Big( M_k \cdot \mathop{\mathrm{concat}}\big(\mathop{\mathrm{RMSNorm}}(h_i^{(k-1)}), \mathop{\mathrm{RMSNorm}}(E(t_{i+k}))\big) \Big) \quad \text{for } k \ge 1
\end{aligned}
```

La prédiction par profondeur est:

```math
\text{logits}_{i+k+1} = \mathop{\mathrm{Out}}(h_i^{(k)}) \quad \text{for } k = 1, \ldots, D
```

La perte de profondeur est une entropie croisée contre la vérité fondamentale .`t_{i+k+1}`- Le numéro de la liste:

```math
L_k = \mathop{\mathrm{CE}}(\text{logits}_{i+k+1}, t_{i+k+1})
```

La perte articulaire à travers les profondeurs:

```math
L_{\text{MTP}} = \frac{\lambda}{D} \sum_{k=1}^{D} L_k
```

`lambda`Le coefficient de pondération est faible  DeepSeek-V3 utilise 0,3 pour les 10% de formation et 0,1 après.`L_main + L_MTP`- Je suis désolé .

### Pourquoi séquentielle, pas parallèle

Le MTP parallèle original de Gloeckle avait des têtes de sortie D, chacune directement appliquée à `h_i^(0)`Chaque tête prédit .`t_{i+k}`C'est bien, mais les prédictions ne sont pas conditionnées l'une sur l'autre.`head_1`- La sortie pour aider .`head_2` les têtes tirent en parallèle.

Le design séquentiel de DeepSeek-V3 construit `h_i^(k)`de `h_i^(k-1)`plus l' intégration réelle du jeton suivant `E(t_{i+k})`- C' est la chaîne de causalité .`t_{i+k+1}`, le module à profondeur `k`Il voit ce qui se passe .`t_{i+k}`.Cela est structurellement identique à la façon dont un décodeur autorégressif consomme sa propre sortie, ce qui rend les modules MTP directement utilisables comme dessinateurs de décodeurs spéculatifs.

À la conclusion: fourrage `h_i^(k-1)`et le projet `t_{i+k}`dans le module `k`, obtenir une prédiction pour `t_{i+k+1}`C'est exactement un projet de style EAGLE, en utilisant le module MTP formé comme le projet de réseau. DeepSeek-V3 rapporte une acceptation de plus de 80% sur le premier module MTP et une accélération de ~1,8x.

### Comptabilité des paramètres

Pour un modèle avec caché `h`et le vocabulaire `V`- Le numéro de la liste:

- Modèle principal: milliards de paramètres, plus une tête de sortie de taille `V * h`- Je suis désolé .
- Cap de sortie partagée: réutiliser la tête du modèle principal.
- Embedding partagé: réutiliser l'embedding du modèle principal.
- Module par MTP:
  - La projection `M_k`Le numéro de la liste:`(2h) * h = 2h^2`- Je suis désolé .
  - Bloc de transformateur `T_k`Attention (`4h^2`pour MHA) plus MLP (généralement `8h^2`pour SwiGLU avec un rapport de 8/3).`12h^2`par bloc.

Total supplémentaire par module: `~14h^2`Pour les DeepSeek-V3.`h = 7168`, D = 1 module: `~14 * 7168^2 = ~720M`Les paramètres sur papier. DeepSeek-V3 rapporte 14B  la différence est principalement des couches d'experts étant MoE dans le module MTP aussi.

### Le paiement de décoding spéculatif

Pendant la pré-entraînement, les modules MTP ralentissent l'entraînement d'environ 10% (plus de calculs avancés, plus de pertes).

1. Signal d'entraînement de densité. Chaque état caché voit des cibles de surveillance D+1. Effets mesurés sur MMLU, GSM8K, MATH, HumanEval: améliorations constantes de quelques points de pourcentage dans les ablations de DeepSeek-V3.

2. Le module MTP est déjà formé pour prédire les prochains jetons. Résumé réseau, il fournit 80% + taux d'acceptation. À ce niveau, N = 3 ou N = 5 spécification décoding donne 1,8 × débit. Le coût de formation de 10% de temps se rembourse la première fois que vous exécutez une inférence.

### Relation avec l'AIGLE

L'Eagle entraîne séparément un petit modèle de projet après la pré-formation.

| Dimension | EAGLE-3 | MTP (DeepSeek-V3) |
|-----------|---------|------------------|
| When trained | Post-pre-training | During pre-training |
| Backward-compatible with existing weights | Yes | No (need to re-train) |
| Draft params | 1-2 transformer layers | 1 transformer block + projection |
| Acceptance rate | 0.88-0.92 | 0.80+ at depth 1 |
| Benefit beyond speedup | Speculative decoding only | Denser training signal + speedup |

```figure
multi-token-predict
```

## Faites-le

`code/main.py`Il construit un seul module MTP de bout en bout: intégration partagée, projection, bloc transformateur, tête de sortie partagée. Il calcule ensuite la perte de l'entropie croisée par profondeur sur une courte séquence synthétique et imprime le nombre de paramètres par composant. Un vocabulaire de jouets de 32 jetons garde les nombres lisibles.

### Étape 1: Table d'intégration partagée

Une seule .`vocab_size x hidden`La table est utilisée par le modèle principal ET par chaque module MTP à chaque profondeur.

### Étape 2: la combinaison par profondeur

```python
def combine(prev_hidden, next_token_embed, M_k):
    # concat along feature dim, then project down to hidden
    concat = rms_norm(prev_hidden) + rms_norm(next_token_embed)  # vector addition stand-in
    projected = matvec(M_k, concat)
    return projected
```

Réel DeepSeek-V3 concatenant les deux vecteurs RMSNormed à `[2h]`et des projets avec un`h x 2h`Le jouet utilise l'addition vectorielle pour la brèveur stdlib.

### Étape 3: le bloc de transformateur à la profondeur k

L'auto-attention plus le MLP. Dans le jouet, un bloc d'attention linéaire à couche unique et un SwiGLU MLP gardent la structure visible sans numpy.

### Étape 4: la tête de sortie partagée

Reutilisez la projection de sortie du modèle principal.

### Étape 5: Perte par profondeur

Entropie croisée de softmax (logits) contre le jeton de vérité au sol à compensation `k+1`- Aggreger à travers les profondeurs avec le`lambda / D`facteur d'échelle.

### Étape 6: comptabilité des paramètres

Imprimez le nombre total de paramètres, le nombre partagé (intégration, tête) et le nombre supplémentaire par module. Affichez le rapport entre MTP supplémentaire et taille du modèle principal.

## Utilisez-le

MTP est intégré à DeepSeek-V3 (décembre 2024) et à la série DeepSeek-R1.

- La pile de serveurs de DeepSeek consomme des modules MTP comme décodeurs spéculatifs hors de la boîte.
- VLLM et SGLang ont des voies d'intégration pour DeepSeek-V3 MTP à compter d'avril 2026.
- Le tutoriel ROCm SGLang d'AMD montre une configuration spécifique de décoding spéculatif MTP avec une vitesse mesurée de 1,8 fois sur le point de contrôle V3.

Quand utiliser MTP dans une nouvelle course pré-entraînement:

- Vous contrôlez le pipeline de formation et vous voulez un signal d'entraînement plus dense.
- Vous savez que vous allez servir le modèle à l'échelle et voulez le décoding spéculatif gratuitement.
- Votre taille cachée est au moins 4096.

Quand ne pas:

- - l'ajustement de l'état de la machine à sous, le module MTP n'est pas formé.
- Les modèles de recherche où vous voulez une ligne de base propre à comparer.

## La faire partir

Cette leçon produit `outputs/skill-mtp-planner.md`. Compte tenu d'une spécification préalable à la formation (taille du modèle, données, calcul), il renvoie un plan d'intégration de MTP: nombre de profondeurs D, `lambda`le calendrier, le débit de mémoire et le câblage de décodage spéculatif de l'inférence-temps.

## Exercices

1. On court .`code/main.py`.Montrez que la perte par profondeur diminue de manière monotone à mesure que le signal synthétique se renforce.Modifiez le synthétique pour utiliser un schéma fixe et vérifiez la convergence des pertes de profondeur-1 et de profondeur-2.

2. Comparer le coût de chargement des paramètres pour un modèle dense 70B (casqué 8192, 80 couches) avec un module MTP D = 1. Comparer avec le coût de chargement 14B rapporté par DeepSeek-V3. Expliquez pourquoi le nombre de DeepSeek est plus élevé: le bloc de transformateur MTP hérite de la même structure MoE, gonflant le nombre de paramètres par module.

3. Implémentation D=2 dans le jouet: ajouter un deuxième module MTP qui prend $h^{(1)}$et prédit .`t_{i+3}`Vérifiez que la perte commune et la comptabilité des paramètres correspondent aux équations 19 à 21 du document DeepSeek.

4. Transférez le jouet en MTP parallèle (style Gloeckle): ajoutez des têtes de sortie D au-dessus de l'état caché principal, chacune prédisant un décalage différent. Mesurez comment les pertes par profondeur se comparent à la version séquentielle sur le même signal synthétique. La version séquentielle devrait produire une perte de profondeur de plus faible pour k > 1 car elle conditionne les prédictions intermédiaires.

5. Utilisez le module MTP formé comme un projet de style EAGLE: appelez le module k pour proposer `t_{i+k+1}`Si vous atteignez 50%+ sur le jouet, vous avez reproduit la propriété empirique MTP-as-draft.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MTP module | "Extra loss block" | A small transformer block plus projection that predicts a token `k` positions ahead of the main model |
| Prediction depth | "Which offset" | The integer `k` such that module `k` predicts `t_{i+k+1}` from prefix through position `i` (the main model is depth 0 and predicts `t_{i+1}`) |
| Parallel MTP | "Gloeckle-style" | D independent heads on the same backbone hidden state, no conditional chain |
| Sequential MTP | "DeepSeek-V3 style" | Each module conditions on the previous depth's hidden state plus the next token's embedding; preserves causal chain |
| Shared output head | "Reuse the main head" | The MTP modules call the main model's LM head, not a separate output projection |
| Shared embedding | "Reuse the main table" | Same vocabulary embedding table is used everywhere; no duplicate parameters |
| Projection matrix $M_k$ | "Combine hidden + next-token" | An `h x 2h` linear layer that folds the previous hidden state and the target-token embedding into the next depth's input |
| Joint loss $L_{\text{MTP}}$ | "Averaged extra losses" | Arithmetic mean of per-depth cross-entropy losses, scaled by `lambda` |
| Acceptance rate at depth 1 | "How often MTP draft is right" | The rate at which the D=1 MTP module's top-1 prediction equals the main model's top-1 prediction; 80%+ on DeepSeek-V3 |
| Lambda weighting | "Extra-loss importance" | Per-depth scaling factor; 0.3 at start of training, 0.1 later on DeepSeek-V3 |

## Pour en savoir plus

- [DeepSeek-AI — DeepSeek-V3 Technical Report (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437) la description complète du MTP séquentiel (section 2.2), y compris les équations de perte articulaire et la vitesse de 1,8 fois à l'inférence
- [Gloeckle et al. — Better & Faster Large Language Models via Multi-token Prediction (arXiv:2404.19737)](https://arxiv.org/abs/2404.19737) la ligne de base parallèle MTP
- [DeepSeek-V3 model card on Hugging Face](https://huggingface.co/deepseek-ai/DeepSeek-V3) 685 B au total (671 B principal + 14 B MTP), notes de déploiement
- [Leviathan et al. — Fast Inference from Transformers via Speculative Decoding (arXiv:2211.17192)](https://arxiv.org/abs/2211.17192) le cadre de décoding spéculatif MTP s'intègre dans
- [Li et al. — EAGLE-3 (arXiv:2503.01840)](https://arxiv.org/abs/2503.01840) L'architecture de projet de 2025 de l'Eagle, l'équivalent MTP, est en concurrence avec
