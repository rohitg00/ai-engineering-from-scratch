# Privé différentiel pour les LLM

> Le DP-SGD reste la norme  les mises à jour de gradients injectées par bruit offrent des garanties formelles (epsilon, delta). Les coûts généraux en matière de calcul, de mémoire et d'utilité sont importants; la configuration DP fine-tuning (LoRA + DP-SGD) à paramètres efficaces est la configuration commune de 2025 (ACM 2025). Deux corps de preuves en tension: l'inférence de l'adhésion canarienne (Duan et coll., 2024) rapporte un succès limité contre les modèles linguistiques; l'extraction de données de formation (Carlini et coll., 2021; Nasr et coll., 2025) récupère une mémorisation verbale substantielle. Résolution (arXiv:2503.06808, mars 2025): l'écart est dans ce qui est mesuré  canaries insérées par rapport aux données "plus extractibles". Les nouvelles conceptions canaries permettent des MIA basées sur des pertes sans modèles d'ombre et donnent le premier audit non trivial de DP d'un LLM formé sur des données réelles avec des garanties réalistes de DP. Les alternatives: PMixED (arXiv:2403.15638)  prédiction privée au moment de l'inférence par le biais d'un mélange d'experts sur les distributions de jetons suivants; génération de données synthétiques DP (Google Research 2024). Attaque émergente: Inversion différentielle de la vie privée via le retour de la MLL  fuite de la confiance.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, DP-SGD noise-injection and ε-δ accountant demonstration)
**Prerequisites:** Phase 01 · 09 (information theory), Phase 10 · 01 (large-model training)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Définir la confidentialité différentielle (epsilon, delta) et indiquer la recette DP-SGD.
- Expliquez la tension de 2024 à 2025: l'IA canarienne et l'extraction de données de formation donnent des images différentes.
- Décrivez le PMixED et pourquoi la prédiction privée de l'inférence-temps est une alternative à la formation en DP.
- Décrivez l'inversion différentielle de la confidentialité via l'attaque de rétroaction de la LLM.

## Le problème

Les LLM mémorisent. Carlini et coll. 2021 ont montré que les modèles de langage de production reproduisent le texte de formation littérale à la demande. DP est la défense formelle: entraîne de sorte que la sortie soit probablement insensible à un seul exemple de formation. Les preuves 2024-2025 montrent que DP-SGD est nécessaire mais que les valeurs ε déployées peuvent ne pas correspondre au modèle de menace.

## Le concept

### (ε, δ) - confidentialité différentielle

Un algorithme aléatoire .$M$est $(\varepsilon, \delta)$-DP si pour deux ensembles de données différents dans un exemple et un événement $S$- Le numéro de la liste:

```math
P(M(D) \in S) \le e^{\varepsilon} \cdot P(M(D') \in S) + \delta.
```

Interprétation: la distribution de sortie est assez proche (paramétrisée par ε) pour que la contribution d'un seul individu ne puisse être déduite de manière fiable, sauf avec probabilité δ.

### Département de la pêche

Abadi et coll. 2016. La recette standard:
1. Prenez un mini lot.
2. Compute les gradients par exemple.
3. Cliquez chaque gradient par exemple à un seuil C.
4. Sumer les gradients coupés et ajouter le bruit gaussien avec std $\sigma \cdot C$- Je suis désolé .
5. Utilisez la somme bruyante pour mettre à jour les paramètres.

Le coût de la protection de la vie privée est suivi par un comptable (comptable de Moments, comptable de Rényi DP). Les valeurs ε rapportées dans la littérature LLM varient considérablement selon le modèle de menace, la sensibilité des données et la cible d'utilité; il n'y a pas de défaut universellement "sécurisé" ε. Les exemples publiés couvrent environ ε ≈ 110 dans certains paramètres de formation LLM, mais ce sont des exemples illustratifs  non recommandés. Le bas ε nécessite généralement plus de bruit et peut augmenter la perte d'utilité.

### LOR + DP-SGD

Le DP-SGD complet d'un modèle frontalier est prohibitif. LoRA (Hu et coll. 2022) limite les mises à jour de gradient à un petit adaptateur, réduisant ainsi le stockage de gradient par exemple. LoRA + DP-SGD est la configuration commune de 2025.

### La tension de 2024 à 2025

Deux lignes de preuve:

- **Canary MIA (Duan et al. 2024).**Insérer des canaries uniques dans les données de formation, mesurer si un attaquant d'inference de membres peut les identifier. Rapports de succès limité sur les modèles de langage. Suggère que la MIA est difficile.
- **Training-data extraction (Carlini 2021, Nasr et al. 2025).**Précisez le modèle avec un préfixe; mesurez s'il récupère le texte littéral de la formation. Rapporte une mémorisation substantielle. Suggère que MIA est facile dans le sens pertinent.

Résolution de mars 2025 (arXiv:2503.06808): les deux mesures différentes. MIA demande " est l'exemple e dans D ? " sur les canaries insérées. L'extraction demande " que puis-je récupérer de D ? " L'exemple " le plus extractible " est ce qui compte pour la vie privée; les canaries en rapportent moins parce qu'ils ne sont pas optimisés pour être extractibles.

Les nouveaux designs canariens, les MIA basées sur des pertes sans modèles d'ombre, le premier audit non trivial de DP d'un LLM sur des données réelles avec des garanties réalistes de DP.

### Les alternatives à la formation en DP

- **PMixED (arXiv:2403.15638).**Prédiction privée au moment de l'inférence. mélange d'experts sur les distributions de jetons suivants; chaque expert voit une fragmentation de données de formation; aggregation ajoute du bruit pour DP. Évite complètement la formation DP.
- **DP synthetic data generation (Google Research 2024).**LoRA-fin-tune avec DP-SGD, échantillons de données synthétiques, entraînez un classificateur en aval sur les données synthétiques.

Les deux évitent le coût de l'utilité de la formation complète des DP au prix d'un modèle de menace différent.

### Réversion différentielle de la protection de la vie privée via le retour d'information du MLL

L'attaque de 2025 émerge. Utilisez les scores de confiance d'un modèle formé par DP comme un oracle pour identifier les individus. Même lorsque les sorties ne fuissent pas, les distributions de confiance peuvent.

La défense: ne pas exposer les confidences, ou les truncer/quantifier avant l'exposition.

### Là où cela s'inscrit dans la phase 18

Les leçons 20-21 sont les préjugés/l'équité. La leçon 22 est la vie privée. La leçon 23 est la provenance par marquage d'eau. La leçon 27 couvre la couche réglementaire de la provenance des données.

```figure
an-dp-clip-noise
```

## Utilisez-le

`code/main.py`Simulation du DP-SGD sur un ensemble de données de classification binaire de jouets. Vous pouvez analyser le multiplicateur de bruit σ et la norme de coupe C et suivre le budget (ε, δ) et le coût de précision. Une "attaque canarienne" insère un exemple de formation unique et mesure si un test de perte de journaux peut le détecter avant et après le DP.

## La faire partir

Cette leçon produit `outputs/skill-dp-audit.md`. Compte tenu de la revendication de DP concernant le déploiement d'un modèle linguistique, elle vérifie: les valeurs (ε, δ), le comptable utilisé, le protocole d'évaluation des MIA et si des vecteurs d'exposition à la confiance ont été évalués.

## Exercices

1. On court .`code/main.py`- Le balayage .$\sigma \in \lbrace 0.5, 1.0, 2.0 \rbrace$Les données de l'entreprise doivent être fournies à l'aide de l'analyse de la valeur de l'entreprise et doivent être fournies à l'aide de l'analyse de la valeur de l'entreprise.

2. Mettre en œuvre une insertion canarienne et un test de perte de journaux.$\sigma = 1.0$- Je suis désolé .

3. Lisez Nasr et coll. 2025 sur l'extraction de données de formation. Pourquoi le succès de l'extraction ne s'effondre pas sous la moyenne ε?

4. Conceptez un déploiement à l'aide de PMixED (arXiv:2403.15638) qui fonctionne entièrement au moment de l'inférence. Quel est le modèle de menace que PMixED aborde que DP-SGD ne fait pas?

5. Définir une contre-mesure qui limite la fuite du score de confiance et estime son coût de déploiement.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| DP | "(ε, δ)-differential privacy" | Formal privacy: output distribution close under neighbouring-dataset change |
| DP-SGD | "noise-injected SGD" | Gradient clipping + Gaussian noise addition; standard DP training |
| LoRA + DP-SGD | "efficient private fine-tune" | DP-SGD on low-rank adapters; standard 2025 configuration |
| MIA | "membership inference" | Attack that determines whether an example was in training data |
| Canary | "inserted watermark example" | Unique training example used to measure DP leakage |
| PMixED | "private inference mixture" | Inference-time DP via mixture-of-experts on next-token distributions |
| DP Reversal | "confidence leakage attack" | Attack that uses a model's confidence as an oracle for re-identification |

## Pour en savoir plus

- [Abadi et al. — DP-SGD (arXiv:1607.00133)](https://arxiv.org/abs/1607.00133) l'algorithme standard de formation en DP
- [Carlini et al. — Extracting Training Data (arXiv:2012.07805)](https://arxiv.org/abs/2012.07805) le papier d'extraction canonique
- [Duan et al. — Canary MIA on LLMs (arXiv:2402.07841, 2024)](https://arxiv.org/abs/2402.07841) IMM à succès limité
- [Kowalczyk et al. — Auditing DP for LLMs (arXiv:2503.06808, March 2025)](https://arxiv.org/abs/2503.06808) résolution de la tension
- [PMixED (arXiv:2403.15638)](https://arxiv.org/abs/2403.15638) Prédiction privée de l'inférence-temps
