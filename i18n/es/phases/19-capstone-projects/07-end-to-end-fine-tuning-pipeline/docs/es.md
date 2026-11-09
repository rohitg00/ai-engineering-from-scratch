# Capstone 07  Pipeline de ajuste fino de extremo a extremo (datos de SFT a DPO para servir)

> Un modelo de clase 8B entrenado en sus propios datos, DPO-aliñado en sus propias preferencias, cuantizado, especulativo-decodificado, y servido a tokens medibles $ / 1M. La pila abierta 2026 es Axolotl v0.8, TRL 0.15, Unsloth para la iteración, GPTQ/AWQ/GGUF para la cuantificación, vLLM 0.7 con EAGLE-3 para la servidumbre. La piedra angular es ejecutar toda la tubería de forma reproducible (YAML en, punto final servidos fuera) y publicar una tarjeta modelo en virtud del Marco de apertura modelo 2026.

**Type:** Capstone
**Languages:** Python (pipeline), TypeScript, YAML (configs), Bash (scripts)
**Prerequisites:** Phase 2 (ML), Phase 3 (DL), Phase 7 (transformers), Phase 10 (LLMs from scratch), Phase 11 (LLM engineering), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:**P2 · P3 · P7 · P10 · P11 · P17 · P18
**Time:** 35 hours

## El problema

Cada equipo serio de IA en 2026 mantiene un oleoducto de ajuste fino en el grifo. No porque envíen un modelo base fronterizo, sino porque la adaptación en aguas subyacentes  dominio SFT, DPO contra preferencias etiquetadas, borradores destilados para la descodificación especulativa, sirviendo con EAGLE-3  es donde las ganancias medibles viven. Axolotl v0.8 maneja configuraciones de SFT de múltiples GPU. TRL 0.15 maneja el DPO y el GRPO. Unsloth te da una rápida iteración de un solo GPU. vLLM 0.7 con EAGLE-3 empuja el rendimiento de decodificación 2-3x sin pérdida de calidad. La herramienta funciona; la herramienta está en las YAML, la higiene de datos y la disciplina de evaluación.

Se ejecutará una base de 8B a 14B (Llama 3.1 8B, Qwen3 14B o Gemma 3 12B) a través de SFT, luego DPO en datos específicos de tareas, cuantificar para servir y medir ganancias en comparación con lm-evaluation-harness, RewardBench-2, MT-Bench-v2 y MMLU-Pro. Se producirá una tarjeta modelo bajo el Marco de apertura del modelo 2026.

## Concepto

El oleoducto tiene cinco etapas.**Data**: dedup (MinHash / Datatrove), filtro de calidad (clasificador de estilo Nemotron-CC), desgaste de PII, control de higiene dividido contra la contaminación de los puntos de referencia públicos. **SFT**: Axolotl YAML, ZeRO-3 en 8xH100, horario cosino, secuencias envasadas, 2-3 épocas. **DPO or GRPO**: Configuración de TRL, 1 época, pares de preferencias etiquetados por humanos o según modelos, sintonización beta. **Quantize**: GPTQ + AWQ + GGUF para la flexibilidad de despliegue. **Serve**: vLLM 0,7 con cabezas especulativas EAGLE-3 (o SGLang con SpecForge), despliegue de K8, HPA en cola.

Las ablaciones son las entregadas: SFT-solo vs SFT+DPO vs SFT+GRPO en tres puntos de referencia específicos de tareas. métricas de servicio: tokens/s en lote 1 / 8 / 32, tasa de aceptación EAGLE-3, tokens de $/1M. Evaluación de seguridad: tasa de aprobación Llama Guard 4.

## Arquitectura

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

## El establo

- Datos: Datatrove para dedup, clasificador Nemotron-CC para calidad, Presidio para PII
- Base: Llama 3.1 8B, Qwen3 14B o Gemma 3 12B
- SFT: Axolotl v0.8 con ZeRO-3, Atención Flash 3, secuencias empaquetadas
- La configuración de preferencia: TRL 0,15 para DPO o GRPO; Unsloth para la iteración de un solo GPU
- Cuantificación: GPTQ (Marlin), AWQ, GGUF a través de llama.cpp
- Servicio: vLLM 0,7 con decodificación especulativa EAGLE-3 (o SGLang 0,4 + SpecForge)
- Eval: Im-evaluación-harness, RewardBench-2, MT-Bench-v2, MMLU-Pro
- Evaluación de seguridad: Llama Guard 4, ShieldGemma-2
- Infraestructura: Kubernetes + NVIDIA dispositivo de complemento, HPA en la métrica de espera de cola
- Observabilidad: W&B para la formación, Langfuse para la inferencia

```figure
ce-finetune-stages
```

## Construye el mismo

1. **Data pipeline.**Ejecutar Datatrove dedup en el corpus crudo. Aplicar clasificador de calidad estilo Nemotron-CC. Presidio scrubs PII. Escribir tren / val divididas con semilla explícita.

2. **Contamination check.**Para cada división de validación, compute MinHash contra MMLU-Pro, MT-Bench-v2, conjuntos de pruebas RewardBench-2.

3. **Axolotl SFT.**YAML con ZeRO-3, FA3, envasado de secuencias. 2-3 épocas en 8xH100.

4. **TRL DPO / GRPO.**Tomar el punto de control SFT, ejecutar una época de DPO en pares de preferencias (o GRPO con una recompensa verificable en matemáticas / código).

5. **Quantize.**Produce tres cuantos: GPTQ-INT4-Marlin, AWQ-INT4, GGUF-Q4_K_M para llama.cpp. Tamaño de registro y rendimiento nominal.

6. **Serve with speculative decoding.**vLLM 0.7 configuración con EAGLE-3 cabezas de proyecto entrenados a través de Red Hat Speculators. Medir la tasa de aceptación y la latencia de cola en el lote 1 / 8 / 32.

7. **Eval matrix.**ejecuta el arnés de lm-eval, RewardBench-2, MT-Bench-v2, MMLU-Pro en base, SFT-sólo, SFT+DPO, SFT+GRPO. Produce una tabla.

8. **Safety eval.**La velocidad de paso de Llama Guard 4 en el conjunto de desarrollo.

9. **Model card.**Modelo de MOF 2026: datos, capacitación, evaluación, seguridad, licencia, sección de reproducibilidad con YAML y SHAs comprometidas.

## Usalo

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

## Envío

`outputs/skill-finetuning-pipeline.md`Un solo comando ejecuta datos a través de SFT a través de DPO a través de quant a través de serve a través de eval, y emite una tarjeta modelo + el punto final servidor.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Eval delta vs base | Measured gain on target tasks (MMLU-Pro, MT-Bench-v2, task-specific) |
| 20 | Pipeline reproducibility | One command reruns end to end with identical seeds |
| 20 | Data hygiene | Dedup rate, PII scrub coverage, contamination check green |
| 20 | Serving efficiency | tokens/s at bs=1/8/32, EAGLE-3 acceptance rate, $/1M tokens |
| 15 | Model card + safety eval | 2026 MOF completeness + Llama Guard 4 pass rate |
| **100** | | |

## Los ejercicios

1. Ejecutar SFT-only vs SFT+DPO vs SFT+GRPO en el mismo índice de referencia específico de tarea.

2. Cambiar Llama 3.1 8B por Qwen3 14B. Medir los tokens de $ 1M a la calidad igualada.

3. Medir la tasa de aceptación de EAGLE-3 en los datos de dominio frente a ShareGPT genérico.

4. Inyecta el 1% de la contaminación (vaga de MMLU-Pro respuestas en los datos de entrenamiento) y vuelve a evaluar. Mira la precisión de MMLU-Pro saltar irreal. Construye una puerta de control de contaminación CI que captura esto.

5. Añadir LoRA SFT como alternativa a la completa ajuste fino. Medir la brecha de calidad en 10 veces menor memoria.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Axolotl | "SFT trainer" | Unified YAML-driven trainer for SFT, DPO, and distillation |
| TRL | "Preference tuner" | Hugging Face library for DPO, GRPO, PPO on LLMs |
| GRPO | "Group-relative policy optimization" | DeepSeek R1's RL recipe with verifiable rewards |
| EAGLE-3 | "Speculative decoding draft" | Draft heads that predict N tokens ahead; vLLM verifies with target model |
| MOF | "Model Openness Framework" | 2026 standard for grading model releases on data, code, license |
| Contamination check | "Split hygiene" | MinHash-based detection of test-set leakage into training |
| Acceptance rate | "EAGLE / MTP metric" | Fraction of drafted tokens the target model accepts |

## Leer más

- [Axolotl documentation](https://axolotl-ai-cloud.github.io/axolotl/) el entrenador de referencia SFT / DPO
- [TRL documentation](https://huggingface.co/docs/trl) Implementaciones de referencia de la DPO y de la GRPO
- [Unsloth](https://github.com/unslothai/unsloth) Referencia de iteración de un solo GPU
- [DeepSeek R1 paper (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) Metodología del GRPO
- [vLLM + EAGLE-3 documentation](https://docs.vllm.ai) pila de servicio de referencia
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) Entrenador alternativo de decodificación especulativa
- [Model Openness Framework (arXiv:2403.13784)](https://arxiv.org/abs/2403.13784): el estándar de clasificación de liberación abierta
- [lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness) ejecutor de evaluación canónica
