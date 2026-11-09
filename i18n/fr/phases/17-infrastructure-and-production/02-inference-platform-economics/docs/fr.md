# Économie des plateformes d'inférence  Feuilletons, Ensemble, Basétain, Modal, Réplication, à n'importe quelle échelle

> Le marché des inférences 2026 n'est plus une location de temps de GPU. Il se diviser en silicium personnalisé (Groq, Cerebras, SambaNova), plateformes GPU (Baseten, Together, Fireworks, Modal) et marchés API-first (Replicate, DeepInfra).$1/hr per GPU on May 1, 2026, and $La valorisation 4B sur 10T+ tokens par jour indique le modèle de travail axé sur le volume.$300M Series E at $La règle de positionnement compétitif est simple: les feux d'artifice optimisent la latence, ensemble optimisent la largeur du catalogue, baseten optimisent le polissage d'entreprise, modal optimisent Python-native DX, répétition optimisent la portée multimodal, Anyscale optimises distribué Python. Cette leçon vous donne une matrice que vous pouvez remettre à un fondateur.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy per-call economics comparator)
**Prerequisites:** Phase 17 · 01 (Managed LLM Platforms), Phase 17 · 04 (Serving Engine Internals)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Nombre des trois segments de marché (silicon personnalisé, plateformes GPU, API-first) et carte de chaque fournisseur à un segment.
- Expliquez pourquoi le modèle de tarification de l'API "par jeton" se concentre sur la courbe de coût du moteur de service et non sur celle du matériel.
- Calculer le coût effectif par demande auprès d'au moins trois fournisseurs et expliquer quand le coût par minute (Baseten, Modal) dépasse le coût par jeton.
- Identifier quelle plateforme est la bonne par défaut pour une charge de travail donnée (serveur sans éclat, haute capacité constante, variantes finement ajustées, multimodal).

## Le problème

Vous avez évalué les plateformes hypercalculaires gérées. Vous avez décidé que vous aviez besoin d'un fournisseur plus étroit et plus rapide  Feuilletons pour la latence, Ensemble pour la largeur, Baseten pour un modèle personnalisé finement ajusté. Maintenant vous avez six choix réels et les pages de prix ne sont pas alignées. Feuilletons montre $/M tokens; Baseten shows $/minute; Modal montre $/second; Replicate shows $On ne peut pas les comparer face à face sans modéliser la charge de travail.

Pire encore, le modèle d'affaires derrière chaque page de tarification est différent. Les feux d'artifice fonctionnent avec leur propre moteur personnalisé (FireAttention) sur les GPU partagées; le taux par jeton reflète leur courbe d'utilisation. Baseten vous donne des GPU Truss + dédiés; par minute reflète l'exclusivité. Modal est vrai Python sans serveur  par seconde de facturation avec sous-seconde démarrage froid. La même sortie (une réponse LLM), trois fonctions de coûts différentes.

Cette leçon modèle les six et vous dit quand chacun gagne.

## Le concept

### Les trois segments

**Custom silicon**Groq (LPU), Cerebras (WSE), SambaNova (RDU). Généralement, le décodeur est 5 à 10 fois plus rapide qu'un cluster basé sur GPU sur le même modèle. Le prix par jeton plus élevé (Groq était de ~ 0,99 $ / M sur Llama-70B fin 2025) mais imbattable pour les cas d'utilisation sensibles à la latence. Groq est le choix de production pour les agents vocaux et la traduction en temps réel.

**GPU platforms** Baseten, Together, Fireworks, Modal, Anyscale. Exécuté sur NVIDIA (H100, H200, B200 en 2026) ou parfois AMD. La couche économique entre " location de GPU brut " (RunPod, Lambda) et " service géré hypercalérisé " (Bedrock).

**API-first marketplaces** Répliquer, DeepInfra, OpenRouter, Fal. Catalogue large, pay-per-prediction ou pay-per-seconde, mettre l'accent sur le temps à la première appel.

### Feu d'artifice  plateforme GPU optimisée pour la latence

- Moteur FireAttention (custom); commercialisé avec une latence 4 fois inférieure à celle de vLLM sur des configurations équivalentes.
- Niveau de lot à ~50% de taux sans serveur pour les charges de travail non interactives.
- Le modèle finement ajusté sert au même rythme que le modèle de base  un véritable différenciateur par rapport aux fournisseurs qui facturent une prime pour votre LORA.
- Mi-2026: augmentation du loyer sur demande de GPU de 1 $/heure à compter du 1er mai 2026.
- Signal financier: évaluation de 4 B$, 10T+ tokens par jour gérés.

### Ensemble  optimisé pour la largeur

- 200 modèles, y compris les versions open source, dans les jours suivant la publication en amont.
- 50 à 70% moins cher que Replicate sur des modèles LLM équivalents  le positionnement "AI Native Cloud" est volume et catalogue.
- Inference + ajustement fin + formation dans une API.

### Baseten  optimisé pour les entreprises

- Cadre de confiance: emballage de modèle avec dépendances, secrets, config dans un seul manifeste.
- La GPU va de T4 à B200, facturation par minute avec une réduction raisonnable du démarrage à froid.
- SOC 2 type II, prêt pour HIPAA.
- $5B valuation, January 2026 Series E ($300 millions de dollars de CapitalG, IVP, NVIDIA).

### Modal  Python natif optimisé

- Infrastructure-as-code en Python pur. Décorer une fonction avec `@modal.function(gpu="A100")`et déployer avec un seul commandement.
- Le temps de facturation par seconde: le temps de chargement commence par 2 à 4 secondes avec le préchauffement; < 1s pour les petits modèles.
- $87M Series B at $1.1B évaluation (2025). Le score le plus fort de l'expérience des développeurs dans des enquêtes indépendantes.

### Réplication  largeur multimodal

- La plateforme par défaut pour les modèles d'image, vidéo et audio.
- L'intégration des écosystèmes (Zapier, Vercel, plugins CMS).
- Moins compétitif sur les taux de LLM par jeton mais gagne sur la variété multimodal.

### Native à rayons

- Construit sur Ray; RayTurbo est le moteur d'inférence propriétaire d'Anyscale (compétient avec vLLM).
- Le meilleur pour les charges de travail Python distribuées où l'étape d'inférence est un nœud dans un graphique plus grand.
- Gestion des clusters Ray; intégration étroite avec Ray AIR et Ray Serve.

### Par jeton par minute  lorsque chacun gagne

Le jeton a du sens lorsque la charge de travail est insensible à la latence et débordante  vous ne payez que pour ce que vous utilisez.

Règlement grossier: pour les charges de travail supérieures à ~ 30% d'utilisation continue d'un GPU dédié, par minute (Baseten, Modal) commence à battre par jeton (Fireworks, Together).

### Le moteur sur mesure est le vrai fossé

Chaque plateforme au-dessus de vLLM et SGLang revendique un moteur personnalisé. FireAttention, RayTurbo, la pile d'inférence de Baseten.

### Les chiffres que vous devriez vous rappeler

- Location de GPU pour feux d'artifice: augmentation d'une heure de 1 $ à compter du 1er mai 2026.
- Précédent: 4 fois moins de latence que vLLM sur des configurations équivalentes.
- Ensemble: 50-70% moins cher que Replicate sur LLM.
- Valorisation du basétain: $5B (Series E, Jan 2026, $300M de tour).
- Valorisation des capitaux: 1,1 milliard de dollars (série B, 2025).
- Les battements par minute par jeton au-dessus de ~ 30% d'utilisation soutenue.

```figure
cost-per-token
```

## Utilisez-le

`code/main.py`Les résultats de cette étude ont été analysés en fonction des résultats obtenus par les six fournisseurs sur une charge de travail synthétique sur différents modèles de prix.$/day and effective $- M. Pour trouver le break-even entre par-token et par-minute.

## La faire partir

Cette leçon produit `outputs/skill-inference-platform-picker.md`. Compte tenu du profil de charge de travail, de la SLA et du budget, choisit la plateforme d'inférence principale et nomme le deuxième.

## Exercices

1. On court .`code/main.py`À quelle utilisation continue Baseten (par minute) bat Fireworks (par jeton) pour un modèle 70B sur un H100?
2. Votre produit sert à la génération d'images plus le chat plus le dialogue par texte.
3. Les feux d'artifice augmentent les prix d'un dollar par heure sur votre modèle principal. Modélisez l'impact des coûts mixtes si 40% de votre trafic passe à la catégorie de lot (50% de réduction).
4. Un client réglementé a besoin de GPU dédiées SOC 2 Type II + HIPAA +. Quelles trois plateformes sont viables et laquelle gagne sur FinOps?
5. Comparer le coût par 1000 prédictions pour Llama 3.1 70B sur Fireworks sans serveur, ensemble à la demande, Baseten dédié, et Replicate API.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Custom silicon | "non-GPU chips" | Groq LPU, Cerebras WSE, SambaNova RDU — optimized for decode |
| FireAttention | "Fireworks engine" | Custom attention kernel; marketed at 4x lower latency than vLLM |
| Truss | "Baseten's format" | Model packaging manifest; dependencies + secrets + serving config |
| Per-token | "API pricing" | Charge by tokens consumed; pay for no idle |
| Per-minute | "dedicated pricing" | Charge by wall-clock GPU time; wins at high utilization |
| Per-prediction | "Replicate pricing" | Charge per model invocation; common for image/video |
| RayTurbo | "Anyscale engine" | Proprietary inference on Ray; competes with vLLM on Ray clusters |
| Batch tier | "50% off" | Non-interactive queue at reduced rate; common on Fireworks, OpenAI |
| Fine-tuned at base rate | "Fireworks LoRA" | Charge LoRA-served requests at base model's rate (differentiator) |

## Pour en savoir plus

- [Fireworks Pricing](https://fireworks.ai/pricing) Tarifs par jeton, niveau de lot, location de GPU.
- [Baseten Pricing](https://www.baseten.co/pricing/) taux par minute, capacité engagée, niveaux d'entreprise.
- [Modal Pricing](https://modal.com/pricing) vitesses de GPU par seconde et niveau libre.
- [Together AI Pricing](https://www.together.ai/pricing) Catalogue de modèle et tarifs par jeton.
- [Anyscale Pricing](https://www.anyscale.com/pricing) RayTurbo et géré Ray prix.
- [Northflank — Fireworks AI Alternatives](https://northflank.com/blog/7-best-fireworks-ai-alternatives-for-inference) évaluation comparative.
- [Infrabase — AI Inference API Providers 2026](https://infrabase.ai/blog/ai-inference-api-providers-compared) paysage des fournisseurs.
