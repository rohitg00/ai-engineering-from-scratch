# Les données de référence sont les données de référence de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de l'analyse de la base.

> Cinq indicateurs déterminent si un déploiement d'inférence fonctionne. TTFT est pré-remplir plus que la file d'attente plus le réseau. TPOT (souvent dénommé ITL, bien que les outils ne soient pas d'accord sur le fait que ITL compte le premier jeton) est le coût de décode lié à la mémoire par jeton. La latence de bout en bout est TTFT plus TPOT fois longueur de sortie. Le débit est des jetons par seconde agrégés dans toute la flotte. Mais ce qui compte pour le produit, c'est le goodput  la fraction des demandes qui ont répondu à chaque SLO simultanément. Un débit élevé à un débit faible signifie que vous traitez des jetons qui n'atteignent jamais les utilisateurs à temps. Numéros de référence pour Llama-3.1-8B-Instruire sur le TRT-LLM en 2026: moyenne TTFT 162 ms, moyenne TPOT 7,33 ms, moyenne E2E 1,093 ms. Toujours signaler P50, P90, P99  jamais juste méchant. Et attention au piège de mesure: GenAI-Perf exclut le TTFT du calcul ITL, LLMPerf l'inclut; deux outils ne sont pas d'accord sur le TPOT pour la même course.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy percentile calculator and goodput reporter)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Définir avec précision le TTFT, le TPOT, l'ITL, l'E2E, le débit et le goodput et nommer le composant que chaque mesure.
- Expliquez pourquoi la moyenne est la statistique erronée pour le service de LLM et comment lire P50/P90/P99.
- Construire une limite multi-SLO (par exemple TTFT < 500 ms ET TPOT < 15 ms ET E2E < 2 s) et calculer le goodput en fonction de celle-ci.
- Nombre de deux outils de référence qui ne sont pas d'accord sur le TPOT pour la même période et expliquez pourquoi.

## Le problème

" Notre débit est de 15 000 jetons par seconde. " Alors quoi ? Si 40% des demandes ont dépassé 2 secondes de bout en bout, les utilisateurs ont abandonné la session.

L'inference a plusieurs axes de latence et chacun échoue différemment. Le pré-remplissage est calculé et mesure avec une longueur rapide. Le décode est lié à la mémoire et mesure avec la taille du lot. Le retard de file d'attente est un problème opérationnel. Le réseau est un problème de distance physique. Vous avez besoin de métriques distinctes pour chacune, et vous avez besoin de percentiles, et vous avez besoin d'un seul composite qui dit " l'utilisateur a obtenu ce qu'il attendait "

## Le concept

### TTFT  temps pour le premier jeton

`TTFT = queue_time + network_request + prefill_time`

Le préfil est le plus important lorsque les instructions sont longues. Sur Llama-3.3-70B FP8 sur H100, une requête de 32k prend environ 800 ms de préfil pur. Le temps de file d'attente est le comportement du planificateur sous chargement. La demande de réseau est le temps de fil, y compris TLS.

### TPOT / ITL  latence entre les jetons

Beaucoup de noms pour une quantité.`TPOT`(temps par jeton de sortie), `ITL`(la latence entre les jetons), `decode latency per token` tout de même. C'est le temps entre les jetons diffusés consécutifs après le premier.

`TPOT = (decode_forward_time + scheduler_overhead) / tokens_produced`

Sur la même pile Llama-3.3-70B H100 avec pré-remplissage en morceaux, le TPOT est d'environ 7 ms. Sans pré-remplissage en morceaux, pendant un long pré-remplissage sur une séquence voisine, le TPOT peut atteindre 50 ms. Regardez P99, pas de moyenne.

### La latence E2E

`E2E = TTFT + TPOT * output_tokens + network_response`

Pour les sorties longues (> 500 jetons), E2E est dominé par le TPOT. Pour les sorties courtes avec des demandes longues, E2E est dominé par le TTFT.

### Résultats

`throughput = total_output_tokens / elapsed_time`

La métrique agrégée vous indique l'efficacité de la flotte, pas la santé des demandes individuelles.

### La métrique dont vous vous souciez vraiment

`goodput = fraction of requests meeting (TTFT <= a) AND (TPOT <= b) AND (E2E <= c)`

La SLO est une restriction multi-constance. Une demande est "bonne" seulement si chaque restriction est respectée. Goodput est la part. Certains papiers et tableaux de bord rapportent plutôt goodput comme un taux: demandes par seconde qui répondent à chaque SLO. Multipliez la part par le taux de demande pour convertir.

En 2026, le goodput est la métrique utilisée dans les soumissions MLPerf Inference v6.0 et dans le suivi interne de SLA chez les fournisseurs de plateformes d'IA.

### Pourquoi la méchanceté est la mauvaise statistique

Les distributions de latence LLM sont à droite. Un lot de décode avec un voisin de pré-remplissage peut expédier 500 jetons avec TPOT ~ 7 ms et 20 jetons avec TPOT ~ 60 ms. Le TPOT moyen est de 9 ms. P99 TPOT est de 65 ms. Les utilisateurs frappent régulièrement le P99  c'est pourquoi ils partent.

Rapporte toujours le triple (P50, P90, P99). Pour l'expérience utilisateur, P99 est celui que vous optimisez.

### Numéros de référence  Llama-3.1-8B-Instruction sur le TRT-LLM, 2026

- TTFT moyen: 162 ms
- TPOT moyen: 7,33 ms
- moyenne E2E: 1 093 ms
- P99 TPOT: varie de 10 à 25 ms selon la configuration de préchargement en morceaux.

Ce sont les points de référence NVIDIA publiés. Ils changent avec la taille du modèle (70B montrerait 3-5x), le matériel (H100 vs B200 ~ 3x), et la charge.

### Le piège de mesure

Deux des outils de référence les plus utilisés pour 2026 ne sont pas d'accord sur le TPOT pour la même période:

- **NVIDIA GenAI-Perf**: exclut le TTFT du calcul de l'ITL. L'ITL commence par le jeton 2.
- **LLMPerf**: inclut le TTFT. ITL commence par le jeton 1.

Pour une demande avec TTFT 500 ms et 100 jetons de sortie en 700 ms de décode total, GenAI-Perf rapporte `ITL = 700/99 = 7.07 ms`, rapporte LLMPerf `ITL = 1200/100 = 12.00 ms`Le choix de l'outil change le numéro.

Indiquez toujours quel outil, publiez toujours la définition.

### Construire un SLO

Un SLO raisonnable pour un modèle de chat 70B en 2026:

- TTFT P99 <= 800 ms.
- TPOT P99 <= 25 ms.
- E2E P99 <= 3 s pour les sorties de < 300 jetons.
- Objectif de rendement >= 99%.

Les SLO d'entreprise resserrent le TTFT (200-400 ms) et relâchent l'E2E. Le but est de les noter, de mesurer les trois et de suivre le goodput en un seul composite.

### Comment mesurer

- Exécuter un trafic réel ou synthétique réaliste (LLMPerf avec `--mean-input-tokens 800 --stddev-input-tokens 300 --mean-output-tokens 150`)
- Objectif 2x concurrences maximales pour la course de référence.
- Exécutez 30 à 50 itérations, prenez des percentiles de l'échantillon combiné.
- Publier avec le nom de l'outil, la version de l'outil, le modèle, le matériel, la simultanéité, la distribution rapide.

```figure
throughput-latency
```

## Utilisez-le

`code/main.py`Il est également possible de générer une distribution de latence synthétique, d'appliquer un SLO et de calculer le goodput.

Le [Inside an LLM Serving GPU](https://aiengineeringfromscratch.com/inside-an-llm-serving-gpu?users=1)La machine montre d'où vient le temps par jeton de sortie sur un NVIDIA L4. Une étape de décode est de 16,41 Go de poids, ce qui prend au moins 54,7 ms à 300 GB/s, et la étape mesurée a pris 60,16 ms.

## La faire partir

Cette leçon produit `outputs/skill-slo-goodput-gate.md`. Compte tenu de la charge de travail et de la SLO, il produit une recette de référence prête à l'IC/CD qui déploie les portes sur une bonne puissance plutôt que sur une capacité de débit.

## Exercices

1. On court .`code/main.py`Comment le goodput change-t-il lorsque vous serrez le P99 TPOT de 30 ms à 15 ms ?
2. Un vendeur cite "15.000 tok/s sur Llama 3.3 70B H100". Nommez trois questions à poser avant de lui faire confiance.
3. Pourquoi le pré- remplissage en morceaux protège le P99 TPOT mais pas le TPOT ?
4. Construire un SLO de consommation pour un assistant vocal (le premier jeton est entendu, pas lu). Quelle mesure est la plus visible par l'utilisateur?
5. Lisez les documents LLMPerf README et GenAI-Perf. Identifiez trois autres mesures où les outils ne sont pas d'accord.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| TTFT | "time to first token" | Queue + network + prefill; dominated by prefill at long prompts |
| TPOT | "time per output token" | Memory-bound decode cost per token after first |
| ITL | "inter-token latency" | Same as TPOT in most tools (not all — see GenAI-Perf) |
| E2E | "end to end" | TTFT + TPOT * output_len; response-side network on top |
| Throughput | "tok/s" | Fleet efficiency; useless without latency percentiles |
| Goodput | "SLO-met rate" | Fraction of requests meeting every SLO constraint simultaneously |
| P99 | "tail" | 1-in-100 worst-case latency; the user experience metric |
| SLO multi-constraint | "the joint" | AND of all three latency bounds; a request fails if any one is violated |
| GenAI-Perf vs LLMPerf | "the tool trap" | Tools disagree on whether ITL includes TTFT |

## Pour en savoir plus

- [NVIDIA NIM — LLM Benchmarking Metrics](https://docs.nvidia.com/nim/benchmarking/llm/latest/metrics.html) définition canonique de TTFT, ITL, TPOT.
- [Anyscale — LLM Serving Benchmarking Metrics](https://docs.anyscale.com/llm/serving/benchmarking/metrics) définitions alternatives et recette de mesure.
- [BentoML — LLM Inference Metrics](https://bentoml.com/llm/inference-optimization/llm-inference-metrics) mesure appliquée sur les déploiements réels.
- [LLMPerf](https://github.com/ray-project/llmperf) Résumé de référence de source ouverte basé sur Ray.
- [GenAI-Perf](https://github.com/triton-inference-server/perf_analyzer/blob/main/genai-perf/README.md) L'outil de référence de NVIDIA.
- [MLPerf Inference](https://mlcommons.org/benchmarks/inference-datacenter/) l'indice de référence basé sur la qualité accepté par l'industrie.
