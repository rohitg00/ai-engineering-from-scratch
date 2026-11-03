# Décodage spéculatif  Définition, vérification, répétition

> Le décoding autorégressif est sériel. Chaque jeton attend le précédent. Le décoding spéculatif rompt la chaîne: un modèle bon marché rédige N jetons, le modèle cher vérifie tous N en un seul passe avant. Lorsque le projet est correct, vous payez un gros avant pour N générations.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 07 (GPT Causal LM), Phase 7 · 12 (KV Cache & Flash Attention)
**Time:** ~60 minutes

## Le problème

Un échantillonnage de 70B LLM d'un jeton prend ~ 30 ms sur un H100. Un modèle de projet 3B prend ~ 3 ms. Si nous laissons le projet 3B 5 jetons en avant, puis exécutez le 70B * une fois * pour vérifier tous les 5, le total est $5 \times 3 + 30 = 45$ms pour un maximum de 5 jetons acceptés  versus `5×30 = 150 ms`C'est le pitch complet du décoding spéculatif: échanger une petite quantité de mémoire de GPU supplémentaire (modèle de projet) pour une latence de décoding inférieure de 24x.

L'échantillonnage spéculatif, introduit par Leviathan et coll. (2023) et par Chen et coll. simultanément, garantit que la séquence de sortie est **identically distributed**Il n'y a pas de compromis de qualité, juste plus vite.

Quatre familles de paires de vérificateurs de projet dominent l'inférence 2026:

1. **Vanilla speculative (Leviathan 2023).**Modèle de projet séparé (p. ex. Llama 3 1B) + vérificateur (p. ex. Llama 3 70B).
2. **Medusa (Cai 2024).**Plusieurs têtes de décoding sur la position de prédiction du vérificateur `t+1..t+k`Pas de modèle de projet séparé.
3. **EAGLE family (Li 2024, 2025).**Draft léger qui réutilise les états cachés du vérificateur; taux d'acceptation plus proche que la vanille; 34× typique.
4. **Lookahead decoding (Fu 2024).**Je ne suis pas un modèle de projet, je ne suis pas une spéculation, je suis un peu dépendant.

Chaque pile d'inférence de production en 2026 envoie par défaut un décodeur spéculatif. vLLM, TensorRT-LLM, SGLang et llama.cpp prennent tous en charge au moins la vanille + EAGLE-2.

## Le concept

### L'algorithme de base

En raison d' un vérificateur $M_q$et un projet moins cher $M_p$- Le numéro de la liste:

1. Je vous laisse .$x_1 \ldots x_k$être le préfixe déjà décodé.
2. **Draft**: utilisation $M_p$à proposer de manière autorégressive $d_{k+1}, d_{k+2}, \ldots, d_{k+N}$avec des probabilités de projet $p_1 \ldots p_N$- Je suis désolé .
3. **Verify in parallel**: courir $M_q$Une fois de plus .$x_1 \ldots x_k, d_{k+1}, \ldots, d_{k+N}$, obtenir des probabilités de vérification $q_1 \ldots q_{N+1}$pour les positions $k+1 \ldots k+N+1$- Je suis désolé .
4. **Accept/reject each draft token left to right**: pour chacun $i$, accepter avec probabilité $\min(1, q_i(d_i) / p_i(d_i))$- Je suis désolé .
5. Au premier rejet à la position $j$: échantillon $t_j$de la distribution "résiduelle" $(q_j - p_j)_+$Tous les projets après$j$sont jetés.
6. En acceptant tout .$N$: échantillon d' un jeton supplémentaire $t_{N+1}$de $q_{N+1}$(le jeton bonus gratuit).

Le truc de distribution résiduelle est la compréhension mathématique qui maintient la sortie distribuée exactement comme si $M_q$J'avais pris des échantillons à partir de zéro.

### Ce qui détermine la vitesse

Je vous laisse .$\alpha$= taux d'acceptation attendu par jeton projet.$c$= rapport coût entre projet et vérificateur.

- La génération naïve fait un appel de modèle par jeton.
- La spéculative fait un appel de modèle par personne .$(1 - \alpha^{N+1}) / (1 - \alpha) \approx 1/(1-\alpha)$les jetons quand $\alpha$C'est élevé.

La règle typique est que $\alpha = 0.75$et $N = 5$Le coût du projet est 5 fois moins cher.

**$\alpha$ depends on:**

- La qualité de la rédaction approximative du vérificateur.$\alpha$- Il y a beaucoup de choses.
- Stratégie de décoding.$\alpha$- Prise d'échantillons à température: plus difficile à comparer; acceptation diminue.
- Type de tâche: le code et la sortie structurée acceptent plus (prévisible); l'écriture créative sous forme libre accepte moins.

### Medusa  projets sans modèle de projet

Medusa remplace le modèle de projet par des têtes de sortie supplémentaires sur le vérificateur.`t`- Le numéro de la liste:

```
shared trunk → hidden h_t
    ├── head_0: predict token at t+1  (standard LM head)
    ├── head_1: predict token at t+2
    ├── head_2: predict token at t+3
    ├── head_3: predict token at t+4
```

Chaque tête produit ses propres logits. À l'inférence, vous prenez un échantillon de chaque tête pour obtenir une séquence de candidats, puis vérifiez avec un passage vers l'avant en utilisant un schéma d'attention à l'arbre qui considère toutes les continuations de candidats à la fois.

Avantages: pas de deuxième modèle. inconvénients: ajoute des paramètres entraînables; nécessite une phase de réglage fin supervisée (~ 1B tokens); taux d'acceptation est un peu inférieur à la spéculative de vanille avec un bon projet.

### L'AIGLE  meilleur dessin en réutilisant les états cachés

EAGLE-1/2/3 (Li et al., 20242025) fait du modèle de projet un minuscule transformateur (typiquement 1 couche) qui absorbe les derniers états cachés de la couche du vérificateur. Parce que le projet voit la représentation des caractéristiques du vérificateur, ses prédictions sont fortement corrélées avec la distribution de sortie du vérificateur. Les taux d'acceptation passent de ~0,6 (vanille) à 0,85+. Ce sont des taux par jeton sur les benchmarks de chat, avec un projet formé sur les données de chat correspondantes. Pour le trafic de production mixte, la phase 17 · 05 prévoit 0,6 à 0,8 pour EAGLE-3, et le trafic de domaine peut être inférieur.

EAGLE-3 (2025) a ajouté la recherche d'arbres sur les continuations candidates. vLLM et SGLang ont utilisé EAGLE-2/3 comme voie de spécification par défaut pour Llama 3/4 et Qwen 3.

### La danse du cache KV

Feeds de vérification $N$Les jetons de projet dans le vérificateur en un seul passage.$N$Si certains projets sont rejetés, vous devez faire glisser le cache à la longueur du préfixe accepté.

Les actions de production (vLLM) `--speculative-config`Je suis en train de faire une réflexion sur le sujet, et je suis en train de faire une réflexion sur le sujet.

```figure
draft-verify-tokens
```

## Faites-le

Regardez !`code/main.py`Nous mettons en œuvre l' algorithme de prélèvement de l' échantillonnage spéculatif de base (étape de rejet + distribution résiduelle) avec:

- Un " grand modèle " qui est un déterminisme-softmax sur une distribution codée à la main (donc nous pouvons vérifier l'acceptation mathématique analytique).
- Un "modèle de projet" qui est une perturbation du grand modèle.
- Une boucle d'acceptation/déni qui produit la même distribution marginale que l'échantillonnage direct.

### Étape 1: étape de rejet

```python
def accept_or_reject(q_prob, p_prob, draft_token, u):
    ratio = q_prob / p_prob if p_prob > 0 else float("inf")
    return u < min(1.0, ratio)
```

`u`est un nombre aléatoire uniforme. `q_prob`est la probabilité du vérificateur pour le jeton rédigé. `p_prob`Le théorème de Leviathan est que cette décision de Bernoulli, suivie d'un échantillonnage du résidu sur le rejet, préserve exactement la distribution du vérificateur.

### Étape 2: répartition résiduelle

```python
def residual_dist(q, p):
    raw = [max(0.0, qi - pi) for qi, pi in zip(q, p)]
    s = sum(raw)
    return [r / s for r in raw]
```

Soustraire`p`de `q`En fonction des éléments, cliquez sur les valeurs négatives à zéro, renormez.

### Étape 3: une étape spéculative

```python
def spec_step(prefix, q_model, p_model, N, rng):
    drafts = []
    p_probs = []
    ctx = list(prefix)
    for _ in range(N):
        p_dist = p_model(ctx)
        d = sample(p_dist, rng)
        drafts.append(d)
        p_probs.append(p_dist[d])
        ctx.append(d)

    q_dists = [q_model(prefix + drafts[:i]) for i in range(N + 1)]

    for i, d in enumerate(drafts):
        u = rng.random()
        q_prob = q_dists[i][d]
        p_prob = p_probs[i]
        if u < min(1.0, q_prob / p_prob if p_prob > 0 else float("inf")):
            prefix = prefix + [d]
        else:
            res = residual_dist(q_dists[i], p_model(prefix))
            prefix = prefix + [sample(res, rng)]
            return prefix
    prefix = prefix + [sample(q_dists[N], rng)]
    return prefix
```

Cinq acceptés → un bonus → six jetons produits dans un passe de vérification.

### Étape 4: mesurer le taux d'acceptation

Exécutez 10 000 étapes spéculatives à différents niveaux de qualité du projet. Taux d'acceptation du plot par rapport à la divergence KL entre les distributions du projet et du vérificateur. Vous devriez voir une relation monotone propre.

### Étape 5: vérifier l'équivalence de la distribution

En empirie, l'histogramme des jetons produit par la boucle spéculative doit correspondre à l'histogramme produit par le prélèvement d'échantillons directement depuis le vérificateur.

## Utilisez-le

Produit:

```bash
# vLLM with EAGLE
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-config '{"method": "eagle", "model": "/models/llama-3.1-eagle-70b", "draft_tensor_parallel_size": 1, "num_speculative_tokens": 5}'

# vLLM with vanilla draft model
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-config '{"method": "draft_model", "model": "meta-llama/Llama-3.2-1B-Instruct", "num_speculative_tokens": 5}'
```

TensorRT-LLM a le chemin le plus rapide de Méduse à partir de la mi-2026. `faster-whisper`Enveloppe le décodeur spéculatif pour Whisper-large avec un petit morceau.

**Picking a draft:**

| Strategy | When to pick | Speedup |
|----------|--------------|---------|
| Vanilla draft (1B/3B Llama family) | Fast prototype, no training | 1.8–2.3× |
| Medusa heads | You can fine-tune the verifier | 2–3× |
| EAGLE-2 / 3 | Production, max speed | 3–4× |
| Lookahead | No draft, no training, no extra params | 1.3–1.6× |

**When NOT to spec-decode:**

- Génération de 15 jetons en séquence unique.
- Prise d'échantillons à haute température ($\alpha$des gouttes).
- Déploiements limités par mémoire (modèle de projet ajoute VRAM).

## La faire partir

Regardez !`outputs/skill-spec-decode-picker.md`. La compétence choisit une stratégie de décoding spéculative (vanille / Medusa / Eagle / lookhead) et des paramètres de réglage (N, température de projet) pour une nouvelle charge de travail d'inférence.

## Exercices

1. **Easy.**On court .`code/main.py`. Confirmer que la distribution de jetons spéculatifs correspond à la distribution de l'échantillon direct du vérificateur sur 50 000 jetons dans un espace de p = 0,05 en chi-quare.
2. **Medium.**Accélération de l'intrigue (tokens par grand modèle à l' avance) en fonction de $N$pour $\alpha = 0.5, 0.7, 0.85$- Identifier le meilleur$N$pour chacun $\alpha$. (Parole: jetons attendus par appel de vérification = $(1 - \alpha^{N+1}) / (1 - \alpha)$(dont le nom est
3. **Hard.**Mettez en œuvre une minuscule méduse: prenez la pierre angulaire GPT de la leçon 14, ajoutez 3 têtes LM supplémentaires qui prédisent les positions t+2, t+3, t+4.
4. **Hard.**Retour à l'emploi: commencez par un préfixe KV de 10 jetons, alimentez 5 jetons de projet, simuliez un rejet à la position 3. Vérifiez que vos lectures de cache correspondent correctement au " préfixe + 2 premiers projets acceptés " à la prochaine itération.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Draft model | "The cheap one" | A smaller model that proposes candidate tokens; usually 10–50× cheaper than the verifier. |
| Verifier | "The big one" | The target model whose distribution we preserve; runs once per speculative step. |
| Acceptance rate ($\alpha$) | "How often the draft is right" | Per-token probability that the verifier accepts the draft. 0.7–0.9 typical. |
| Residual distribution | "The rejection fallback" | `(q - p)_+` normalized; sampling from this on rejection preserves the verifier's distribution. |
| Bonus token | "The free one" | When all N drafts accepted, sample one more from the verifier's next-step distribution. |
| Medusa | "Draft-less speculative" | Multiple LM heads on the verifier predict positions t+1..t+k in parallel. |
| EAGLE | "Hidden-state draft" | Tiny transformer draft conditioned on the verifier's last-layer hidden states. |
| Lookahead decoding | "Jacobi iteration" | Self-speculation using a fixed-point iteration; no draft model. |
| Tree attention | "Verify many candidates at once" | Branching verification that considers several draft continuations simultaneously. |
| KV rollback | "Undo rejected drafts" | Scratch KV buffer; commit on acceptance, discard on reject. |

## Pour en savoir plus

- [Leviathan, Kalman, Matias (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) l'algorithme de base et le théorème de l'équivalence.
- [Chen et al. (2023). Accelerating Large Language Model Decoding with Speculative Sampling](https://arxiv.org/abs/2302.01318) introduction concomitante; preuve de rejet de Bernoulli.
- [Cai et al. (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774) Papel de méduse; vérification de l'attention aux arbres.
- [Li et al. (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077) EAGLE-1; projet à condition d'état caché.
- [Li et al. (2024). EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees](https://arxiv.org/abs/2406.16858) AGLE-2; profondeur dynamique des arbres.
- [Li et al. (2025). EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test](https://arxiv.org/abs/2503.01840)- Il est à l'Eagle-3.
- [Fu et al. (2024). Break the Sequential Dependency of LLM Inference Using Lookahead Decoding](https://arxiv.org/abs/2402.02057)- Attention, approche sans projet.
- [vLLM docs — Speculative Decoding](https://docs.vllm.ai/en/latest/features/spec_decode.html) référence canonique de production avec les quatre stratégies câblées.
- [SafeAILab / EAGLE reference implementation](https://github.com/SafeAILab/EAGLE) le code de référence de l'EAGLE-1/2/3.
