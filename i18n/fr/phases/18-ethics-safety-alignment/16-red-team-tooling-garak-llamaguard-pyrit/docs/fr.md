# Les outils de l'équipe rouge  Garak, garde des Llama, PyRIT

> Trois outils de production encadrent la pile de l'équipe rouge de 2026. Llama Guard (Meta)  un classifiateur Llama-3.1-8B ajusté sur 14 catégories de danger MLCommons; le 2025 Llama Guard 4 est un classifiateur multimodale natif 12B taillé à partir de Llama 4 Scout. Garak (NVIDIA)  Scanner de vulnérabilité LLM open source avec des sondes statiques, dynamiques et adaptives pour les hallucinations, la fuite de données, l'injection rapide, la toxicité et les jailbreaks. PyRIT (Microsoft)  Campaignes multi-tournées de l'équipe rouge avec Crescendo, TAP et chaînes de convertisseurs personnalisées pour une exploitation profonde. Llama Guard 3 est documenté dans le "Llama 3 Herd of Models" de Meta (arXiv:2407.21783); Llama Guard 3-1B-INT4 dans arXiv:2411.17713; l'architecture de sonde de Garak dans github.com/NVIDIA/garak. Ces outils sont l'interface de production 2026 entre la recherche en équipe rouge (lesçons 12-15) et le déploiement (lession 17+).

**Type:** Build
**Languages:** Python, TypeScript (stdlib, tool-architecture simulator and Llama Guard-style classifier mock)
**Prerequisites:** Phase 18 · 12-15 (jailbreaks and IPI)
**Time:** ~75 minutes

## Objectifs d'apprentissage

- Décrire la position de Llama Guard 3/4 dans la pile de sécurité: classifiant d'entrée, de sortie ou les deux.
- Nombre des 14 catégories de risques MLCommons et indiquez une catégorie non évidente (abus par interprète de code).
- Décrivez l'architecture de la sonde de Garak: sondes, détecteurs, harnais.
- Décrivez la structure de la campagne multi-tours du PyRIT et comment il se compose avec les sondes Garak.

## Le problème

Les leçons 12-15 présentent la surface d'attaque. Les déploiements de production nécessitent une évaluation répétée et évolutive. Trois outils dominent 2026: Llama Guard (le classifiateur de défense), Garak (le scanner), PyRIT (l'orchestrateur de campagne). Chacun cible une couche différente du cycle de vie de l'équipe rouge.

## Le concept

### Garde des Llama (Meta)

Llama Guard 3 est un modèle Llama-3.1-8B ajusté pour la classification des entrées et sorties sur les catégories MLCommons AILuminate 14:
- Délits violents, crimes non violents, liés au sexe, CSAM, diffamation
- Conseils spécialisés, vie privée, IP, armes indiscriminées, haine
- Suicide/automutilation, contenu sexuel, élections, abus d'interprète de code

Il prend en charge 8 langues. Utilisation: place avant le LLM (modération d'entrée), après le LLM (modération de sortie), ou les deux. Les deux utilisations génèrent des distributions de formation différentes.

Llama Guard 3-1B-INT4 (arXiv:2411.17713, 440 Mo, ~ 30 jetons / s sur le processeur mobile) est la variante de bord quantifiée.

Llama Guard 4 (avril 2025) est un 12B, natif multimodal, taillé à partir de Llama 4 Scout. Il remplace les prédécesseurs de texte 8B et de vision 11B par un classifiateur qui ingère du texte + des images.

### Garak (NVIDIA)

Scanner de vulnérabilité open source.
- **Probes.**Générateurs d'attaque pour les hallucinations, fuites de données, injection rapide, toxicité, jailbreak. statiques (invitations fixes), dynamiques (invitations générées), adaptifs (répondait à la sortie cible).
- **Detectors.**Résultats par rapport aux modes de défaillance attendus  Toxiques, fuites, jailbroken.
- **Harnesses.**Gérer les paires de sondes détecteurs, exécuter des campagnes, générer des rapports.

TrustyAI intègre Garak avec les boucliers Llama-Stack (classificateur d'entrée Prompt-Guard-86M, classificateur de sortie Llama-Guard-3-8B) pour l'évaluation de la cible protégée de bout en bout.

### Le projet de loi

Python Toolkit pour l'identification des risques. Campaignes multi-tournées de l'équipe rouge.
- **Converters.**Transformer une requête de semence  paraphrase, coder, traduire, jouer de rôle.
- **Orchestrators.**Exécuter la campagne: Crescendo (escalade), TAP (branchage), RedTeaming (cycle personnalisé).
- **Scoring.**L'examen de la loi en tant que juge ou le classement en tant que juge.

PyRIT est le cousin le plus lourd de Garak. Garak exploite des milliers de sondes à tour unique; PyRIT exploite des campagnes à tour multiple profondes conçues pour briser des modes de défaillance spécifiques.

### La pile

Mettez la garde de llama des deux côtés du modèle. Exécutez Garak tous les soirs pour la régression. Exécutez PyRIT pour les campagnes de pré-édition. C'est la configuration par défaut de 2026 pour la plupart des déploiements de production.

### Les pièges d'évaluation

- **Judge identity.**Les trois outils peuvent utiliser un juge LLM; les disques de calibration du juge ont rapporté des ASR (leçon 12).
- **Probe staleness.**Les sondes Garak vieillissent à mesure que les modèles sont collés contre elles.
- **Llama Guard FPR on benign content.**Les premières versions de la Garde Llama ont sur-classifié le contenu politique et LGBTQ +; les calibrations de la Garde Llama 3/4 sont améliorées mais pas calibrées par déploiement.

### Là où cela s'inscrit dans la phase 18

Les leçons 12-15 sont les familles d'attaques. La leçon 16 est l'outillage de production. La leçon 17 (WMDP) est l'évaluation de la capacité à double usage. La leçon 18 est les cadres de sécurité frontaliers qui enveloppent ces outils dans une structure politique.

```figure
al-guard-stack
```

## Utilisez-le

`code/main.py`Il construit un classifiateur de type jouet Llama Guard (mot clé + fonctionnalités sémantiques sur 14 catégories), un harnais Garak jouet (boucle de détecteur de sonde) et une chaîne de convertisseur multi-tours de type PyRIT.

## La faire partir

Cette leçon produit `outputs/skill-red-team-stack.md`- En raison de la description du déploiement, il indique quels sont les trois outils appropriés, quels sont les outils à configurer et quelle cadence de régression à exécuter.

## Exercices

1. On court .`code/main.py`Comparer le taux de détection du classifiateur de type Llama-Guard sur les attaques à tour unique et à tour multiple.

2. Implémenter une nouvelle sonde Garak: une demande nuisible codée en base 64. Mesurer sa détection par le classifiateur de style Llama-Guard.

3. Étendre la chaîne de convertisseurs de style PyRIT avec un convertisseur "traducer en français, puis paraphraser".

4. Lisez la liste des catégories de danger de Llama Guard 3. Identifiez deux catégories où les données de formation produiraient réellement des taux de faux positifs élevés sur le contenu légitime des développeurs.

5. Comparer les principes de conception de Garak et PyRIT.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Llama Guard | "the classifier" | Fine-tuned Llama-3.1-8B/4-12B safety classifier with 14 hazard categories |
| Garak | "the scanner" | NVIDIA open-source vulnerability scanner; probes, detectors, harnesses |
| PyRIT | "the campaign tool" | Microsoft multi-turn red-team orchestrator; converters, orchestrators, scoring |
| Prompt-Guard | "the small classifier" | Meta's 86M prompt-injection classifier, paired with Llama Guard |
| TBSA | "tier-based scoring" | Garak's tier-based pass/fail replacing binary outcomes |
| Converter chain | "paraphrase + encode + ..." | PyRIT composition primitive for building multi-step attacks |
| MLCommons hazard categories | "the 14 taxonomies" | Industry-standard taxonomy Llama Guard targets |

## Pour en savoir plus

- [Meta — Llama Guard 3 (in Llama 3 Herd paper, arXiv:2407.21783)](https://arxiv.org/abs/2407.21783) le classifiant 8B
- [Meta — Llama Guard 3-1B-INT4 (arXiv:2411.17713)](https://arxiv.org/abs/2411.17713) classifiateur mobile quantifié
- [NVIDIA Garak — GitHub](https://github.com/NVIDIA/garak) le référentiel et la documentation du scanner
- [Microsoft PyRIT — GitHub](https://github.com/Azure/PyRIT) le kit d'outils de campagne
