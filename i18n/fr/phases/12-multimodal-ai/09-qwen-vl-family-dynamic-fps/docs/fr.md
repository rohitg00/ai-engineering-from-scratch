# Qwen-VL Famille et vidéo dynamique-FPS

> La famille Qwen-VL  Qwen-VL (2023), Qwen2-VL (2024), Qwen2.5-VL (2025), Qwen3-VL (2025)  est la lignée de modèles en langage de vision ouverte la plus influente en 2026. Chaque génération a fait un pari architectural décisif unique que le reste de l'écosystème ouvert a copié en douze mois: résolution dynamique native via M-RoPE, échantillonnage dynamique-FPS avec alignement temporel absolu, attention aux fenêtres dans le ViT, et formats de sortie d'agent structuré. Par Qwen3-VL, la recette s'était stabilisée: un encodeur 2D-RoPE-ViT avec des entrées natives de rapport d'aspect, un projecteur MLP dans une grande base de langage Qwen3, et des étapes de formation qui mettaient l'accent sur le comportement des agents OCR, de la mise à terre et des cibles de première classe. Cette leçon lit la famille chronologiquement pour que vous compreniez pourquoi chaque bouton est là où il est.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, M-RoPE encoder + dynamic-FPS sampler)
**Prerequisites:** Phase 12 · 06 (patch-n'-pack)
**Time:** ~120 minutes

## Objectifs d'apprentissage

- Comptez les rotations à trois axes de M-RoPE (temporales, hautes, larges) et expliquez pourquoi ces trois axes sont nécessaires.
- Choisissez une stratégie d'échantillonnage FPS dynamique pour une vidéo et raisonnez sur la précision des jetons par seconde par rapport à la détection d'événements.
- Nombrez les quatre mises à niveau générationnelles de Qwen-VL dans l'ordre et ce que chacune a permis.
- Télécharger un format de sortie d'agent JSON de type Qwen2.5 VL et analyser les appels d'outils structurés à partir d'une réponse VLM.

## Le problème

Qwen-VL a été expédié en août 2023 en réponse directe à LLaVA-1.5 et BLIP-2.

La résolution: LLaVA-1.5 fonctionnait à 336x336. Bien pour les photos, inutile pour une facture en chinois ou une capture d'écran de feuille de calcul dense. La première innovation de Qwen-VL était 448x448 et la sortie de boîte de délimitation à terre, laissant le modèle pointer sur les choses.

Vidéo: Video-LLaMA a empilé des encoders par cadre et les a alimentés au LLM. Il fonctionnait pour des clips courts, pas pour des vidéos de plusieurs minutes où l'axe temporel est le signal.

Exit structuré: LLaVA émet du texte de forme libre. Un agent a besoin de JSON. Qwen-VL est formé sur des formats de sortie JSON explicites, y compris les coordonnées de boîte de délimitation en tant que texte.

Chaque génération de Qwen-VL étend un de ces trois axes.

## Le concept

### Qwen-VL (août 2023)

La première génération: OpenCLIP ViT-bigG/14 en tant qu'encodeur (2.5B params), Q-Former compatible avec LLama (1 étape avec 256 requêtes), Qwen-7B base. Contributions:

- 448x448 résolution (alors SOTA pour un VLM ouvert).
- Le grattage: entraîné sur des paires d'images-texte avec une sortie explicite de jetons de coordonnées. "Le chat est à <box>(112, 204), (280, 344)</box>".
- Formation multilingue en chinois + anglais dès le début.

Les critères de référence à l'époque: compétitif avec GPT-4V en anglais, dominant en chinois.

### Qwen2-VL (septembre 2024)  M-RoPE et résolution native

Qwen2-VL a remplacé la pile Q-Former à résolution fixe par un encodeur ViT à résolution dynamique natif.

- La résolution dynamique native. Le ViT accepte n'importe quel HxW divisible par 28 (patch 14 avec fusion spatiale 2x). Une image à 1120x672 (40x24 patches fusionnées) produit 960 jetons visuels. Aucune taille, aucune carreaux, aucune miniature.
- M-RoPE (RoPE multimodale). Chaque jeton porte une position 3D (t, h, w) au lieu de 1D. Pour les images t = 0, pour la vidéo t = frame_index. RoPE fait tourner les vecteurs de requête / clé par une fréquence par axe. Aucune table d'intégration positionnelle.
- Jetez le Q-Former, utilisez un MLP à deux couches sur les jetons de patch fusionnés.
- Vidéo avec FPS dynamique. Vidéo échantillonnée à 1-2 FPS par défaut, mais le modèle accepte des comptes de cadres arbitraires.

Résultat: Qwen2-VL-7B a paré GPT-4o sur plusieurs critères de référence multimodal et l'a battu sur DocVQA (94,5 contre 88,4).

### Qwen2,5-VL (février 2025)  FPS dynamique + temps absolu

Le changement majeur de Qwen2.5VL était la vidéo.

- Le temps absolu dans les identifiants de position. Au lieu des indices de cadres (cadres 0, 1, 2...), l'axe temporel de M-RoPE suit les timestamps réels, de sorte que l'écart entre les identifiants de deux cadres suit les secondes entre eux. "À 0:04, le chat saute. " Aucun jeton texte supplémentaire ne porte le temps, de sorte que le codage n'ajoute aucune longueur de séquence.
- FPS dynamique. échantillonnage à 1 FPS pour des images lentes, 4 FPS+ pour l'action. L'utilisateur ou l'entraîneur choisit; M-RoPE s'adapte.
- Attention à la fenêtre dans le ViT. L'attention spatiale est fenêtrenée (locale dans les blocs) pour le débit; attention globale toutes les quelques couches.
- Format de sortie explicite JSON. Formé sur les données d'appel d'outil: "{\"outil\": \"cliquez\", \"coords\": [380, 220]}". Agent prêt à sortir de la boîte.
- MRoPE-v2 étalonnage. Étalonnage des positions avec la taille maximale de l'entrée afin qu'une vidéo de 10 minutes ne soit pas à court de fréquence.

Benchmarks: Qwen2.5-VL-72B dépasse GPT-4o sur la plupart des benchmarks vidéo, correspond à Gemini 2.0 sur les documents et définit le SOTA modèle ouvert pour la mise à terre de l'interface graphique (ScreenSpot: 84% de précision contre 38% pour GPT-4o).

### Qwen3-VL (novembre 2025)

Qwen3-VL est une mise à niveau progressive qui consolide plutôt que réinvente: plus grande colonne vertébrale de la LLM (Qwen3-72B), données de formation élargies, OCR améliorée, raisonnement plus fort via le "mode de pensée" Qwen3.

Le résultat: en 2025, l'architecture Qwen-VL s'était stabilisée.

### M-RoPE mathématiquement

Le RoPE classique fait tourner une requête `q`de dimension `d`par position `m`en utilisant des coordonnées parées:

```math
\begin{aligned}
q_{\text{rot}}[2i] &= q[2i] \cos(m \theta_i) - q[2i+1] \sin(m \theta_i) \\
q_{\text{rot}}[2i+1] &= q[2i] \sin(m \theta_i) + q[2i+1] \cos(m \theta_i) \\
\theta_i &= 10000^{-2i/d}
\end{aligned}
```

M-RoPE divise le flou caché en trois bandes.`d = 96`. Assigner 32 décimaux à la température, 32 à la hauteur, 32 à la largeur. Chaque bande tourne par sa propre position d'axe.`R_t(5)`- Je suis là .`R_h(10)`- Je suis là .`R_w(20)`appliqué à ses trois bandes.

Utilisation de jetons texte `t = text_index, h = 0, w = 0`(ou un choix normalisé), en gardant la compatibilité.`t = frame_time, h = row, w = col`. Utilisation d' images uniques `t = 0`- Je suis désolé .

L'avantage: un codeur de position traite le texte, l'image et la vidéo sans brancher le code ou les tables de position différentes.

### Logique de prélèvement d'échantillons dynamique-FPS

Vu la durée de la vidéo `T`secondes et un budget de jetons cibles `B`- Le numéro de la liste:

1. Calculez le FPS maximum que vous pouvez vous permettre: `fps_max = B / (T * tokens_per_frame)`- Je suis désolé .
2. Choisissez une FPS cible .`{1, 2, 4, 8}`qui satisfait `fps <= fps_max`- Je suis désolé .
3. Si le mouvement est élevé (heuristique ou explicite demande de l'utilisateur), choisissez un FPS plus élevé.
4. Prenez un échantillon uniforme au FPS choisi; définissez l'identifiant temporel M-RoPE de chaque cadre à partir de son timestamp en quelques secondes.

Qwen2.5-VL entraîne cette logique implicitement; à l'inférence, l'utilisateur contrôle via `fps`Paramètre: une séquence d'action de 60 secondes à 4 FPS avec 81 jetons par cadre = 19440 jetons, gérable dans un contexte de 32k.

### Produit d'agent structuré

La formation des agents de Qwen2.5VL vise explicitement les appels structurés aux outils:

```
{
  "tool": "mouse_click",
  "coords": [1024, 512],
  "button": "left",
  "modifier": null
}
```

Le parsing est déterministe: JSON.parse sur la sortie du modèle. Comparer à la forme libre "cliquez à (1024, 512) " qui nécessitait un traitement de régex et d'ambiguïté. Le changement est la raison pour laquelle les scores ScreenSpot de Qwen2.5-VL ont sauté de 55% à 84%.

```figure
mm-mrope-axes
```

## Utilisez-le

`code/main.py`les implémentations:

- Compteur de position M-RoPE pour une séquence emballée mélangeant texte, patches d'image et cadres vidéo.
- Pratiquant de l'échantillonnage FPS dynamique: donné (durée, budget, niveau de mouvement), sélectionnez FPS et émettez des timestamps de cadre.
- Un analyseur de sortie JSON Qwen2.5 VL qui gère les réponses aux appels d'outils avec des champs de coordonnées.

Exécutez-le, puis ressentez la différence lorsque vous changez FPS fixe pour FPS dynamique sur une vidéo de 5 minutes.

## La faire partir

Cette leçon produit `outputs/skill-qwen-vl-pipeline-designer.md`. En fonction d'une tâche vidéo (surveillance, agent, reconnaissance d'action, accessibilité), il émet la configuration Qwen2.5 VL (budget de cadre, stratégie FPS, drapeau d'attention de fenêtre, mode agent-output) et une estimation de latence.

## Exercices

1. Comptez les rotations M-RoPE pour un patch à (t=3, h=5, w=7) avec 48 cachés (16 par bande, theta 10000 de base).

2. Une caméra de sécurité enregistreur à 1 FPS à 10 minutes produit combien de images ? à 384 résolution avec 3x pool, combien de jetons totaux ?

3. Choisissez FPS pour un rallye de tennis de 30 secondes contre une démo de recette de 30 secondes contre un enregistrement d'agent d'interface utilisateur de 30 secondes.

4. Qwen2.5VL dépose entièrement le Q-Former. Pourquoi un simple MLP fonctionne-t-il en 2025 mais pas en 2023?

5. Pars trois sorties d'appels d'outil JSON Qwen2.5-VL dans les dicts Python. Qu'est-ce qui manque pour JSON malformé et quelle stratégie de récupération recommande le livre de cuisine Qwen?

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| M-RoPE | "Multimodal RoPE" | 3D rotary position embedding with temporal, height, and width bands in the hidden dim |
| Dynamic FPS | "Smart sampling" | Frame sampling rate chosen per video based on motion, duration, and token budget |
| Absolute time encoding | "Time-aligned M-RoPE" | Temporal position IDs set from each frame's timestamp, so the model sees actual seconds, not frame index, with no extra tokens |
| Window attention | "Local attention" | Spatial self-attention restricted to small windows for speed; global attention added periodically |
| Structured agent output | "JSON mode" | Training data supervision teaching the VLM to emit parseable JSON with coords and tool names |
| min_pixels / max_pixels | "Resolution bounds" | Per-request Qwen2.5-VL controls bounding total pixel count and therefore token count |
| Grounding | "Point-at-it" | Outputting bounding-box coordinates as text tokens; used since Qwen-VL v1 |

## Pour en savoir plus

- [Bai et al. — Qwen-VL (arXiv:2308.12966)](https://arxiv.org/abs/2308.12966)
- [Wang et al. — Qwen2-VL (arXiv:2409.12191)](https://arxiv.org/abs/2409.12191)
- [Qwen Team — Qwen2.5-VL Technical Report (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)
- [Qwen Team — Qwen3-VL (arXiv:2511.21631)](https://arxiv.org/abs/2511.21631)
- [Zhu et al. — InternVL3 (arXiv:2504.10479)](https://arxiv.org/abs/2504.10479)
