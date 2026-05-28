---
name: finetuning-pipeline
description: Execute um pipeline de ajuste fino reproduzível de dados para SFT para DPO para servir com ablações, quantização e um cartão de modelo 2026 Model Openness Framework.
version: 1.0.0
phase: 19
lesson: 07
tags: [capstone, fine-tuning, axolotl, trl, dpo, grpo, vllm, eagle-3, mof]
---

Dado um modelo básico (Llama 3.3 8B, Qwen3 14B ou Gemma 3 12B) e um conjunto de dados específico da tarefa, crie um pipeline de comando único que produza um endpoint atendido e um cartão de modelo reproduzível.

Plano de construção:

1. Estágio de dados: desduplicação Datatrove, filtro de qualidade estilo Nemotron-CC, limpeza Presidio PII, divisões de trem/val semeadas.
2. Verificação de contaminação: MinHashLSH contra MMLU-Pro, MT-Bench-v2, RewardBench-2. Rejeitar na sobreposição.
3. SFT: Axolotl v0.8 com ZeRO-3, Flash Attention 3, sequências compactadas, 2-3 épocas em 8xH100.
4. Ajuste de preferência: TRL 0,15 DPO (ou GRPO com recompensas verificáveis) por 1 época, varredura beta.
5. Quantizar: GPTQ-INT4-Marlin + AWQ-INT4 + GGUF-Q4_K_M.
6. Servir: vLLM 0.7 com decodificação especulativa EAGLE-3 (rascunhos via Red Hat Speculators ou SGLang SpecForge). Implantação K8s com HPA em espera na fila.
7. Avaliação: lm-evaluation-harness, RewardBench-2, MT-Bench-v2, MMLU-Pro em base/somente SFT/SFT+DPO/SFT+GRPO.
8. Segurança: Taxa de aprovação do Llama Guard 4, filtro de saída ShieldGemma-2.
9. Cartão modelo sob a Estrutura de Abertura do Modelo 2026 com seções de dados, treinamento, avaliação, segurança e reprodutibilidade.

Rubrica de avaliação:

| Peso | Critério | Medição |
|:-:|---|---|
| 25 | Avaliação delta vs base | Ganho medido em MMLU-Pro, MT-Bench-v2, benchmarks específicos de tarefas |
| 20 | Reprodutibilidade do gasoduto | Reexecução de um comando com sementes idênticas produz hashes correspondentes |
| 20 | Higiene de dados | Taxa de desduplicação, cobertura de limpeza de PII, verificação de contaminação verde |
| 20 | Eficiência no atendimento | tokens/s no lote 08/01/32, aceitação EAGLE-3, tokens de $/1 milhão |
| 15 | Cartão modelo + avaliação de segurança | Completude do MOF 2026 + taxa de aprovação do Llama Guard 4 |

Rejeições difíceis:

- Pipelines que ignoram a verificação de contaminação do MinHash. O vazamento do MMLU-Pro no treinamento é o clássico modo de falha da trapaça de avaliação.
- O treinamento é executado sem sementes ou YAMLs anexados. A reprodutibilidade é um requisito difícil.
- Servindo sem EAGLE-3 ou configuração de decodificação especulativa equivalente. Os tokens/s da linha de base não são a barra de 2026.
- Avaliação de segurança ausente. Cada ajuste fino vem com uma taxa de aprovação do Llama Guard 4.

Regras de recusa:

- Recuse-se a publicar um cartão modelo que reivindique pontuações de benchmark sem anexar o SHA de commit lm-eval-harness.
- Recuse-se a ajustar dados cuja licença proíbe modelos derivados. MOF classifica o licenciamento de dados.
- Recuse-se a enviar um modelo quantizado sem medir a perda de qualidade na matriz de avaliação.

Saída: um repositório contendo o orquestrador de pipeline, os YAMLs para Llama 3.3 8B + uma base alternativa, os logs de execução SFT e DPO W&B, os artefatos quantizados, o endpoint servido, a matriz de avaliação de três benchmarks, a avaliação de segurança, o cartão modelo MOF 2026 e um artigo sobre os três maiores problemas de higiene de dados que você detectou e corrigiu.