# Capstone 07  Pipeline de ajuste fino de ponta a ponta (Dados para SFT para DPO para servido)

> Um modelo de classe 8B treinado com os seus próprios dados, alinhado com o DPO com as suas próprias preferências, quantizado, decifrado especulativamente e servido a tokens mensuráveis de US$ 1 milhão. A pilha aberta 2026 é Axolotl v0.8, TRL 0.15, Unsloth para iteração, GPTQ/AWQ/GGUF para quantização, vLLM 0.7 com EAGLE-3 para servir. A pedra angular consiste em executar de forma reprodutiva todo o gasoduto (YAML em, ponto final de serviço) e publicar um modelo de cartão no âmbito do Marco de Abridão Modelo 2026.

**Type:** Capstone
**Languages:** Python (pipeline), TypeScript, YAML (configs), Bash (scripts)
**Prerequisites:** Phase 2 (ML), Phase 3 (DL), Phase 7 (transformers), Phase 10 (LLMs from scratch), Phase 11 (LLM engineering), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:**P2 · P3 · P7 · P10 · P11 · P17 · P18
**Time:** 35 hours

## Problemas

Todas as equipes de IA serias em 2026 mantêm um pipeline de ajuste fino. Não porque eles enviam um modelo base de fronteira, mas porque a adaptação para baixo  domínio SFT, DPO contra preferências rotuladas, rascunhos destilados para decodificação especulativa, servindo com EAGLE-3  é onde as vitórias mensuráveis vivem. Axolotl v0.8 lida com configurações SFT de várias GPUs. O TRL 0,15 opera com DPO e GRPO. O Unsloth dá-te uma rápida iteração de GPU. VLLM 0,7 com EAGLE-3 empurra o decodificador de rendimento 2-3x sem perda de qualidade. A ferramenta funciona; o trabalho está nos YAMLs, na higiene de dados e na disciplina de avaliação.

Você executará uma base de 8B a 14B (Llama 3.1 8B, Qwen3 14B ou Gemma 3 12B) através de SFT, em seguida, DPO em dados específicos de tarefas, quantizar para servir e medir ganhos em relação a lm-evaluation-harness, RewardBench-2, MT-Bench-v2 e MMLU-Pro. Você produzirá um modelo de cartão sob o 2026 Model Openness Framework.

## Conceptos

O oleoduto tem cinco etapas.**Data**: dedup (MinHash / Datatrove), filtro de qualidade (classificador de estilo Nemotron-CC), esfregamento de PII, controlo de higiene dividido contra contaminação de referência pública. **SFT**Axolotl YAML, ZeRO-3 em 8xH100, cronograma cosínico, sequências embaladas, 2-3 épocas. **DPO or GRPO**: Configuração TRL, 1 época, pares de preferências, etiquetados por humanos ou avaliados por modelos, sintonização beta. **Quantize**: GPTQ + AWQ + GGUF para flexibilidade de implantação. **Serve**: vLLM 0,7 com cabeças especulativas EAGLE-3 (ou SGLang com SpecForge), implantação de K8s, HPA na fila de espera.

As ablações são as resultantes: SFT-only vs SFT+DPO vs SFT+GRPO em três benchmarks específicos de tarefa. Metricas de serviço: tokens/s no lote 1 / 8 / 32, taxa de aceitação EAGLE-3, tokens de $/1M. Avaliação de segurança: taxa de aprovação Llama Guard 4. Modelo de cartão: avaliações de viés, sementes de reprodução, licenciamento de dados.

## Arquitetura

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

## Estaca

- Dados: Datatrove para dedup, classificador Nemotron-CC para qualidade, Presidio para PII
- Base: Llama 3.1 8B, Qwen3 14B ou Gemma 3 12B
- SFT: Axolotl v0.8 com ZeRO-3, Flash Attention 3, sequências embaladas
- A regulação preferencial: TRL 0,15 para DPO ou GRPO; Unsloth para iteração de GPU única
- Quantização: GPTQ (Marlin), AWQ, GGUF via llama.cpp
- Servidora: vLLM 0,7 com decodificação especulativa EAGLE-3 (ou SGLang 0,4 + SpecForge)
- Eval: lm-evaluation-harness, RewardBench-2, MT-Bench-v2, MMLU-Pro
- Avaliação de segurança: Llama Guard 4, ShieldGemma-2
- Infraestrutura: Kubernetes + NVIDIA dispositivo plugin, HPA em fila de espera métrica
- Observabilidade: W&B para formação, Langfuse para inferência

```figure
ce-finetune-stages
```

## Construí-lo

1. **Data pipeline.**Execute a dedupção do Datatrove no corpus bruto. Aplique classificador de qualidade em estilo Nemotron-CC. Presidio esfrega PII. Escreva divididas tração/val com semente explícita.

2. **Contamination check.**Para cada divisão de validação, calcular MinHash contra MMLU-Pro, MT-Bench-v2, RewardBench-2 test sets.

3. **Axolotl SFT.**YAML com ZeRO-3, FA3, sequência de embalagem. 2-3 épocas em 8xH100.

4. **TRL DPO / GRPO.**Tome o ponto de controlo SFT, execute uma época de DPO em pares de preferências (ou GRPO com uma recompensa verificável em matemática/código).

5. **Quantize.**Produzir três quantos: GPTQ-INT4-Marlin, AWQ-INT4, GGUF-Q4_K_M para llama.cpp. Dimensão e capacidade nominal de registro.

6. **Serve with speculative decoding.**Configuração vLLM 0.7 com cabeças de rascunho EAGLE-3 treinadas através de Red Hat Speculators. Messa a taxa de aceitação e a latência da cauda no lote 1 / 8 / 32.

7. **Eval matrix.**Execute i-val-harness, RewardBench-2, MT-Bench-v2, MMLU-Pro na base, SFT-só, SFT+DPO, SFT+GRPO. Produza uma tabela.

8. **Safety eval.**A taxa de passagem da Guarda Llama 4 no conjunto de desenvolvimento.

9. **Model card.**Modelo do MOF 2026: dados, formação, avaliação, segurança, licença, seção de reprodução com YAMLs e SHAs comprometidas.

## Usá-lo

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

## Envia-o

`outputs/skill-finetuning-pipeline.md`Um único comando executa dados através de SFT através de DPO através de quant através de serve através de eval, e emite um modelo de cartão + o ponto final servid.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Eval delta vs base | Measured gain on target tasks (MMLU-Pro, MT-Bench-v2, task-specific) |
| 20 | Pipeline reproducibility | One command reruns end to end with identical seeds |
| 20 | Data hygiene | Dedup rate, PII scrub coverage, contamination check green |
| 20 | Serving efficiency | tokens/s at bs=1/8/32, EAGLE-3 acceptance rate, $/1M tokens |
| 15 | Model card + safety eval | 2026 MOF completeness + Llama Guard 4 pass rate |
| **100** | | |

## Exercícios

1. Execute apenas SFT versus SFT+DPO versus SFT+GRPO no mesmo benchmark específico de tarefa.

2. Troca Llama 3.1 8B por Qwen3 14B. Messa os tokens de $ 1M em qualidade correspondente.

3. Meter a taxa de aceitação da EAGLE-3 em dados de domínio versus ShareGPT genérico.

4. Injectar 1% da contaminação (vazar respostas do MMLU-Pro para dados de treinamento) e reiniciar a avaliação. Assistir a precisão do MMLU-Pro saltar irreal. Construir um portal de verificação de contaminação CI que capta isso.

5. Adicione LoRA SFT como alternativa ao ajuste fino completo.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Axolotl | "SFT trainer" | Unified YAML-driven trainer for SFT, DPO, and distillation |
| TRL | "Preference tuner" | Hugging Face library for DPO, GRPO, PPO on LLMs |
| GRPO | "Group-relative policy optimization" | DeepSeek R1's RL recipe with verifiable rewards |
| EAGLE-3 | "Speculative decoding draft" | Draft heads that predict N tokens ahead; vLLM verifies with target model |
| MOF | "Model Openness Framework" | 2026 standard for grading model releases on data, code, license |
| Contamination check | "Split hygiene" | MinHash-based detection of test-set leakage into training |
| Acceptance rate | "EAGLE / MTP metric" | Fraction of drafted tokens the target model accepts |

## Mais leitura

- [Axolotl documentation](https://axolotl-ai-cloud.github.io/axolotl/) o treinador de referência SFT / DPO
- [TRL documentation](https://huggingface.co/docs/trl) Implementações de referência do DPO e do GRPO
- [Unsloth](https://github.com/unslothai/unsloth) Referência de iteração de GPU único
- [DeepSeek R1 paper (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) Metodologia do GRPO
- [vLLM + EAGLE-3 documentation](https://docs.vllm.ai) Estaca de serviço de referência
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) treinador alternativo de descodificação especulativa
- [Model Openness Framework (arXiv:2403.13784)](https://arxiv.org/abs/2403.13784): o padrão de classificação de libertação aberta
- [lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness) canônico avaliador runner
