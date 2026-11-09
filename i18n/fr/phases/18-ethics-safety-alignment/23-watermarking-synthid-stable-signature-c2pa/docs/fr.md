# Marquage de l'eau  SynthID, signature stable, C2PA

> Trois technologies structurent la provenance du contenu généré par l'IA en 2026. SynthID (Google DeepMind)  image watermarking lancé en août 2023, texte + vidéo mai 2024 (Gemini + Veo), texte open-source octobre 2024 via Responsible GenAI Toolkit, détecteur multimédia unifié novembre 2025 aux côtés de Gemini 3 Pro. Le marquage d'eau de texte ajuste de manière imperceptible les probabilités de prélèvement des jetons suivants; les marquages d'eau d'image/vidéo survivent à la compression, à la coupe, aux filtres, aux changements de fréquence d'image. Signature stable (Fernandez et coll., ICCV 2023, arXiv:2303.15435)  fine-tune le décodeur de diffusion latent afin que chaque sortie contient un message fixe; images découpées (10% du contenu) générées détectées >90% au FPR<1e-6. Suivi " La signature stable est instable " (arXiv:2405.07145, mai 2024)  ajustement fin supprime la marque d'eau tout en préservant la qualité. C2PA  standard de métadonnées cryptographiquement signé et évident pour les manipulations (C2PA 2.2 Explanatory 2025). Le marquage d'eau et le C2PA sont complémentaires: les métadonnées peuvent être supprimées mais ont une provenance plus riche; les marquages d'eau persistent grâce au transcodage mais contiennent moins d'informations.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, token-watermark embed + detect)
**Prerequisites:** Phase 10 · 04 (sampling), Phase 01 · 09 (information theory)
**Time:** ~75 minutes

## Objectifs d'apprentissage

- Décrivez le marquage à niveau de jeton (style SynthID-text) et le mécanisme par lequel il est détectable.
- Décrivez la signature stable et l'attaque de retrait de 2024 qui l'a brisée.
- Le rôle de l'A2C de l'État et pourquoi il complète l'eau marquée.
- Décrivez les principales limites: signal spécifique au modèle, robustesse sous paraphrase et attaques de préservation du sens (arXiv:2508.20228).

## Le problème

En 2023-2024, les faux profonds et le contenu généré par l'IA entrent dans des contextes politiques et de consommation à grande échelle. Le marquage d'eau est le signal technique proposé de provenance: marquer les générations au moment de la création, les détecter plus tard.

## Le concept

### Marquage d'eau du texte (style SynthID-text)

Le mécanisme Kirchenbauer et al. 2023, produit par Google:

1. À chaque étape de décoding, hash les jetons K précédents pour produire une partition pseudorandom du vocabulaire en ensembles "verts" et "rouges".
2. Prise d'échantillons de biais vers l'ensemble vert en ajoutant δ aux logits verts.
3. La génération contient plus de jetons verts que le hasard ne le produirait.

Détection: réinitialisez chaque préfixe, comptez les jetons verts de la génération, comptez un z-score. Le z-score est >0 pour le texte marqué par eau, ~0 pour le texte humain.

Propriétés:
- Inperceptible par les lecteurs (δ est assez petit pour que la perte de qualité soit mineure).
- Détectable avec accès à la fonction de partition du vocabulaire.
- Pas assez fort pour paraphraser  réécrire le texte détruit le signal.

SynthID-text est open-source en octobre 2024 via le Responsible GenAI Toolkit de Google.

### Signature stable (image)

Fernandez et coll. ICCV 2023. Télécharger le décodeur de diffusion latent afin que chaque image générée contient un message binaire fixe intégré à la représentation latente. La détection est décodée à partir du latent avec un décodeur neuronal.

Mai 2024 " La signature stable est instable " (arXiv:2405.07145): l'ajustement fin du décodeur supprime la marque d'eau tout en préservant la qualité de l'image.

### Détecteur unifié SynthID (novembre 2025)

Avec Gemini 3 Pro: un détecteur multimédia qui lit les signaux SynthID à partir de texte, d'image, d'audio et de vidéo dans une API. Unifie la pile de provenance de Google.

### C2PA

Coalition pour la provenance et l'authenticité du contenu. Standard de métadonnées falsifiées signé cryptographiquement. C2PA 2.2 Expliquer (2025). Un manifeste C2PA enregistre les revendications de provenance (qui a créé, quand, quelles transformations) signées par la clé du créateur.

Complémentaire à l'eau marquée:
- Les métadonnées peuvent être retirées; les marqueurs d'eau ne peuvent pas (facile).
- Les métadonnées sont riches (chaîne de provenance complète); les balises d'eau contiennent des bits.
- C2PA dépend de l'adoption de la plateforme; les marqueurs d'eau sont intégrés automatiquement.

Google intègre à la fois dans la recherche, les annonces et "A propos de cette image".

### Limitations

- **Model-specific.**SynthID marque-eau générations de modèles synthID. Une génération d'un modèle sans SynthID n'est pas marquée par l'eau, donc "aucun signal SynthID" n'est pas une preuve d'authenticité.
- **Paraphrase.**Les marqueurs d'eau du texte ne survivent pas à la paraphrase conservant le sens.
- **Transformation attacks.**arXiv:2508.20228 (2025) montre des attaques de préservation du sens qui détruisent à la fois les marque-eau texte et de nombreuses marque-eau d'image.
- **Fine-tune removal.**Pour "Signature stable est instable", l'ajustement fin post-génération supprime les marque-eau intégrées.

### Loi sur l'IA de l'UE Article 50

Code de transparence pour l'étiquetage des contenus générés par l'IA (premier projet de décembre 2025, deuxième projet de mars 2026, prévu final juin 2026 selon le [European Commission status page](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content)Le code reste en préparation à compter d'avril 2026 et le calendrier est sujet à changement.

### Là où cela s'inscrit dans la phase 18

Les leçons 22-23 traitent de ce que le modèle émet (données privées, signal d'origine). La leçon 27 couvre la gouvernance des données de formation. La leçon 24 est le cadre réglementaire qui exige ces mesures techniques.

```figure
an-watermark-greenlist
```

## Utilisez-le

`code/main.py`construit un code d'eau de texte de jouet. Les jetons sont des nombres entiers 0..N-1; les biais d'échantillonnage marqués d'eau vers le jeu vert défini par hash. Un détecteur calcule le score z du jeton vert. Vous pouvez observer la détection à 1000 générations de jetons, regarder la paraphrase détruire le signal et mesurer le taux de faux positifs sur le texte humain.

## La faire partir

Cette leçon produit `outputs/skill-provenance-audit.md`. En raison d'un déploiement de contenu avec une revendication de provenance, il contrôle: le mécanisme de marque d'eau (le cas échéant), la chaîne de signature C2PA (le cas échéant), la robustesse des controverses de chacun et la couverture par modalité.

## Exercices

1. On court .`code/main.py`. Rapportez les z-scores pour la génération de 1000 jetons marqués par eau par rapport au texte écrit par l'homme.

2. Implémenter une attaque par paraphrase qui remplace 30% des jetons par des synonymes.

3. Lisez Kirchenbauer et coll. 2023 Section 6 sur la robustesse. Pourquoi les marque-eau texte échouent-ils sous la paraphrase mais les marque-eau image survivent-ils à la découpe?

4. Développer un déploiement qui utilise SynthID-text + C2PA métadonnées. Décrire la chaîne de provenance qu'un consommateur voit. Identifier un mode d'échec de chaque composant.

5. Le résultat 2024 "Signature stable est instable" montre que l'ajustement fin supprime le point d'eau de l'image.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| SynthID | "Google's watermark" | Cross-modal provenance signal; text, image, audio, video |
| Token watermark | "Kirchenbauer-style" | Biased-sampling text watermark detectable via green-token z-score |
| Stable Signature | "image watermark" | Fine-tuned-decoder watermark; ICCV 2023 |
| C2PA | "the metadata standard" | Cryptographically signed tamper-evident provenance metadata |
| Paraphrase robustness | "does rewording break it" | Text watermark property; currently limited |
| Fine-tune removal | "adversarial unwatermark" | Attack that removes image watermark via decoder fine-tuning |
| Cross-modal detector | "unified SynthID" | November 2025 unified API across modalities |

## Pour en savoir plus

- [Kirchenbauer et al. — A Watermark for Large Language Models (ICML 2023, arXiv:2301.10226)](https://arxiv.org/abs/2301.10226) le mécanisme de marque d'eau des jetons
- [Fernandez et al. — Stable Signature (ICCV 2023, arXiv:2303.15435)](https://arxiv.org/abs/2303.15435) papier d'image de marque d'eau
- ["Stable Signature is Unstable" (arXiv:2405.07145)](https://arxiv.org/abs/2405.07145) l'attaque de déménagement
- [Google DeepMind — SynthID](https://deepmind.google/models/synthid/) la marque d'eau trans-modale
- [C2PA 2.2 Explainer (2025)](https://c2pa.org/specifications/specifications/2.2/explainer/Explainer.html) Standard de métadonnées
