# Capstone 14  Serveur d'inferences de décoding spéculatif

> Le décoding spéculatif  un projet bon marché propose des jetons, le modèle cible les vérifie en un seul passage  est maintenant une optimisation prête à la production, pas un truc de recherche. EAGLE-3 dans vLLM 0,7 vaisseaux 2,5-3x de débit sur le trafic réel. P-EAGLE (AWS 2026) a encore poussé les spéculations parallèles. Le SpecForge de SGLang a formé des chefs de recrutement à l'échelle. Le centre des spéculateurs de Red Hat a publié des projets alignés pour des modèles ouverts communs. TensorRT-LLM a fait le décoding spéculatif de première classe sur NVIDIA. La pile de production de 2026 est vLLM ou SGLang avec des projets de famille EAGLE, une quantification FP8 ou INT4 et un HPA en attente de file d'attente. Cette pierre angulaire doit servir deux modèles ouverts à un débit de 2,5 fois plus de la ligne de base avec un rapport complet de latence de la queue.

**Type:** Capstone
**Languages:** Python (serving), TypeScript, C++ / CUDA (kernel inspection), YAML (configs)
**Prerequisites:** Phase 3 (deep learning), Phase 7 (transformers), Phase 10 (LLMs from scratch), Phase 17 (infrastructure)
**Phases exercised:**P3 · P7 · P10 · P17
**Time:** 30 hours

## Problème

Le décoding spéculatif est devenu une marchandise en 2026. Les chefs de projet EAGLE-3 s'entraînent sur les états cachés du modèle cible et prédisent N jetons à l'avenir; le modèle cible se vérifie en un seul passage. Les taux d'acceptation de 60-80% se traduisent par un débit de bout en bout de 2 à 3 fois plus élevé. VLLM 0.7 intègre cela de manière native. SGLang + SpecForge vous fournit le pipeline d'entraînement. Les spéculateurs de Red Hat publient des projets alignés pour Llama 3.3 70B, Qwen3-Coder-30B MoE, GPT-OSS-120B.

Le navire est dans les opérations de service, pas le modèle. Le taux d'acceptation dérive avec la distribution du trafic (ShareGPT vs code vs données de domaine). La latence de la queue sous rejet est pire que sans spéculation  vous devez signaler p99 à plusieurs tailles de lot, pas seulement des jetons/seconde. Coût par 1M jetons vs Anthropic / OpenAI API est le levier de crédibilité.

## Concept

Le décoding spéculatif a deux couches.**draft**Le modèle (tête, ngram ou modèle plus petit aligné sur l'objectif) propose k tokens candidats par étape.**target**Le modèle vérifie tous les k en un seul passage; tout préfixe accepté remplace le chemin avide.

L'Eagle-3 dépasse les projets ngram sur la plupart du trafic. P-EAGLE effectue des spéculations parallèles pour les projets d'arbres plus profonds.

Le déploiement est Kubernetes. vLLM 0.7 exécute une réplique par GPU ou parallèle tensor. HPA auto-échelles sur queue-attente plutôt que CPU. FP8 (Marlin) et INT4 (AWQ) quants conservent la mémoire de GPU à l'intérieur d'une enveloppe H100 / H200. Le rapport de bout en bout est le débit, taux d'acceptation, p50 / p99 au lot 1/8/32, et $ / 1M jetons.

## Architecture

```
request ingress
    |
    v
vLLM server (0.7) or SGLang (0.4)
    |
    +-- draft: EAGLE-3 heads | P-EAGLE parallel | ngram fallback
    +-- target: Llama 3.3 70B | Qwen3-Coder-30B | GPT-OSS-120B
    |     quantized FP8-Marlin or INT4-AWQ
    |
    v
verify pass: batch k draft tokens through target
    |
    v (accept prefix; resample for rejected suffix)
    v
token stream back to client
    |
    v
Prometheus metrics: throughput, acceptance rate, queue wait, latency p50/p99
    |
    v
HPA on queue-wait metric
```

## La pile

- Servant: vLLM 0,7 ou SGLang 0,4
- Méthodes spéculatives: tête de projet EAGLE-3, spéculation parallèle P-EAGLE, rétrécissement en gramme
- Formation en projet: SpecForge (SGLang) ou Red Hat Speculators
- Modèles cibles: Llama 3.3 70B, Qwen3-Coder-30B MoE, GPT-OSS-120B
- Quantification: FP8 (Marlin), INT4 AWQ
- Déploiement: Kubernetes + NVIDIA plugin de périphérique; HPA sur la métrique d'attente de file d'attente
- Eval: ShareGPT, MT-Bench-v2, GSM8K, HumanEval pour la mesure de l'acceptation par domaine
- Référence: Décodage spéculatif TensorRT-LLM pour une ligne de base fournisseur

```figure
cf-spec-decode
```

## Faites-le

1. **Target model prep.**Choisissez Llama 3.3 70B. Quantifier à FP8 via Marlin. déployer sous vLLM 0.7 sur 1xH100 (ou 2x tensor parallèle).

2. **Draft source.**Tirez un chef de projet EAGLE-3 aligné de Red Hat Speculators (ou entraînez-le via SpecForge).

3. **Baseline numbers.**Avant la spéculation: jetons/s au lot 1/8/32, latence p50/p99, utilisation de la GPU.

4. **Enable EAGLE-3.**Retour à la configuration, répétition du même indice de référence Rapport accélération, taux d'acceptation, delta de latence de la queue p99.

5. **P-EAGLE.**Permettez la spéculation parallèle; mesurez l'arbre de projet plus profond par rapport à l'AIGLE-3 série.

6. **Domain traffic.**Exécuter ShareGPT vs HumanEval vs trafic spécifique au domaine à travers le même serveur. Mesurer le taux d'acceptation par distribution. Identifier quand les projets dérivent.

7. **Second target model.**Exécutez le même pipeline sur Qwen3-Coder-30B MoE. Le projet est plus compliqué (bruit de routage MoE).

8. **K8s HPA.**Déploiement sous K8 avec suivi de l' HPA `queue_wait_ms`- Montrez l'échelle lorsque la charge triple.

9. **Cost comparison.**Computez les jetons $/1M contre l'anthropique Claude Sonnet 4.7 et OpenAI GPT-5.4 sur la même évaluation.

## Utilisez-le

```
$ curl https://infer.example.com/v1/chat/completions -d '{"messages":[...]}'
[serve]     vLLM 0.7, Llama 3.3 70B FP8, EAGLE-3 active
[decode]    bs=8, accepted_tokens_per_step=3.2, acceptance_rate=0.76
[latency]   first-token 42ms, full-response 980ms (620 tokens)
[cost]      $0.34 per 1M output tokens at sustained throughput
```

## La faire partir

`outputs/skill-inference-server.md`Un piquet de service mesuré avec décoding spéculatif, un rapport complet de référence et un déploiement de K8.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Measured speedup vs baseline | 2.5x+ throughput at matched quality on two models |
| 20 | Acceptance rate on realistic traffic | Per-distribution acceptance-rate report |
| 20 | P99 tail-latency discipline | p99 at batch 1/8/32 with and without speculation |
| 20 | Ops | K8s deploy, HPA on queue-wait, rollout smooth |
| 15 | Write-up and methodology | Clear explanation of what changed and why |
| **100** | | |

## Exercices

1. Mesurer la dégradation du taux d'acceptation lorsque le projet est une version en retard sur la cible (par exemple, Llama 3.3 -> 3.4 dérive).

2. Implementer le ralentissement des gramme: si l'acceptation de l'EAGLE-3 est inférieure à un seuil, passer aux projets de gramme.

3. Exécuter une expérience contrôlée de MoE: le même Qwen3-Coder-30B avec le bruit de routage injecté versus l'extérieur. Mesurer la sensibilité de l'acceptation du projet.

4. Préparer à H200 (141 Go). Rapporte la taille du modèle par réplique de la tête gagnée et si vous pouvez servir un Llama 3.3 70B non quantifié.

5. Benchmark TensorRT-LLM décoding spéculatif sur le même H100 matériel.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Draft model | "Speculator" | Small model that proposes N tokens for the target to verify |
| EAGLE-3 | "2026 draft architecture" | Draft head trained on target hidden states; ~75% acceptance |
| P-EAGLE | "Parallel speculation" | Tree of draft branches verified in one target pass |
| Acceptance rate | "Hit rate" | Fraction of drafted tokens accepted without resampling |
| Quantization | "FP8 / INT4" | Lower-precision weights to fit more model in GPU memory |
| Queue wait | "HPA metric" | Time a request waits in the pending queue before inference starts |
| Speculators hub | "Aligned drafts" | Red Hat Neural Magic hub of EAGLE drafts for common open models |

## Pour en savoir plus

- [vLLM EAGLE and P-EAGLE documentation](https://docs.vllm.ai) la pile de service de référence
- [P-EAGLE (AWS 2026)](https://aws.amazon.com/blogs/machine-learning/p-eagle-faster-llm-inference-with-parallel-speculative-decoding-in-vllm/) papier de décoding parallèle + intégration
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) L'équipement de formation de la tête de projet
- [Red Hat Speculators](https://github.com/neuralmagic/speculators) centre de projet aligné
- [TensorRT-LLM speculative decoding](https://nvidia.github.io/TensorRT-LLM/) alternative au fournisseur
- [Fireworks.ai serving architecture](https://fireworks.ai/blog) référence commerciale
- [EAGLE-3 paper (arXiv:2503.01840)](https://arxiv.org/abs/2503.01840) le document de méthode
- [vLLM repository](https://github.com/vllm-project/vllm) code et critères de référence
