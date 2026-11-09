# Génération 3D

> La 3D est la modalité où le levier 2D à 3D est le plus fort. La percée de 2023 a été 3D Gaussian Splating. La couche de poussée générative 2024-2026 diffusion multi-vue + reconstruction 3D en haut pour produire des objets et des scènes à partir d'un seul prompt ou photo.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 4 (Vision), Phase 8 · 07 (Latent Diffusion)
**Time:** ~45 minutes

## Le problème

Le contenu 3D est douloureux:

- **Representation.**Les réseaux voxel, les champs signés à distance, les champs neuraux de rayonnement, les Gaussiens 3D.
- **Data scarcity.**ImageNet possède 14 millions d'images. Le plus grand ensemble de données 3D propre (Objaverse-XL, 2023) a environ 10 millions d'objets, la qualité la plus faible.
- **Memory.**Une grille de 5123 voxels est de 128 M voxels; une scène utile NeRF a besoin de 1 M d'échantillons / rayons.
- **Supervision.**Pour une image 2D, vous avez les pixels. Pour 3D, vous avez généralement une poignée de vues 2D et vous devez passer à 3D.

La pile 2026 sépare les deux problèmes. Premièrement, générez * 2D images multi-vue * avec un modèle de diffusion. Deuxièmement, ajoutez une représentation * 3D * (généralement splating gaussienne) à ces images.

## Le concept

![3D generation: multi-view diffusion + 3D reconstruction](../assets/3d-generation.svg)

### Réprésentation: Splating gaussien en 3D (Kerbl et coll., 2023)

Représente une scène comme un nuage de Gaussiens 3D de ~ 1M. Chacun a 59 paramètres: position (3), covariance (6, ou quaternion 4 + échelle 3), opacité (1), couleur sphérique-harmonique (48 au degré 3, 3 au degré 0).

Rendering = projection + alpha-composing. Rapide (~ 100 images par seconde à 1080p sur un 4090). Différenciable. Adapté par déclin de gradient par rapport aux photos de la vérité au sol. Une scène s'adapte en 5 à 30 minutes sur un GPU de consommation.

Deux innovations en amont pour les années 2023-2024:
- **Generative Gaussian splats.**Des modèles comme LGM, LRM, InstantMesh prédisent un nuage gaussien directement à partir d'une ou plusieurs images.
- **4D Gaussian Splatting.**Gaussiens avec des compensations par cadre pour des scènes dynamiques.

### Diffusion multi-vue

Télécharger un modèle de diffusion d'image prétrainé pour générer plusieurs vues cohérentes du même objet à partir d'une image simple ou d'un seul texte. Zero123 (Liu et al., 2023), MVDream (Shi et al., 2023), SV3D (Stabilité, 2024), CAT3D (Google, 2024). Généralement, produire 4-16 vues autour de l'objet, levées à 3D via le splating gaussien ou NeRF.

### Les pipelines de texte à 3D

| Model | Input | Output | Time |
|-------|-------|--------|------|
| DreamFusion (2022) | text | NeRF via SDS | ~1 hour per asset |
| Magic3D | text | mesh + texture | ~40 min |
| Shap-E (OpenAI, 2023) | text | implicit 3D | ~1 min |
| SJC / ProlificDreamer | text | NeRF / mesh | ~30 min |
| LRM (Meta, 2023) | image | triplane | ~5 s |
| InstantMesh (2024) | image | mesh | ~10 s |
| SV3D (Stability, 2024) | image | novel views | ~2 min |
| CAT3D (Google, 2024) | 1-64 images | 3D NeRF | ~1 min |
| TripoSR (2024) | image | mesh | ~1 s |
| Meshy 4 (2025) | text + image | PBR mesh | ~30 s |
| Rodin Gen-1.5 (2025) | text + image | PBR mesh | ~60 s |
| Tencent Hunyuan3D 2.0 (2025) | image | mesh | ~30 s |

Direction 2025-2026: modèles directs texte-mesh avec des matériaux PBR adaptés aux moteurs de jeu.

### NeRF (pour le contexte)

Le champ de radiance neurale (Mildenhall et coll., 2020).`(x, y, z, view direction)`et les résultats `(color, density)`- Render en intégrant les rayons. Il dépasse la synthèse de vision novatrice à base de maille en qualité mais est 100 à 1000 fois plus lent à rendre.

```figure
v4-3d-multiview
```

## Faites-le

`code/main.py`Il utilise un jeu 2D "splating gaussian" adapté: représente une image cible synthétique (un gradient lisse) comme la somme des splats gaussiens 2D. Optimisez les positions, les couleurs et les covariances par déclin de gradient pour correspondre à la cible. Vous voyez les deux opérations principales: rendu avant (splat + alpha-composite) et adapté par déclin de gradient.

### Étape 1: Splat gaussien en 2D

```python
def gaussian_at(x, y, gaussian):
    px, py = gaussian["pos"]
    sigma = gaussian["sigma"]
    d2 = (x - px) ** 2 + (y - py) ** 2
    return math.exp(-d2 / (2 * sigma * sigma))
```

### Étape 2: rendu par somme de points

```python
def render(image_size, gaussians):
    img = [[0.0] * image_size for _ in range(image_size)]
    for g in gaussians:
        for y in range(image_size):
            for x in range(image_size):
                img[y][x] += g["color"] * gaussian_at(x, y, g)
    return img
```

Le vrai gaussien 3D sort les gaussiens par profondeur et alpha-composites dans l'ordre.

### Étape 3: ajustement par descente de gradient

```python
for step in range(steps):
    pred = render(size, gaussians)
    loss = mse(pred, target)
    gradients = compute_grads(pred, target, gaussians)
    update(gaussians, gradients, lr)
```

## Les pièges

- **View inconsistency.**Si vous générez 4 vues indépendamment et qu'ils ne sont pas d'accord sur la structure de l'objet, l'ajustement 3D est flou.
- **Back-side hallucination.**La 3D doit inventer le côté invisible.
- **Gaussian splat explosion.**La formation sans contrainte atteint 10 millions de places et de surplombs.
- **Topology issues.**Les mailles provenant de champs implicites (SDF) ont souvent des trous ou des intersections autonomes.
- **License of training data.**Objaverse a des licences mixtes; l'utilisation commerciale varie selon le modèle.

## Utilisez-le

| Task | 2026 pick |
|------|-----------|
| Scene reconstruction from photos | Gaussian splatting (3DGS, Gsplat, Scaniverse) |
| Text-to-3D object for games | Meshy 4 or Rodin Gen-1.5 (PBR output) |
| Image-to-3D | Hunyuan3D 2.0, TripoSR, InstantMesh |
| Novel-view synthesis from few images | CAT3D, SV3D |
| Dynamic scene reconstruction | 4D Gaussian Splatting |
| Avatar / clothed human | Gaussian Avatar, HUGS |
| Research / SOTA | Whatever dropped last week |

Pour la production 3D de livraison dans un jeu ou un pipeline de commerce électronique: Meshy 4 ou Rodin Gen-1.5 sortie de maillage PBR qui vont directement dans Unity / Unreal.

## La faire partir

- Ça va .`outputs/skill-3d-pipeline.md`. Les compétences prennent un résumé 3D (entrée: texte / une image / quelques images; sortie: maille / splat / NeRF; utilisation: rendu / jeu / VR) et les sorties: pipeline (diffusion multi-vue + ajustement, ou modèle de maille directe), modèle de base, budget d'itération, topologie post-traitement, canaux de matériel nécessaires.

## Exercices

1. **Easy.**On court .`code/main.py`Rapporte le MSE final contre la cible.
2. **Medium.**Prenez les Gaussiens de couleur (RGB) et confirmez que la reconstruction correspond au motif de couleur cible.
3. **Hard.**En utilisant gsplat ou Nerfstudio, reconstruire un objet réel à partir d'une capture de 50 photos.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| 3D Gaussian Splatting | "3DGS" | Scene as a cloud of 3D Gaussians; differentiable alpha-composite render. |
| NeRF | "Neural radiance field" | MLP that outputs color + density at a 3D point; render by ray integration. |
| Triplane | "Three 2-D planes" | Factor 3D into three 2-D axis-aligned feature grids; cheaper than volumetric. |
| SDS | "Score distillation sampling" | Train 3D model by using 2D-diffusion score as pseudo-gradient. |
| Multi-view diffusion | "Many views at once" | Diffusion model that outputs a batch of consistent camera views. |
| PBR | "Physically-based rendering" | Material with albedo, roughness, metallic, normal channels. |
| Densification | "Grow splats" | 3DGS training heuristic: split / clone splats in high-gradient regions. |

## Note de production: 3D n'a pas encore de substrat partagé

Contrairement à l'image (diffusion latente + DiT) et à la vidéo (diT spatiotemporal), 3D n'a pas de durée de fonctionnement dominante unique en 2026.

- **NeRF / triplane.**L'inference est le ray-marchage + un MLP vers l'avant par échantillon. Un rendu 5122 nécessite des millions de MLP vers l'avant.
- **Multi-view diffusion + LRM reconstruction.**Le niveau 1 (division multi-vue) est un serveur de diffusion tout comme le cours 07. Le stade 2 (transformateur LRM) est un passage à un seul coup vers l'avant sur les vues. Le profil de latence global est "diffusion + un coup"  choisir par étape servant les primitifs en conséquence.
- **SDS / DreamFusion.**Optimisation par actif, pas inférence, création d'emplois, pas demande de gestionnaires.

Pour la plupart des produits 2026 la bonne réponse est "exécuter un modèle de diffusion multi-vue sur demande, reconstruire à 3DGS de manière asynchrone, servir le 3DGS pour la visualisation en temps réel". Cela divise la charge de travail entre un serveur d'inference GPU (rapide) et un optimisateur hors ligne (légère).

## Pour en savoir plus

- [Mildenhall et al. (2020). NeRF: Representing Scenes as Neural Radiance Fields](https://arxiv.org/abs/2003.08934) NeRF.
- [Kerbl et al. (2023). 3D Gaussian Splatting for Real-Time Radiance Field Rendering](https://arxiv.org/abs/2308.04079)3DGS.
- [Poole et al. (2022). DreamFusion: Text-to-3D using 2D Diffusion](https://arxiv.org/abs/2209.14988) SDS.
- [Liu et al. (2023). Zero-1-to-3: Zero-shot One Image to 3D Object](https://arxiv.org/abs/2303.11328)- Zéro 123
- [Shi et al. (2023). MVDream](https://arxiv.org/abs/2308.16512) Diffusion multi-vue.
- [Hong et al. (2023). LRM: Large Reconstruction Model for Single Image to 3D](https://arxiv.org/abs/2311.04400) LRM.
- [Gao et al. (2024). CAT3D: Create Anything in 3D with Multi-View Diffusion Models](https://arxiv.org/abs/2405.10314)- C'est une catastrophe.
- [Stability AI (2024). Stable Video 3D (SV3D)](https://stability.ai/research/sv3d-novel-multi-view-synthesis-and-3d-generation-from-a-single-image-using-latent-video-diffusion)- Le SV3D.
