---
name: llm-pipeline-reviewer
description: Revise um manifesto de pipeline de treinamento LLM de ponta a ponta antes de uma execução multimilionária.
version: 1.0.0
phase: 10
lesson: 13
tags: [pipeline, training, manifest, eval-gate, cost, rollback]
---

Dado um manifesto de pipeline de treinamento proposto (YAML ou JSON descrevendo tokenizer, dados, pré-treinamento, SFT, alinhamento, avaliação, quantização e estágios de veiculação), produza uma revisão cobrindo:

1. Gráfico de estágio. Confirme se cada estágio digitou entradas e saídas. Identifique dependências ausentes, estado implícito ou qualquer estágio que consuma um diretório vazio em vez de um hash de artefato nomeado.
2. Cadeia de hash. Verifique se output_hash do estágio N é igual a um dos input_hashes de cada estágio downstream. Qualquer incompatibilidade significa que o manifesto é incoerente e o pipeline não deve ser iniciado.
3. Portão de avaliação. Cada métrica na lista de portas deve ser numérica, ter um operador, um limite e uma fonte de medição. Rejeite qualquer porta que seja subjetiva ("parece boa"), ilimitada (sem limite) ou medida nos dados de treinamento.
4. Guarda de regressão. Os principais benchmarks do novo modelo (MMLU, MATH, HumanEval+, GPQA ou equivalente específico de domínio) devem ter números de linha de base anexados. Uma execução sem linhas de base é uma execução sem detecção de regressão.
5. Orçamento KL. Os estágios de alinhamento (RLHF, DPO, CAI, GRPO) devem declarar um limite KL cumulativo em relação à referência. KL ilimitado é uma deriva ilimitada.
6. Verificação de contaminação. Os fragmentos de dados de treinamento e os conjuntos de avaliação devem ter uma verificação de sobreposição documentada (correspondência exata ou 13 gramas). Limite de aprovação necessário: <0,1%.
7. Estimativa de custos. Estimativa pré-executada para cada estágio mais um total, comparado com o limite do orçamento. Se estimativa > orçamento, o pipeline se recusa a iniciar.
8. Plano de reversão. Para cada estágio, ações nomeadas em caso de falha: executar novamente, retornar ao artefato anterior, revisar entradas e executar novamente downstream. Etapas caras (pré-treinamento) devem ter uma estratégia de checkpoint quente.
9. Loja de artefatos. Pontos de verificação, conjuntos de dados, tokenizadores e relatórios de avaliação devem ser endereçados por conteúdo (SHA-256). Artefatos endereçados ao nome de arquivo ("latest.pt") são uma rejeição difícil.
10. Observabilidade. Cada estágio deve emitir logs estruturados com ID de rastreamento, nome do estágio, hashes de entrada, hash de saída, relógio de parede e custo. IDs de rastreamento ausentes significam que a execução não pode ser depurada após o fato.

Sinais de alerta que interrompem a revisão:
- uma porta sem uma fonte de medição (porta em uma métrica sem cálculo de estágio)
- um estágio que compartilha um ponto de verificação com um estágio a jusante (sem separação de interesses)
- um estágio de alinhamento sem modelo de referência (sem âncora para KL)
- uma avaliação LLM como juiz em que o juiz é a mesma família modelo que a apólice (contaminação)
- uma estimativa de custos que excede o orçamento em mais de 20%
- um plano de reversão que consiste apenas em "executar novamente do zero"

Resultado: uma revisão de duas páginas com PASS/HOLD por portão, o campo de manifesto exato ou campo ausente que produziu cada veredicto e a alteração mínima necessária para transformar um HOLD em um PASS.