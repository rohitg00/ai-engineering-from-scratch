# Tests A/B Features du LLM  GrowthBook, Statsig et le problème des vibrations

> Les tests A/B traditionnels n'ont pas été conçus pour les LLM non déterministes. La distinction essentielle: les évaluations répondent "le modèle peut-il faire le travail?" Les tests A/B répondent "les utilisateurs se soucient-ils?" Les deux sont nécessaires; la livraison sur les contrôles de vibration est terminée. Ce qu'il faut tester en 2026: ingénierie rapide (phrase), sélection de modèle (GPT-4 vs GPT-3.5 vs OSS; précision vs coût vs latence), paramètres de génération (température, top-p). Cas réels: une variante du modèle de récompense du chatbot a donné +70% de longueur de conversation et +30% de rétention; les expériences de ligne d'objet Nextdoor AI ont donné +1% de CTR après le raffinement de la fonction de récompense; Khan Academy Khanmigo a fait une itération sur un axe de latence par rapport à la précision mathématique. Partage de plateforme: **Statsig**(acquis par OpenAI pour 1,1 milliard de dollars en septembre 2025)  Tests séquentiels, CUPED, tout en un. **GrowthBook** open source, stock natif, moteurs bayésiens + fréquentistes + séquentiels, CUPED, vérifications SRM, corrections Benjamini-Hochberg + Bonferroni. Vous choisissez en fonction des préférences de stock SQL et si "acquis par OpenAI" est important pour votre organisation.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy sequential test simulator)
**Prerequisites:** Phase 17 · 13 (Observability), Phase 17 · 20 (Progressive Deployment)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Distinguer les évaluations ("le modèle peut-il faire le travail") des tests A/B ("les utilisateurs se soucient").
- Nombrez trois axes testables (prompte, modèle, paramètres) et choisissez la métrique pour chacun.
- Expliquez les corrections de CUPED, de test séquentiel et de comparaison à plusieurs reprises de Benjamin-Hochberg.
- Choisissez Statsig ou GrowthBook en fonction de la posture de stockage SQL et de la position d'acquisition d'entreprise.

## Le problème

Vous avez réglé manuellement un système de commande. Il se sent mieux. Vous le envoyez. Les changements de conversion par bruit. Vous blâmez la métrique. Ou vous avez envoyé un nouveau modèle et la conversion ne bouge pas.

Les équations répondent si le modèle peut effectuer une tâche sur un ensemble étiqueté. Ils ne répondent pas si les utilisateurs préfèrent la sortie. Seule une expérience en ligne contrôlée répond à cela, et seulement si l'expérience a suffisamment de puissance, contrôle le non-determinisme et corrige les comparaisons multiples.

## Le concept

### Tests Evals contre test A/B

**Evals** hors ligne, étiqueté, juge (rubrique ou LLM-as-judge ou humain). Réponse: "La sortie est-elle correcte / utile / sûre sur cette distribution fixe?"

**A/B test** en ligne, utilisateurs en direct, randomisés. Réponse: "La nouvelle variante déplace-t-elle la métrique au niveau de l'utilisateur qui compte?"

Les Evals prennent des régressions avant l'exposition; A/B confirme l'impact du produit après.

### Qu' est-ce que vous devez tester ?

1. **Prompt engineering** formulaire, structure de la demande du système, exemples.
2. **Model selection** GPT-4 contre GPT-3.5-Turbo contre Llama-OSS. Métrique: précision (tâche) + coût/demand + latence P99.
3. **Generation parameters**- température, top-p, max_tokens.

### CUPED  réduction de la variance

Expériences contrôlées utilisant des données pré-expérientielles. Régressez la variance pré-période avant de comparer la post-période. Réduction typique de la variance: 30-70%.

Mise en œuvre: Statsig et GrowthBook sont mis en œuvre.

### Tests séquentiels

Les tests séquentiels ("peek-and-decide") contrôlent le taux de faux positifs sous des regards répétés. Les procédures séquentielles toujours valides (mSPRT, les séquences de confiance de Howard) vous permettent d'arrêter tôt sur les gagnants clairs.

### Corrections de comparaison multiples

L'exécution de 20 tests A/B à 95% de confiance produit un faux positif par hasard.

### Résultats de l'analyse

Le hash d'affectation randomisera les utilisateurs en variantes. Si la division 50/50 donne 47/53, quelque chose est cassé.

### Statsig vs GrowthBook

**Statsig**- Le numéro de la liste:
- Acquis par OpenAI pour 1,1 milliard de dollars (septembre 2025).
- Tests séquentiels, CUPED, populations résistantes.
- Tout en un: drapeaux de caractéristiques + expérimentation + observabilité.
- Le meilleur ajustement: l'équipe veut déjà un produit en bundle, ne se soucie pas de la propriété OpenAI.

**GrowthBook**- Le numéro de la liste:
- Le code de base est ouvert (MIT); native de l'entrepôt (lire directement de Snowflake/BigQuery/Redshift).
- Moteurs multiples: bayésien, fréquentiste, séquentiel.
- CUPED, SRM, Bonferroni, corrections de la BH.
- Autogestion ou cloud géré.
- Le meilleur ajustement: magasin SQL-entrepôt, équipe de données contrôle la couche métrique, veut OSS.

### Le non-déterminisme complique le pouvoir

Le même prompt produit des sorties différentes. Les calculs de puissance traditionnels prennent en compte les observations de la DII. Avec le non-determinisme LLM, la taille effective de l'échantillon est inférieure à la taille nominale. Multipliez la taille de l'échantillon requise de ~ 1,3-1,5x comme marge de sécurité.

### Résultats réels des affaires

- Variante du modèle de récompense du chatbot: +70% de longueur de conversation, +30% de rétention.
- Lines d'objet suivantes: +1% CTR après raffinement de la fonction récompense.
- Khan Academy Khanmigo: échange de latence par rapport à la précision mathématique.

### L'anti-pattern: expédition sur vibrations

Chaque ingénieur senior peut nommer une fonctionnalité qui a été expédiée parce que "elle se sent mieux" sans A/B. La plupart d'entre eux ont régressé des mesures de produit que l'équipe n'a pas remarqué pendant des mois.

### Les chiffres que vous devriez vous rappeler

- Statsig acquis par OpenAI: 1,1 milliard de dollars, septembre 2025.
- Le livre de croissance: MIT open source; Bayésien + fréquentiste + séquentiel.
- Réduction de la variance de la CUPED: 30 à 70%.
- Non-déterminisme de la LML → tampon de taille d'échantillon de +30 à 50%.

```figure
mx-sequential-test
```

## Utilisez-le

`code/main.py`Il simule un test A/B séquentiel avec des limites fixes et séquentielles.

## La faire partir

Cette leçon produit `outputs/skill-ab-plan.md`- Étant donné le changement de fonctionnalité, la charge de travail, la ligne de base, les choix de la plateforme, les portes, la taille de l'échantillon.

## Exercices

1. On court .`code/main.py`Pour une élévation de 5% prévue avec conversion de 3% de référence, quelle taille d'échantillon pour 80% de puissance ?
2. Choisissez Statsig ou GrowthBook pour un client local réglementé par les soins de santé.
3. Conçonnez une A/B qui teste GPT-4 contre GPT-3.5 sur le coût par billet résolu.
4. Votre canary passe mais A/B montre une conversion de -1,2%.
5. Appliquez CUPED avec une covariation pré-période qui explique 60% de la variance post-période (corrélation carrée 0,6).

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Eval | "offline test" | Labeled-set evaluation of model capability |
| A/B test | "experiment" | Live randomized comparison on users |
| CUPED | "variance reduction" | Pre-period regression to reduce variance |
| Sequential test | "peek-ok test" | Always-valid procedure allowing early stop |
| Multiple comparison | "the family error" | Running many tests inflates false positives |
| Bonferroni | "tight correction" | Divide α by number of tests |
| Benjamini-Hochberg | "BH FDR" | False-discovery-rate control, less conservative |
| SRM | "bad split" | Sample ratio mismatch; assignment bug |
| Statsig | "OpenAI owned" | Commercial all-in-one, acquired 2025 |
| GrowthBook | "the OSS one" | MIT warehouse-native platform |
| mSPRT | "sequential probability ratio test" | Classical sequential procedure |

## Pour en savoir plus

- [GrowthBook — How to A/B Test AI](https://blog.growthbook.io/how-to-a-b-test-ai-a-practical-guide/)
- [Statsig — Beyond Prompts: Data-Driven LLM Optimization](https://www.statsig.com/blog/llm-optimization-online-experimentation)
- [Statsig vs GrowthBook comparison](https://www.statsig.com/perspectives/ab-testing-feature-flags-comparison-tools)
- [Deng et al. — CUPED](https://www.exp-platform.com/Documents/2013-02-CUPED-ImprovingSensitivityOfControlledExperiments.pdf)
- [Howard — Confidence Sequences](https://arxiv.org/abs/1810.08240)
