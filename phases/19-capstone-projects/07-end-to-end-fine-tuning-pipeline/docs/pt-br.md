# Capstone 07 — Pipeline de Fine-Tuning Ponta a Ponta (Dados para SFT para DPO para Servir)

> Um modelo de 8B treinado nos seus próprios dados, alinhado com DPO nas suas próprias preferências, quantizado, com especificaçãoulative decoding e servido com $/1M tokens mensuráveis. O stack aberto de 2026 é Axolotl v0.8, TRL 0.15, Unsloth para iteração, GPTQ/AWQ/GGUF para quantização, vLLM 0.7 com EAGLE-3 para serving. O capstone é rodar a pipeline inteira de forma reproduzível — YAML de entrada, endpoint servido na saída — e publicar um model card sob o Model Openness Framework de 2026.

**Tipo:** Capstone
**Linguagens:** Python (pipeline), YAML (configs), Bash (scripts)
**Pré-requisitos:** Fase 2 (ML), Fase 3 (DL), Fase 7 (transformers), Fase 10 (LLMs do zero), Fase 11 (engenharia de LLM), Fase 17 (infraestrutura), Fase 18 (segurança)
**Fases exercitadas:** P2 · P3 · P7 · P10 · P11 · P17 · P18
**Tempo:** 35 horas

## Problema

Toda equipe de IA séria em 2026 mantém uma pipeline de fine-tuning à mão. Não porque eles lançam um modelo base de fronteira, mas porque adaptação downstream — SFT de domínio, DPO contra preferências rotuladas, drafts destilados para especificaçãoulative decoding, serving com EAGLE-3 — é onde ficam os ganhos mensuráveis. Axolotl v0.8 lida com configs de SFT multi-GPU. TRL 0.15 lida com DPO e GRPO. Unsloth te dá iteração rápida em GPU única. vLLM 0.7 com EAGLE-3 empurra throughput de decode 2-3x sem perda de qualidade. As ferramentas funcionam; o ofício está nos YAMLs, na higiene dos dados e na disciplina de avaliação.

Você vai rodar um base de 8B (Llama 3.3, Qwen3 ou Gemma 3) por SFT depois DPO em dados eespecificaçãoíficos de tarefa, quantizar para serving e medir ganhos contra lm-evaluation-harness, RewardBench-2, MT-Bench-v2 e MMLU-Pro. Você vai produzir um model card sob o Model Openness Framework de 2026. O ponto é reprodutibilidade — um comando reexecuta a pipeline inteira de ponta a ponta.

## Conceito

A pipeline tem cinco estágios. **Dados**: dedup (MinHash / Datatrove), filtro de qualidade (classificador estilo Nemotron-CC), limpeza de PII, verificação de higiene de split contra contaminação de benchmarks públicos. **SFT**: YAML do Axolotl, ZeRO-3 em 8xH100, agenda coseno, sequências empacotadas, 2-3 épocas. **DPO ou GRPO**: config do TRL, 1 época, pares de preferência rotulados por humanos ou julgados por modelo, calibração de beta. **Quantizar**: GPTQ + AWQ + GGUF para flexibilidade de deploy. **Servir**: vLLM 0.7 com cabeçalhos eespecificaçãoulativos EAGLE-3 (ou SGLang com SpecForge), implantação K8s, HPA em queue-wait.

Ablações são a entrega: SFT-only vs SFT+DPO vs SFT+GRPO em três benchmarks eespecificaçãoíficos de tarefa. Métricas de serving: tokens/s em batch 1 / 8 / 32, taxa de aceitação do EAGLE-3, $/1M tokens. Avaliação de segurança: taxa de pass do Llama Guard 4. Model card: avaliações de viés, sementes de reprodutibilidade, licenciamento de dados.

## Arquitetura

```
dados brutos (datasets HF + internos)
    |
    v
dedup Datatrove + filtro de qualidade Nemotron-CC + limpeza PII
    |
    v
higiene de split (verificação de contaminação MMLU-Pro)
    |
    v
config de SFT Axolotl (YAML)  ---> 8xH100, ZeRO-3
    |
    v
config DPO / GRPO TRL         ---> 4xH100, 1 época
    |
    v
quantização GPTQ + AWQ + GGUF
    |
    v
vLLM 0.7 + EAGLE-3 especificaçãoulative decoding
    |
    v
deploy K8s, HPA em queue-wait
    |
    v
lm-eval-harness + RewardBench-2 + MT-Bench-v2 + MMLU-Pro
    |
    v
model card (MOF 2026) + avaliação de segurança (Llama Guard 4)
```

## Stack

- Dados: Datatrove para dedup, classificador Nemotron-CC para qualidade, Presidio para PII
- Base: Llama 3.3 8B, Qwen3 14B ou Gemma 3 12B
- SFT: Axolotl v0.8 com ZeRO-3, Flash Attention 3, sequências empacotadas
- Ajuste de preferências: TRL 0.15 para DPO ou GRPO; Unsloth para iteração GPU única
- Quantização: GPTQ (Marlin), AWQ, GGUF via llama.cpp
- Serving: vLLM 0.7 com EAGLE-3 especificaçãoulative decoding (ou SGLang 0.4 + SpecForge)
- Avaliação: lm-evaluation-harness, RewardBench-2, MT-Bench-v2, MMLU-Pro
- Avaliação de segurança: Llama Guard 4, ShieldGemma-2
- Infraestrutura: Kubernetes + plugin de dispositivo NVIDIA, HPA na métrica queue-wait
- Observabilidade: W&B para treinamento, Langfuse para inferência

## Construa

1. **Pipeline de dados.** Rode dedup Datatrove no corpus bruto. Aplique classificador de qualidade estilo Nemotron-CC. Presidio limpa PII. Escreva splits train/val com semente explícita.

2. **Verificação de contaminação.** Para cada split de validação, compute MinHash contra os conjuntos de teste do MMLU-Pro, MT-Bench-v2, RewardBench-2. Rejeite qualquer sobreposição.

3. **SFT Axolotl.** YAML com ZeRO-3, FA3, empacotamento de sequências. 2-3 épocas em 8xH100. Log para W&B.

4. **DPO / GRPO TRL.** Pegue o checkpoint do SFT, rode 1 época de DPO em pares de preferência (ou GRPO com recompensa verificável em math/código). Varie o beta.

5. **Quantize.** Produza três quantizações: GPTQ-INT4-Marlin, AWQ-INT4, GGUF-Q4_K_M para llama.cpp. Registre tamanho e throughput nominal.

6. **Sirva com especificaçãoulative decoding.** Config do vLLM 0.7 com cabeçalhos EAGLE-3 treinados via Red Hat Speculators. Meça taxa de aceitação e latência de cauda em batch 1 / 8 / 32. Relate $/1M tokens vs Anthropic / OpenAI na mesma avaliação.

7. **Matriz de avaliação.** Rode lm-eval-harness, RewardBench-2, MT-Bench-v2, MMLU-Pro no base, SFT-only, SFT+DPO, SFT+GRPO. Produza uma tabela.

8. **Avaliação de segurança.** Taxa de pass do Llama Guard 4 no conjunto de desenvolvimento. Filtro de saída ShieldGemma-2.

9. **Model card.** Template MOF 2026: dados, treinamento, avaliação, segurança, licença, seção de reprodutibilidade com YAMLs e SHAs de commit.

## Use

```
$ ./pipeline.sh config/llama3.3-8b-domainX.yaml
[dados]   300k deduplicados, 12k filtrados, 280k aceitos (semente=7)
[SFT]     3 épocas, 8xH100, 6h12m, val loss 1.42 -> 1.03
[DPO]     1 época, beta=0.08, 4xH100, 1h40m
[quant]   GPTQ-INT4 4.6 GB, AWQ-INT4 4.8 GB, GGUF-Q4_K_M 5.1 GB
[servir]  vLLM 0.7, EAGLE-3 aceitação 0.74, p99 126ms @ bs=8
[aval]    MMLU-Pro +3.2, MT-Bench-v2 +0.41, RewardBench-2 +0.08
[card]    model-card.md gerado sob MOF 2026
```

## Entregue

`outputs/skill-finetuning-pipeline.md` descreve a entrega. Um único comando roda dados por SFT por DPO por quantização por serving por avaliação e emite um model card + o endpoint servido.

| Peso | Critério | Como é medido |
|:-:|---|---|
| 25 | Delta de avaliação vs base | Ganho medido em tarefas alvo (MMLU-Pro, MT-Bench-v2, eespecificaçãoíficas de tarefa) |
| 20 | Reprodutibilidade da pipeline | Um comando reexecuta ponta a ponta com sementes idênticas |
| 20 | Higiene dos dados | Taxa de dedup, cobertura de limpeza PII, verificação de contaminação verde |
| 20 | Eficiência de serving | tokens/s em bs=1/8/32, taxa de aceitação EAGLE-3, $/1M tokens |
| 15 | Model card + avaliação de segurança | Completude MOF 2026 + taxa de pass Llama Guard 4 |
| **100** | | |

## Exercícios

1. Rode SFT-only vs SFT+DPO vs SFT+GRPO no mesmo benchmark eespecificaçãoífico de tarefa. Relate qual método de preferência vence e por quanto.

2. Troque Llama 3.3 8B por Qwen3 14B. Meça os $/1M tokens com qualidade equivalente.

3. Meça a taxa de aceitação do EAGLE-3 em dados de domínio vs ShareGPT genérico. Relate o delta e o que ele significa para orçamentos de latência.

4. Injete 1% de contaminação (vaze respostas do MMLU-Pro nos dados de treinamento) e reexecute a avaliação. Observe a acurácia do MMLU-Pro saltar irreais. Construa um gate de CI de verificação de contaminação que pegue isso.

5. Adicione LoRA SFT como alternativa ao fine-tune completo. Meça o gap de qualidade com 10x menos memória.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|------|------------------------|------------------------|
| Axolotl | "Treinador de SFT" | Treinador unificado via YAML para SFT, DPO e destilação |
| TRL | "Ajustador de preferências" | Biblioteca do Hugging Face para DPO, GRPO, PPO em LLMs |
| GRPO | "Group-relative policy optimization" | Receita de RL do DeepSeek R1 com recompensas verificáveis |
| EAGLE-3 | "Draft de especificaçãoulative decoding" | Cabeçalhos draft que predizem N tokens à frente; vLLM verifica com o modelo alvo |
| MOF | "Model Openness Framework" | Padrão de 2026 para classificar lançamentos de modelos em dados, código, licença |
| Verificação de contaminação | "Higiene de split" | Detecção baseada em MinHash de vazamento do conjunto de teste para o treinamento |
| Taxa de aceitação | "Métrica EAGLE / MTP" | Fração de tokens draft que o modelo alvo aceita |

## Leitura Complementar

- [Documentação Axolotl](https://axolotl-ai-cloud.github.io/axolotl/) — treinador de referência SFT / DPO
- [Documentação TRL](https://huggingface.co/docs/trl) — implementações de referência DPO e GRPO
- [Unsloth](https://github.com/unslothai/unsloth) — referência de iteração GPU única
- [Paper DeepSeek R1 (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) — metodologia GRPO
- [Documentação vLLM + EAGLE-3](https://docs.vllm.ai) — stack de serving de referência
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) — treinador de especificaçãoulative decoding alternativo
- [Model Openness Framework 2026](https://isocpp.org/) — padrão de classificação de lançamento aberto
- [lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness) — runner de avaliação canônico
