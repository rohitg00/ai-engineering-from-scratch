# Évaluation  FID, CLIP Score, préférence humaine

> Chaque tableau de classement génératif cite FID, CLIP score et un taux de victoire d'une arène de préférence humaine. Chaque nombre a un mode d'échec un chercheur déterminé peut jouer. Si vous ne connaissez pas les modes d'échec, vous ne pouvez pas dire une amélioration réelle d'une course de jeu.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 01 (Taxonomy), Phase 2 · 04 (Evaluation Metrics)
**Time:** ~45 minutes

## Le problème

Un modèle génératif est jugé sur * la qualité de l'échantillon * et * l'adhésion des conditions *. Aucune n'a de mesure de forme fermée. Votre modèle doit rendre 10 000 images; quelque chose doit leur attribuer des nombres; vous devez faire confiance aux nombres dans les familles de modèles, dans les résolutions, dans les architectures. Trois mesures ont survécu au gants 2014-2026:

- **FID (Fréchet Inception Distance).**La distance entre deux distributions  réelles et générées  dans l'espace de fonctionnalités d'un réseau Inception.
- **CLIP score.**C'est une similitude cosine entre l'intégration de l'image CLIP d'une image générée et l'intégration de texte CLIP d'un prompt.
- **Human preference.**Faites face à face deux modèles sur le même prompt, faites en sorte que les humains (ou un modèle de classe GPT-4) choisissent le meilleur, agrégé à un score Elo.

Vous verrez également: IS (score d'initiation, en grande partie retraité), KID, CMMD, ImageReward, PickScore, HPSv2, MJHQ-30k. Chacun corrige un échec de l'ancien.

## Le concept

![FID, CLIP, and preference: three axes, different failure modes](../assets/evaluation.svg)

### FID  qualité de l'échantillon

Heusel et coll. (2017).

1. Extraire les fonctionnalités Inception-v3 (2048-D) pour N images réelles et N générées.
2. Pour chaque piscine , un Gaussien .$\mu_r, \mu_g$et la covariance $\Sigma_r, \Sigma_g$- Je suis désolé .
3. $\text{FID} = \lVert \mu_r - \mu_g \rVert^2 + \mathop{\mathrm{Tr}}\left(\Sigma_r + \Sigma_g - 2 \cdot (\Sigma_r \cdot \Sigma_g)^{0.5}\right)$- Je suis désolé .

Interprétation: distance Fréchet entre deux gaussiens multivariés dans l'espace de caractéristiques.

Mode d'échec:
- **Biased on small N.**Le FID est le carré moyen sur la distribution des caractéristiques  petit N sous-estime la covariance, donne un FID faussement faible.$N \ge 10{,}000$- Je suis désolé .
- **Inception-dependent.**Inception-v3 a été formé sur ImageNet. Les domaines éloignés d'ImageNet (faces, art, images de texte) produisent des FID sans sens. Utilisez un extracteur de fonctionnalités spécifique au domaine.
- **Gaming.**Le surmatch de la pré-Inception donne une faible FID sans amélioration de la qualité visuelle.

### Score CLIP  adhésion rapide

Radford et coll. (2021). Pour une image générée + prompt:

```
clip_score = cos_sim( CLIP_image(x_gen), CLIP_text(prompt) )
```

La moyenne sur 30 000 images générées → un échelle comparable entre les modèles.

Mode d'échec:
- **CLIP's own blind spots.**CLIP a un faible raisonnement compositif (" un cube rouge sur une sphère bleue " échoue souvent).
- **Short prompt bias.**Les courts rappel ont plus de matchs d'image CLIP dans la nature.
- **Prompt gaming.**L'inclusion de " haute qualité, 4K, chef-d'œuvre " dans le prompt gonfle le score CLIP sans améliorer la liaison image-texte.

CMMD (Jayasumana et coll., 2024) corrige certaines de ces caractéristiques: utilise des fonctionnalités CLIP au lieu de Inception, une disparité moyenne maximale au lieu de Fréchet.

### La préférence humaine  la vérité fondamentale

Choisissez un ensemble de requêtes. Générez avec le modèle A et le modèle B. Montrez des paires aux humains (ou un juge LLM fort).

- **PartiPrompts (Google)**: 1600 demandes de renseignements variées, 12 catégories.
- **HPSv2**: 107 000 annotations humaines, largement utilisées comme proxy automatisé.
- **ImageReward**: 137k paires de préférences d'images instantanées, sous licence MIT.
- **PickScore**: formé sur les préférences Pick-a-Pic 2.6M.
- **Chatbot-Arena-style image arenas**Le numéro de la liste:https://imagearena.ai/et d'autres.

Mode d'échec:
- **Judge variance.**Les non-experts ont des préférences différentes des experts.
- **Prompt distribution.**Les conseils choisis favorisent une famille.
- **LLM-judge reward hacking.**Le juge GPT-4 est trompé par des résultats fausses.

## Utilisation conjointe

Un rapport d'évaluation de la production devrait inclure:

1. D'après le rapport de référence, les données de référence sont les données de référence de l'échantillon.
2. Score CLIP / CMMD sur les mêmes échantillons par rapport à leurs indications (adhésion).
3. Taux de gain dans une arène aveuglée par rapport au modèle précédent (préférence globale).
4. Analyse du mode défaillance: 50 sorties échantillonnées au hasard, marquées pour des problèmes connus (anatomie de la main, rendu du texte, nombre d'objets cohérent).

Toutes les mesures sont fausses, trois mesures corroborantes et une évaluation qualitative sont une affirmation.

```figure
gx-fid-distributions
```

## Faites-le

`code/main.py`Il implique l'agrégation FID, CLIP-score-like et Elo sur des "vecteurs de caractéristiques" synthétiques (nous utilisons des vecteurs 4D comme suppléments pour les caractéristiques d'Inception).

- Le calcul FID sur un petit N et sur un grand N  le biais.
- "Clip score" comme similitude cosine entre les pools de fonctionnalités.
- Règlement de mise à jour Elo à partir d'un flux de préférences synthétiques.

### Étape 1: FID en quatre lignes

```python
def fid(real_features, gen_features):
    mu_r, cov_r = mean_and_cov(real_features)
    mu_g, cov_g = mean_and_cov(gen_features)
    mean_diff = sum((a - b) ** 2 for a, b in zip(mu_r, mu_g))
    trace_term = trace(cov_r) + trace(cov_g) - 2 * sqrt_cov_product(cov_r, cov_g)
    return mean_diff + trace_term
```

### Étape 2: similitude cosine à la CLIP

```python
def clip_like(image_feat, text_feat):
    dot = sum(a * b for a, b in zip(image_feat, text_feat))
    norm = math.sqrt(dot_self(image_feat) * dot_self(text_feat))
    return dot / max(norm, 1e-8)
```

### Étape 3: Aggrégation d'élu

```python
def elo_update(r_a, r_b, winner, k=32):
    expected_a = 1 / (1 + 10 ** ((r_b - r_a) / 400))
    actual_a = 1.0 if winner == "a" else 0.0
    r_a_new = r_a + k * (actual_a - expected_a)
    r_b_new = r_b - k * (actual_a - expected_a)
    return r_a_new, r_b_new
```

## Les pièges

- **FID at N=1000.**Les documents rapportant une faible N FID sont en jeu.
- **Comparing FID across resolutions.**La taille de l'Inception 299×299 modifie la distribution des fonctionnalités.
- **Reporting one seed.**Faites au moins 3 semences.
- **CLIP score inflation via negative prompts.**Certains pipelines augmentent le CLIP en ajustant trop le prompt.
- **Elo bias from prompt overlap.**Si les deux modèles ont vu une demande de référence pendant la formation, Elo est inutile.
- **Human eval paid-crowd skew.**Les annotateurs MTurk prolifiques sont plus jeunes / plus adaptés à la technologie.

## Utilisez-le

Protocole d'évaluation de la production en 2026:

| Pillar | Minimum | Recommended |
|--------|---------|-------------|
| Sample quality | FID on 10k vs held-out real | + CMMD on 5k + FID on subset per category |
| Prompt adherence | CLIP score on 30k | + HPSv2 + ImageReward + VQA-style question answering |
| Preference | 200 blinded pairs vs baseline | + 2000 paired human + LLM-judge + Chatbot Arena |
| Failure analysis | 50 hand-flagged | 500 hand-flagged + automated safety classifier |

Les quatre piliers d'un rapport = revendication.

## La faire partir

- Ça va .`outputs/skill-eval-report.md`. Skill prend un nouveau point de contrôle + ligne de base du modèle et produit un plan d'évaluation complet: tailles d'échantillons, mesures, sondes en mode défaillance, critères de résiliation.

## Exercices

1. **Easy.**On court .`code/main.py`. Comparer le FID à N=100 contre N=1000 sur les mêmes distributions synthétiques.
2. **Medium.**Implémenter le CMMD à partir de caractéristiques de style CLIP synthétique (voir Jayasumana et coll., 2024 pour la formule).
3. **Hard.**Répliquez la configuration HPSv2: prenez 1000 paires d'images de la suite de Pick-a-Pic, ajustez un petit marqueur basé sur CLIP sur les préférences, et mesurez son accord avec un ensemble de retenu.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| FID | "Fréchet Inception Distance" | Fréchet distance of Gaussian fits to real vs gen Inception features. |
| CLIP score | "Text-image similarity" | Cosine similarity between CLIP image and text embeddings. |
| CMMD | "FID's replacement" | CLIP-feature MMD; less biased, no Gaussian assumption. |
| IS | "Inception score" | Exp KL(p(y|x) || p(y)); correlates poorly on modern models, retired. |
| HPSv2 / ImageReward / PickScore | "Learned preference proxies" | Small models trained on human preferences; used as automatic judges. |
| Elo | "Chess rating" | Bradley-Terry aggregation of pairwise wins. |
| PartiPrompts | "The benchmark prompt set" | 1,600 Google-curated prompts across 12 categories. |
| FD-DINO | "Self-sup replacement" | FD using DINOv2 features; better for out-of-ImageNet domains. |

## Note de production: l'évaluation est aussi une charge de travail d'inférence

Exécuter FID sur des échantillons 10k signifie générer des images 10k. Pour une base SDXL de 50 étapes à 10242 sur un seul L4, c'est ~ 11 heures d'inférence à une seule demande. Les budgets d'évaluation sont réels, et le cadrage est exactement le scénario d'inférence hors ligne (maximiser le débit, ignorer TTFT):

- **Batch hard, forget latency.**Évaluation hors ligne = lotage statique à la taille la plus grande qui correspond à la mémoire. `pipe(...).images`avec `num_images_per_prompt=8`sur un H100 de 80 Go fonctionne 4 à 6 fois plus vite que sur demande unique.
- **Cache the real features.**L'extraction de la fonction Inception (FID) ou CLIP (CLIP-score, CMMD) sur le jeu de référence réel est exécutée *une fois*, stockée en tant que `.npz`Ne recomptez pas par évaluation.

Pour les portes CI / régression: exécuter FID + CLIP score sur un sous-ensemble de 500 échantillons par PR (~ 30 min); exécuter plein 10k FID + HPSv2 + Elo chaque nuit.

## Pour en savoir plus

- [Heusel et al. (2017). GANs Trained by a Two Time-Scale Update Rule Converge to a Local Nash Equilibrium (FID)](https://arxiv.org/abs/1706.08500) papier FID.
- [Jayasumana et al. (2024). Rethinking FID: Towards a Better Evaluation Metric for Image Generation (CMMD)](https://arxiv.org/abs/2401.09603) CMMD.
- [Radford et al. (2021). Learning Transferable Visual Models from Natural Language Supervision (CLIP)](https://arxiv.org/abs/2103.00020)- Je suis en train de vous dire.
- [Wu et al. (2023). HPSv2: A Comprehensive Human Preference Score](https://arxiv.org/abs/2306.09341) HPSv2.
- [Xu et al. (2023). ImageReward: Learning and Evaluating Human Preferences for Text-to-Image Generation](https://arxiv.org/abs/2304.05977) ImageReward.
- [Yu et al. (2023). Scaling Autoregressive Models for Content-Rich Text-to-Image Generation (Parti + PartiPrompts)](https://arxiv.org/abs/2206.10789) PartiPrompts.
- [Stein et al. (2023). Exposing flaws of generative model evaluation metrics](https://arxiv.org/abs/2306.04675) enquête en mode défaillance.
