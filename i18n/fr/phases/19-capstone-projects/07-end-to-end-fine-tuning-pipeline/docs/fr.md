# Capstone 07  Pipeline de fin-à-fin de réglage (données de SFT à DPO à servir)

> Un modèle de classe 8B formé sur vos propres données, aligné sur vos propres préférences, quantifié, décodé par des spéculations et servi à des jetons mesurables de 1 million de dollars. La pile ouverte 2026 est Axolotl v0.8, TRL 0.15, Unsloth pour l'itération, GPTQ/AWQ/GGUF pour la quantification, vLLM 0.7 avec EAGLE-3 pour la serveur. La pierre angulaire est de faire fonctionner le pipeline entier de manière reproduisable (YAML en, serveur de point de sortie) et de publier une carte modèle dans le cadre du Cadre d'ouverture modèle 2026.

**Type:** Capstone
**Languages:** Python (pipeline), TypeScript, YAML (configs), Bash (scripts)
**Prerequisites:** Phase 2 (ML), Phase 3 (DL), Phase 7 (transformers), Phase 10 (LLMs from scratch), Phase 11 (LLM engineering), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:**P2 · P3 · P7 · P10 · P11 · P17 · P18
**Time:** 35 hours

## Problème

Chaque équipe sérieuse d'IA en 2026 maintient un pipeline d'ajustement fin sur le robinet. Non pas parce qu'ils expédient un modèle de base frontalier, mais parce que l'adaptation en aval  domaine SFT, DPO contre les préférences étiquetées, les dessins distillés pour le décoding spéculatif, servant avec EAGLE-3  est où les gains mesurables vivent. Axolotl v0.8 gère les configurations SFT multi-GPU. TRL 0,15 gère le DPO et le GRPO. Unsloth vous donne une itération rapide à GPU unique. VLLM 0.7 avec EAGLE-3 pousse le décodage de débit 2-3x sans perte de qualité. L'outillage fonctionne; l'artisanat est dans les YAML, l'hygiène des données et la discipline d'évaluation.

Vous exécuterez une base 8B à 14B (Llama 3.1 8B, Qwen3 14B ou Gemma 3 12B) via SFT puis DPO sur les données spécifiques à la tâche, quantifier pour servir et mesurer les gains par rapport à lm-évaluation-harness, RewardBench-2, MT-Bench-v2 et MMLU-Pro. Vous produirez une carte modèle dans le cadre du modèle 2026 Openess Framework.

## Concept

Le pipeline a cinq étapes.**Data**: dédouble (MinHash / Datatrove), filtre de qualité (classificateur de style Nemotron-CC), dépollution des PII, contrôle d'hygiène partagé contre la contamination par les indicateurs de référence publics. **SFT**: Axolotl YAML, ZeRO-3 sur 8xH100, calendrier cosine, séquences emballées, 2 à 3 époques. **DPO or GRPO**: configuration TRL, 1 époque, paires de préférences soit étiquetées par l'homme soit évaluées par le modèle, réglage bêta. **Quantize**: GPTQ + AWQ + GGUF pour une flexibilité de déploiement. **Serve**: vLLM 0,7 avec EAGLE-3 tête spéculative (ou SGLang avec SpecForge), déploiement de K8s, HPA en file d'attente.

Les ablations sont les suivantes: SFT-only vs SFT+DPO vs SFT+GRPO sur trois critères de référence spécifiques à la tâche.

## Architecture

```
raw data (HF datasets + internal)
    |
    v
Datatrove dedup + Nemotron-CC quality filter + PII scrub
    |
    v
split hygiene (MMLU-Pro contamination check)
    |
    v
Axolotl SFT config (YAML)  ---> 8xH100, ZeRO-3
    |
    v
TRL DPO / GRPO config       ---> 4xH100, 1 epoch
    |
    v
GPTQ + AWQ + GGUF quantize
    |
    v
vLLM 0.7 + EAGLE-3 speculative decoding
    |
    v
K8s deployment, HPA on queue-wait
    |
    v
lm-eval-harness + RewardBench-2 + MT-Bench-v2 + MMLU-Pro
    |
    v
model card (2026 MOF) + safety eval (Llama Guard 4)
```

## La pile

- Données: Datatrove pour déduction, classifiant Nemotron-CC pour qualité, Presidio pour III
- Base: Llama 3.1 8B, Qwen3 14B ou Gemma 3 12B
- SFT: Axolotl v0.8 avec ZeRO-3, Attention Flash 3, séquences emballées
- Téléchargement de la préférence: TRL 0,15 pour le DPO ou le GRPO; Unsloth pour l'itération à GPU unique
- Quantification: GPTQ (Marlin), AWQ, GGUF par l'intermédiaire de llama.cpp
- Servant: vLLM 0,7 avec décoding spéculatif EAGLE-3 (ou SGLang 0,4 + SpecForge)
- Eval: lm-évaluation-harness, récompense-banque-2, MT-banque-v2, MMLU-pro
- Évaluation de la sécurité: Llama Guard 4, ShieldGemma-2
- Infrastructure: Kubernetes + NVIDIA plugin de périphérique, HPA sur la métrique d'attente de file d'attente
- Observabilité: W&B pour la formation, Langfuse pour l'inférence

```figure
ce-finetune-stages
```

## Faites-le

1. **Data pipeline.**Exécutez le déduction de Datatrove sur le corpus brut. Appliquez le classifiateur de qualité de style Nemotron-CC. Presidio scrubs PII. Écrivez les fractions train/val avec des graines explicites.

2. **Contamination check.**Pour chaque fraction de validation, calculer MinHash contre MMLU-Pro, MT-Bench-v2, RewardBench-2 ensembles de test.

3. **Axolotl SFT.**YAML avec ZeRO-3, FA3, emballage de séquences. 2 à 3 époques sur 8xH100.

4. **TRL DPO / GRPO.**Prenez le point de contrôle SFT, exécutez une époque de DPO sur les paires de préférences (ou GRPO avec une récompense vérifiable sur les maths/code).

5. **Quantize.**Produire trois quantiques: GPTQ-INT4-Marlin, AWQ-INT4, GGUF-Q4_K_M pour llama.cpp. Taille record et débit nominal.

6. **Serve with speculative decoding.**VLLM 0.7 configuration avec EAGLE-3 chefs de projet formés via Red Hat Speculators. Mesurer le taux d'acceptation et la latence de la queue au lot 1 / 8 / 32. Rapporte $/1M jetons vs Anthropic / OpenAI sur la même évaluation.

7. **Eval matrix.**Exécutez lm-eval-harness, RewardBench-2, MT-Bench-v2, MMLU-Pro sur base, SFT-seulement, SFT+DPO, SFT+GRPO. Produisez un tableau.

8. **Safety eval.**Le déploiement de la défense de l'appareil de déploiement.

9. **Model card.**Modèle MOF 2026: données, formation, évaluation, sécurité, licence, section reproductibilité avec YAML et SHA engagés.

## Utilisez-le

```
$ ./pipeline.sh config/llama3.3-8b-domainX.yaml
[data]    300k deduped, 12k filtered, 280k accepted (seed=7)
[SFT]     3 epochs, 8xH100, 6h12m, val loss 1.42 -> 1.03
[DPO]     1 epoch, beta=0.08, 4xH100, 1h40m
[quant]   GPTQ-INT4 4.6 GB, AWQ-INT4 4.8 GB, GGUF-Q4_K_M 5.1 GB
[serve]   vLLM 0.7, EAGLE-3 acceptance 0.74, p99 126ms @ bs=8
[eval]    MMLU-Pro +3.2, MT-Bench-v2 +0.41, RewardBench-2 +0.08
[card]    model-card.md generated under 2026 MOF
```

## La faire partir

`outputs/skill-finetuning-pipeline.md`Une seule commande exécute des données via SFT à travers DPO à travers quant à travers serve à travers eval, et émet une carte modèle + le point d'extrémité servi.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Eval delta vs base | Measured gain on target tasks (MMLU-Pro, MT-Bench-v2, task-specific) |
| 20 | Pipeline reproducibility | One command reruns end to end with identical seeds |
| 20 | Data hygiene | Dedup rate, PII scrub coverage, contamination check green |
| 20 | Serving efficiency | tokens/s at bs=1/8/32, EAGLE-3 acceptance rate, $/1M tokens |
| 15 | Model card + safety eval | 2026 MOF completeness + Llama Guard 4 pass rate |
| **100** | | |

## Exercices

1. Exécutez SFT-only vs SFT+DPO vs SFT+GRPO sur le même benchmark spécifique à la tâche.

2. Échangez le Llama 3.1 8B contre Qwen3 14B. Mesurez les jetons de 1 million de dollars à la même qualité.

3. Mesurer le taux d'acceptation EAGLE-3 sur les données de domaine par rapport au ShareGPT générique.

4. Injecter 1% de la contamination (leak MMLU-Pro réponses dans les données de formation) et réinitialiser l'évaluation. regarder MMLU-Pro accuracy sauter irréaliste. Construire une porte de contrôle de contamination CI qui capture cela.

5. Ajoutez LoRA SFT comme alternative à la réglage fin complet. Mesurez l'écart de qualité à une mémoire 10 fois inférieure.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Axolotl | "SFT trainer" | Unified YAML-driven trainer for SFT, DPO, and distillation |
| TRL | "Preference tuner" | Hugging Face library for DPO, GRPO, PPO on LLMs |
| GRPO | "Group-relative policy optimization" | DeepSeek R1's RL recipe with verifiable rewards |
| EAGLE-3 | "Speculative decoding draft" | Draft heads that predict N tokens ahead; vLLM verifies with target model |
| MOF | "Model Openness Framework" | 2026 standard for grading model releases on data, code, license |
| Contamination check | "Split hygiene" | MinHash-based detection of test-set leakage into training |
| Acceptance rate | "EAGLE / MTP metric" | Fraction of drafted tokens the target model accepts |

## Pour en savoir plus

- [Axolotl documentation](https://axolotl-ai-cloud.github.io/axolotl/) le formateur de référence SFT / DPO
- [TRL documentation](https://huggingface.co/docs/trl) Implémentations de référence du DPO et du GRPO
- [Unsloth](https://github.com/unslothai/unsloth) référence d'itération de GPU unique
- [DeepSeek R1 paper (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) Méthodologie du GRPO
- [vLLM + EAGLE-3 documentation](https://docs.vllm.ai) pile de service de référence
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) entraîneur de décoding spéculatif alternatif
- [Model Openness Framework (arXiv:2403.13784)](https://arxiv.org/abs/2403.13784): la norme de classification des libérations ouvertes
- [lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness) coureur d'évaluation canonique
