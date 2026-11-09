# Plateformes de LLM gérées  Bedrock, Vertex AI, Azure OpenAI

> Trois hypercalers, trois stratégies distinctes. AWS Bedrock est un marché modèle  Claude, Llama, Titan, Stabilité, Cohere derrière une API. Azure OpenAI est un partenariat exclusif OpenAI plus des unités de débit fournies (PTU) pour une capacité dédiée. Vertex AI est le premier Gemini avec la meilleure histoire multimodal et long-context. En 2026, l'analyse artificielle mesure Azure OpenAI à ~ 50 ms en moyenne et Bedrock à ~ 75 ms sur les équivalents Llama 3.1 405B  Les PTU expliquent le fossé parce que la capacité dédiée bat partagée sur demande. La règle de décision n'est pas "qui est le plus rapide" mais "qui catalogue de modèle et FinOps surface correspond à mon produit". Cette leçon vous apprend à choisir avec les compromis écrits, pas les vibrations.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy cost-and-latency comparator)
**Prerequisites:** Phase 11 (LLM Engineering), Phase 13 (Tools & Protocols)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Nombrez les trois stratégies de plateforme (marché vs exclusive vs Gémeaux-première) et correspondrez chacune à un cas d'utilisation du produit.
- Expliquez ce que les unités de débit fournies (PTU) vous achètent dans Azure OpenAI et pourquoi Bedrock à la demande lit généralement environ 25 ms plus lentement à l'échelle 405B.
- Décrire la surface d'attribution FinOps pour chaque plateforme (profiles d'inference d'application Bedrock vs Vertex projet par équipe vs champs d'action Azure + réservations PTU).
- Écrivez une politique de "double fournisseur minimum" et expliquez pourquoi le verrouillage d'un seul fournisseur est une erreur coûteuse en 2026.

## Le problème

Vous avez choisi Claude 3.7 Sonnet pour votre produit. Vous devez maintenant le servir. Vous pouvez appeler l'API Anthropic directement, ou vous pouvez l'appeler via AWS Bedrock, ou vous pouvez passer par un gateway. L'API directe est la plus simple; Bedrock ajoute BAAs, points de fin VPC, IAM et attribut CloudWatch. Le gateway ajoute failover, facturation unifiée et limites de tarifs entre les fournisseurs.

La question la plus profonde est le catalogue. Si vous avez besoin de Claude et Llama et Gémeaux dans le même produit, vous ne pouvez pas les acheter tous à partir d'un seul endroit à moins que ce lieu soit Bedrock plus Vertex plus Azure OpenAI simultanément. Les hyperscalers ne sont pas interchangeables  ils ont chacun fait un pari différent sur qui possède la couche modèle.

Cette leçon trace les trois paris, l'écart de latence, l'écart de FinOps et le risque de verrouillage.

## Le concept

### Trois stratégies

**AWS Bedrock**La société a été créée par le groupe de sociétés de recherche et de recherche de l'industrie du marketing.

**Azure OpenAI** le partenariat exclusif. Vous obtenez GPT-4 / 4o / 5 / o-série, DALL·E, Whisper et fine-tuning des modèles OpenAI dans les centres de données Azure. Aucun modèle non OpenAI dans le catalogue "Azure OpenAI Service"  ceux qui vont à Azure AI Foundry (produit séparé).

**Vertex AI** Gémeaux d'abord, tout le reste en deuxième. Gémeaux 1.5 / 2.0 / 2.5 Flash et Pro, plus Model Garden (troisième partie).

### L'écart de latence à l'échelle

L'analyse artificielle présente des critères de référence continus. Sur les déploiements équivalents de Llama 3.1 405B, la latence médiane du premier jeton Azure est d'environ 50 ms avec les PTU; Bedrock sur la demande partagée est d'environ 75 ms. L'écart n'est pas une défaillance AWS  c'est une différence de modèle de capacité. Azure vend des PTU (Unités de débit fournies), qui réservent la capacité de la GPU à votre locataire. L'équivalent de Bedrock (Provisioned Throughput) existe mais commence à environ 21 $/heure par unité, et la plupart des clients restent sur le partage sur demande.

La capacité partagée sur demande est en concurrence avec le trafic de chaque autre client. La capacité dédiée n'est pas. Si votre SLA de produit est TTFT < 100 ms à P99, vous achetez soit des PTU sur Azure, achetez Bedrock Provisioned Throughput, ou acceptez la variance par défaut.

### Économie du débit fourni

Azure PTUs: un bloc réservé de calcul d'inférence. Jusqu'à ~ 70% d'épargne par rapport à la demande pour les charges de travail prévisibles. Coûts fixes par heure indépendamment du trafic  vous payez pour la réservation même lorsque vous êtes en activité. Le break-even est généralement d'environ 40-60% d'utilisation soutenue.

Travail fourni par le lit: $21-$50 par heure selon le modèle et la région. mathématiques similaires  break-even est environ la moitié de l'utilisation maximale.

La capacité fournie par Vertex est vendue par SKU Gemini; les prix varient selon le modèle et la région et sont moins publiquement annoncés.

### Surface FinOps  le différenciateur réel

**Bedrock Application Inference Profiles**Les données de référence sont les plus propres du marché.`team`- Je suis là .`product`- Je suis là .`feature`; parcourir toutes les invocations de modèle à travers elle; CloudWatch décompose le coût par profil sans traitement post-processé.

**Vertex**Vous modélisez chaque équipe comme un projet GCP, mettez des étiquettes sur chaque ressource, et utilisez BigQuery Billing Export + DataStudio pour les roulements. Plus de travail, mais BigQuery vous donne un SQL arbitraire sur les données de coûts.

**Azure**Les tags sont hérités des groupes de ressources, pas des demandes, donc l'attribution par demande nécessite des métriques personnalisées d'Application Insights ou une passerelle qui imprime les en-têtes.

Le schéma: Bedrock est le plus propre natif, Vertex est le plus flexible via BigQuery, Azure est le plus opaque à moins que vous n'ayez un instrument.

### Le risque de blocage est de 2026

L'engagement d'un hypercalculateur était bien quand un modèle dominait. En 2026, la frontière bouge mensuellement  Claude 3.7 un trimestre, Gemini 2.5 le trimestre suivant, GPT-5 le trimestre suivant.

Les équipes de travail adoptent le modèle suivant: deux fournisseurs minimum pour tout appel de LLM critique pour le produit. Bedrock plus Azure OpenAI est la paire commune  Claude d'un, GPT de l'autre, défaillance entre eux, même passerelle. L'augmentation des coûts est négligeable car les routes de passerelle sont optimales; l'augmentation de la disponibilité pendant les pannes (comme l'incident d'Azure OpenAI de janvier 2025, l'arrêt AWS us-east-1) est décisif.

### Résidence des données, BAA et industries réglementées

Bedrock: BAA dans la plupart des régions; points d'extrémité VPC; barreaux.
Azure OpenAI: HIPAA, SOC 2, ISO 27001; résidence des données de l'UE; la réglementation par défaut de l'entreprise.
Vertex: HIPAA, GDPR, résidence des données par région; la pile de conformité de Google Cloud.

Les différences sont les politiques de conservation des données, la façon dont les journaux sont gérés et si la surveillance des abus lit votre trafic (option par défaut sur la plupart; opt-out disponible pour les entreprises).

### Les chiffres que vous devriez vous rappeler

- TTFT médian d'Azure OpenAI sur les équivalents Llama 3.1 405B: ~50 ms (avec PTU).
- TTFT médiane de la couche à la demande: ~75 ms.
- Travail fourni par le lit: $21-$50/h par unité.
- Régulation de la PTU Azure: utilisation soutenue de 40 à 60%.
- Économies de PTU par rapport à la demande à haute utilisation: jusqu'à 70%.

```figure
i4-platform-lanes
```

## Utilisez-le

`code/main.py`Il compare les trois plateformes sur une charge de travail synthétique  il modélise l'économie sur demande contre PTU, la variance TTFT et la fidélité de l'attribution des coûts.

## La faire partir

Cette leçon produit `outputs/skill-managed-platform-picker.md`. Compte tenu du profil de la charge de travail (modèles nécessaires, TTFT SLA, volume quotidien, exigences de conformité), il recommande une plateforme primaire, un plan de réaction et un plan d'instrumentation FinOps.

## Exercices

1. On court .`code/main.py`À quelle utilisation durable Azure PTU surpasse la demande pour un modèle de classe 70B ?
2. Votre produit a besoin de Claude 3.7 Sonnet et GPT-4o. Concevez un déploiement de deux fournisseurs qui va à quel hypercaler, quel gateway est devant, quelle est la politique de défaillance ?
3. Un client de soins de santé réglementé a besoin de BAAs, de résidence de données US-East et de TTFT sous 100ms P99 .
4. Vous découvrez que votre facture de Bedrock a augmenté 4 fois ce mois-ci sans changement de trafic.
5. Pour une charge de travail Claude de 100 millions de jetons par mois, qui est moins chère  API Anthropic directe, Bedrock à la demande ou Bedrock Provisioned Throughput ?

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Bedrock | "AWS LLM service" | Model marketplace across Claude, Llama, Titan, Mistral, Cohere |
| Azure OpenAI | "Azure's ChatGPT" | Exclusive OpenAI models in Azure datacenters with enterprise controls |
| Vertex AI | "Google's LLM" | Gemini-first platform with Model Garden for third-party models |
| PTU | "dedicated capacity" | Provisioned Throughput Unit — reserved inference GPUs, priced per hour |
| Application Inference Profile | "Bedrock tagging" | Per-product cost/usage profile with tags, CloudWatch-native |
| Model Garden | "Vertex catalog" | Vertex AI's third-party model section, separate from Gemini |
| Two-provider minimum | "LLM redundancy" | Policy of running every critical LLM path across ≥2 hyperscalers |
| BAA | "HIPAA paperwork" | Business Associate Agreement; required for PHI; provided by all three |
| Abuse monitoring | "the log watcher" | Provider-side safety scan on prompts/outputs; opt-out in enterprise |

## Pour en savoir plus

- [AWS Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/) carte de taux d'autorisation et tarification de la capacité de production fournie.
- [Azure OpenAI Service Pricing](https://azure.microsoft.com/en-us/pricing/details/azure-openai/) Économie et cartes de taux de PTU.
- [Vertex AI Generative AI Pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing) Les niveaux Gémeaux et les suppléments du modèle jardin.
- [Artificial Analysis LLM Leaderboard](https://artificialanalysis.ai/) des indicateurs de référence de latence et de débit continus entre les fournisseurs.
- [The AI Journal — AWS Bedrock vs Azure OpenAI CTO Guide 2026](https://theaijournal.co/2026/03/aws-bedrock-vs-azure-openai/) cadre de décision de l'entreprise.
- [Finout — Bedrock vs Vertex vs Azure FinOps](https://www.finout.io/blog/bedrock-vs.-vertex-vs.-azure-cognitive-a-finops-comparison-for-ai-spend) mécanique d'attribution côte à côte.
