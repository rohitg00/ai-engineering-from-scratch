# Décodage spéculatif et Eagle

> Un LLM frontalier générant un jeton nécessite un passage complet à l'avance sur des milliards de paramètres. Ce passe avant est massiquement surprovisionné: la plupart du temps, un modèle beaucoup plus petit peut deviner les 3-5 prochains jetons correctement, et le grand modèle ne doit que * vérifier * la devinette. Si la devinette est correcte, vous avez 5 jetons au prix d'un. Décodage spéculatif (Leviathan et coll. 2023) a fait exactement cela, et EAGLE-3 (2025) a poussé les taux d'acceptation à ~ 4,5 jetons par vérifier  un accélération de 4-5 fois à la distribution de sortie correspondante.

**Type:** Build
**Languages:** Python (with numpy)
**Prerequisites:** Phase 10 Lesson 12 (Inference Optimization), Phase 10 Lesson 04 (Pre-training Mini-GPT)
**Time:** ~75 minutes

## Le problème

Le décodage pour un modèle de classe 70B sur H100 est généralement de 40 à 80 jetons / seconde. Chaque jeton nécessite un décodage complet en avant qui lit tous les poids du modèle de HBM. Vous ne pouvez pas réduire le modèle sans modifier sa sortie. Vous ne pouvez pas augmenter la taille du lot au-delà de la mémoire. Vous êtes coincé  à moins que vous puissiez laisser le modèle produire plus d'un jeton par décodage.

La génération autorégressive est intrinsèquement sérieuse:`x_{t+1} = sample(p(· | x_{1:t}))`Si vous aviez un prédicteur bon marché qui disait "les 4 prochains jetons sont probablement [a, b, c, d]" vous pourriez vérifier les 5 positions dans un**single forward pass of the big model**et acceptez le préfixe correspondant le plus long.

Leviathan, Kalai, Matias (2023, "Inference rapide des transformateurs via décoding spéculatif") a fait cela exactement via une règle intelligente d'acceptation / rejet qui préserve la distribution d'échantillonnage du modèle cible.

## Le concept

### La configuration des deux modèles

- **Target model** `M_p`Le modèle grand, lent et de haute qualité dont vous voulez des échantillons.`p(x)`- Je suis désolé .
- **Draft model** `M_q`: un modèle petit, rapide et de qualité inférieure.`q(x)`5 à 30 fois plus petit.

Par étape:

1. Projet de modèle proposé `K`Les jetons autorégressifs: `x_1, x_2, ..., x_K ~ q`- Je suis désolé .
2. Le modèle cible passe un pas en avant sur tout .`K+1`Les positions parallèles, produisant `p(x_k)`pour chaque jeton proposé.
3. Acceptez/reject chaque jeton de gauche à droite via la règle de rejet modifiée ci-dessous. Acceptez le préfixe correspondant le plus long.
4. Si un jeton est rejeté, prenez le remplacement de la distribution corrigée et arrêtez.`p(· | x_1...x_K)`- Je suis désolé .

Si le projet correspond parfaitement à la cible, vous obtenez des jetons K + 1 par cible-avant. Si le projet est faux à la position 1, vous obtenez seulement 1 jeton.

### La règle de l'exactitude

Le décodeur spéculatif est **provably equivalent in distribution to sampling from p**- La règle du rejet:

```
For each drafted token x_t:
    r ~ Uniform(0, 1)
    if r < p(x_t) / q(x_t):
        accept x_t
    else:
        sample replacement from residual: (p - q)+ / ||(p - q)+||_1
        stop
```

où `(p - q)+`La différence de point est la partie positive de la différence de point.`p ≈ q`) l'acceptation est proche de 1. Lorsqu'ils sont en désaccord, la répartition résiduelle est construite de manière à ce que l'échantillon global soit toujours exact `p`- Je suis désolé .

**Greedy case.**Pour l'échantillonnage de température = 0, vérifiez simplement `argmax(p) == x_t`Si oui, acceptez; si non, sortez.`argmax(p)`et arrête.

### Accélération attendue

Si le taux d'acceptation au niveau des jetons du modèle de projet est `α`, les jetons attendus produits par passe cible sont:

```math
\mathbb{E}[\text{tokens}] = \frac{1 - \alpha^{K+1}}{1 - \alpha} \qquad K = \text{draft length}, \ \alpha \in [0, 1]
```

À `α = 0.8, K = 4`Le numéro de la liste:`(1 - 0.8^5)/(1 - 0.8) = 3.36`Les prix de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de`cost_q * K + cost_p`(K étapes de projet plus une vérification de l' objectif).`cost_p >> cost_q * K`le ratio d'accélération est `3.36× / 1 = 3.36×`sur le débit.

Le seul vrai paramètre est `α`Une bonne ébauche est tout.

### Formation du projet: Destilation

Un modèle aléatoire fait un mauvais dessin.

1. Choisissez une architecture petite (~1B pour une cible 70B, ~500M pour une cible 7B).
2. Exécutez le modèle cible sur un grand corpus de texte; stocker ses distributions de jetons suivants.
3. Prenez le projet avec la divergence KL contre la distribution de la cible (et non contre les jetons de vérité de base).

Le résultat: `α`En général, 0,6-0,8 pour le codage, 0,7-0,85 pour le chat en langage naturel.

### ÉGLE: dessin d'arbres + réutilisation des caractéristiques

Li, Wei, Zhang, Zhang (2024, "AIGLE: Le prélèvement d'échantillons spéculatifs nécessite une révision de l'incertitude des caractéristiques") ont observé deux inefficacités dans le décoding spéculatif standard:

1. Le projet fait K étapes de série, chaque pile complète. Mais le projet pourrait réutiliser les caractéristiques de la cible (états cachés) de la vérifier la plus récente  la cible déjà calculé représentations riches que le projet est dérivé à nouveau de zéro.
2. Le projet produit une chaîne linéaire. Si le projet pouvait produire un arbre de candidats (chaque nœud multiples devinettes), le passage unique vers l'avant de la cible pourrait vérifier plusieurs chemins de candidats en parallèle via un masque d'attention à l'arbre, et choisir la branche la plus longue acceptée.

Changements de l'Eagle-1:
- Entrée de projet = état caché final de la cible à la position t, pas de jetons bruts.
- Architcture de projet = 1 couche de décodeur de transformateur (pas un petit modèle séparé).
- Résultats = arbre de K = 4-8 candidats par profondeur, profondeur 4-6.

L'AIGLE-2 (2024) ajoute une topologie dynamique des arbres: l'arbre s'élargit là où le projet est incertain et reste étroit là où il est sûr.`α_effective`sans augmenter le coût de vérification.

L'AIGLE-3 (Li et coll. 2025, "EAGLE-3: Accélération de l'inférence des grands modèles linguistiques via Test de formation-temps") élimine la dépendance fixe des fonctionnalités de la couche supérieure et entraîne le projet avec une nouvelle perte de "simulation de temps de test"  le projet est formé sur des résultats qui correspondent à la distribution du temps de test de la cible plutôt que la distribution de formation forcée par l'enseignant. Le taux d'acceptation passe de 0,75 (EAGLE-2) à 0,82 (EAGLE-3), et le taux moyen de jetons/vérification passe de 3,0 à 4,5. Ces chiffres proviennent d'une seule configuration de référence. L'acceptation dépend de la paire de modèles, de l'arbre de projet et du trafic: la phase 10 · 15 cite 0,88 à 0,92 par jeton de chemin accepté sur les benchmarks de chat, et la phase 17 · 05 des plans avec 0,6 à 0,8 sur le chat général de production.

### Vérifie l'attention des arbres

Lorsque le projet produit un arbre, le modèle cible le vérifie en un seul passage vers l'avant en utilisant une **tree attention mask** un masque causale qui encode la topologie de l'arbre plutôt que d'une ligne pure. Chaque jeton ne sert que ses ancêtres dans l'arbre. Le passe de vérification est toujours un avant, un matmul; le masque topologique ne coûte que quelques entrées KV supplémentaires.

```
        root
       /    \
      a      b
     / \    / \
    c  d   e   f
```

Si vous`a, b`sont en compétition des candidats à la première marque et `c, d, e, f`Les deux positions sont vérifiées en une seule passe avant.

### Quand il gagne, quand il ne gagne pas

**Wins:**
- Chat / termination avec un texte prévisible (code, anglais commun, sortie structurée). `α`C'est élevé.
- Par défaut, la fonctionnalité de la carte graphique est la même que celle de la carte graphique.

**Loses / no win:**
- Exécutions très stochastiques (écriture créative à haute température). `α`Il descend vers `1/|vocab|`- Je suis désolé .
- Les lots servent avec une simultanée très élevée  les lots remplissent déjà les FLOP, peu de place pour la vérification des arbres.
- Très petits modèles cibles où le projet n'est pas beaucoup plus petit.

Les magasins de production rapportent généralement une accélération de 2-3 fois par rapport à l'horloge murale sur le chat, 3-5 fois par rapport à la génération de code et presque nul sur l'écriture créative.

```figure
speculative-decoding
```

## Faites-le

`code/main.py`- Le numéro de la liste:

- Une référence `speculative_decode(target, draft, prompt, K, temperature)`qui met en œuvre la règle de rejet exacte et qui vérifie qu'elle préserve la distribution de la cible (échantillonnage empirique KL < 0,01 contre cible simple).
- Un dessinateur d'arbres à la mode de l'AIGLE qui construit un arbre de profondeur K avec branches de haut en bas.
- Un constructeur de masque d'attention à l'arbre qui produit le bon modèle de causalité pour un vérificateur.
- Un harnais de taux d'acceptation qui fonctionne à la fois sur un petit LM (destille un GPT-2-petit d'une cible moyenne GPT-2).

```python
def speculative_step(p_target, q_draft, K, temperature=1.0):
    """One round of speculative decoding. Returns list of accepted tokens."""
    # 1. Draft K tokens
    draft_tokens = []
    q_dists = []
    state = draft_state_init()
    for _ in range(K):
        probs = softmax(q_draft(state) / temperature)
        t = np.random.choice(len(probs), p=probs)
        draft_tokens.append(t)
        q_dists.append(probs)
        state = draft_step(state, t)

    # 2. Target computes p at every drafted position + 1 extra
    p_probs_all = target_forward_batched(p_target, draft_tokens, temperature)

    # 3. Accept/reject left-to-right
    accepted = []
    for k, tok in enumerate(draft_tokens):
        r = np.random.uniform()
        if r < p_probs_all[k][tok] / q_dists[k][tok]:
            accepted.append(tok)
        else:
            residual = np.maximum(p_probs_all[k] - q_dists[k], 0)
            residual /= residual.sum()
            accepted.append(np.random.choice(len(residual), p=residual))
            return accepted
    # 4. All K accepted → sample bonus token from target
    accepted.append(np.random.choice(len(p_probs_all[-1]), p=p_probs_all[-1]))
    return accepted
```

## Utilisez-le

- **vLLM**et **SGLang**Le code de déchiffrement de la première classe du navire.`--speculative-config`un objet JSON avec `method`- Je suis là .`model`, et `num_speculative_tokens`; l' Eagle-3 est `"method": "eagle3"`- Je suis désolé .
- **NVIDIA TensorRT-LLM**soutient les arbres de Medusa et Eagle de manière indigène.
- **Reference draft models**Le numéro de la liste:`Qwen/Qwen3-0.6B`(projets de Qwen3-32B), `meta-llama/Llama-3.2-1B-Instruct`(projet de Llama 3.x 70B).
- **Medusa heads**(Cai et coll. 2024, "Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads"): au lieu d'un modèle de projet, ajoutez des têtes de prédiction parallèles K à la cible elle-même.

## La faire partir

Cette leçon produit `outputs/skill-speculative-tuning.md` une compétence qui décrit la charge de travail d'un modèle cible et choisit: modèle de projet, K (longueur du projet), largeur de l'arbre, température et moment de revenir au décodeur ordinaire.

## Exercices

1. Appliquez la règle exacte de rejet et vérifiez-la empiriquement.`speculative_decode`et par l'échantillonnage cible simple; calculer la distance TV entre les deux distributions de sortie.

2. Compute la formule de l'accélération.`α`et `K`, tracez les jetons attendus par cible-avant.$K$pour $\alpha \in \lbrace 0.5, 0.7, 0.9 \rbrace$- Je suis désolé .

3. Prenez une cible de 124 M et distillez une cible de 30 M sur 100 M.`α`Les résultats de l'enquête ont été obtenus en fonction des résultats obtenus.

4. Mettez en œuvre la rédaction d'arbres à la manière d'EAGLE. Au lieu d'une chaîne, faites en sorte que la rédaction de sortie soit en trois branches supérieures à chaque profondeur. Construisez le masque d'attention de l'arbre. Vérifiez que la cible accepte la branche correcte la plus longue.

5. Mesurer les modes d'échec. Exécuter le décode spéculatif à température = 1,5 (haute stochastique). Afficher α s'effondre et l'algorithme est plus lent que le décode normal en raison du dépôt de dépôt.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Target model | "The big model" | The slow, high-quality model you want samples from (p distribution) |
| Draft model | "The speculator" | The small, fast predictor (q distribution); 5-30x smaller |
| K / draft length | "Look-ahead" | Number of speculated tokens per verify pass |
| α / acceptance rate | "Hit rate" | Per-token probability that the draft's proposal is accepted |
| Exact rejection rule | "The accept test" | r < p/q compare that preserves target's distribution |
| Residual distribution | "Corrected p-q" | (p - q)+ / ||(p - q)+||_1, the distribution to sample from on rejection |
| Tree drafting | "Branching speculation" | Draft outputs a tree of candidates, verified in one pass with tree-structured attention mask |
| Tree attention mask | "Topological mask" | Causal mask encoding the tree topology so each node attends only to its ancestors |
| Medusa heads | "Parallel heads" | K extra prediction heads on the target itself; no separate draft model |
| EAGLE feature reuse | "Hidden-state draft" | Draft input is target's last hidden state, not raw tokens, shrinking the draft |
| Test-time simulation loss | "EAGLE-3 training" | Train draft on outputs matching target's test-time distribution, not teacher forcing |

## Pour en savoir plus

- [Leviathan, Kalai, Matias, 2023 — "Fast Inference from Transformers via Speculative Decoding"](https://arxiv.org/abs/2211.17192) la règle exacte du rejet et l'analyse théorique de l'accélération
- [Chen, Borgeaud, Irving et al., 2023 — "Accelerating Large Language Model Decoding with Speculative Sampling"](https://arxiv.org/abs/2302.01318) papier d'échantillonnage spéculatif en même temps chez DeepMind
- [Cai, Li, Geng, Wang, Wang, Zhu, Dao, 2024 — "Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads"](https://arxiv.org/abs/2401.10774) Les têtes parallèles alternatives à un modèle de projet
- [Li, Wei, Zhang, Zhang, 2024 — "EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty"](https://arxiv.org/abs/2401.15077) réutilisation des caractéristiques et dessin d'arbres
- [Li et al., 2024 — "EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees"](https://arxiv.org/abs/2406.16858) Topologie dynamique des arbres
- [Li et al., 2025 — "EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test"](https://arxiv.org/abs/2503.01840) correspondance entre les heures de train et les heures d'essai
- [Fu, Haotian, Peng et al., 2024 — "Break the Sequential Dependency of LLM Inference Using Lookahead Decoding"](https://arxiv.org/abs/2402.02057) Décodage Jacobi/lookahead, une alternative sans spéculateur
