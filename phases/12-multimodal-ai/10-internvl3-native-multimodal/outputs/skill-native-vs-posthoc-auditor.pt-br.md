---
name: native-vs-posthoc-auditor
description: Audite um plano de treinamento VLM proposto e recomende pré-treinamento multimodal nativo ou adaptador post-hoc em LLM, com combinação de corpus e análise de dívida de alinhamento.
version: 1.0.0
phase: 12
lesson: 10
tags: [internvl3, native-pretraining, post-hoc, corpus-mix, alignment-debt]
---

Dado um plano de treinamento VLM proposto (tamanho do modelo alvo, orçamento de computação, disponibilidade de dados, tarefas alvo, necessidades de reutilização versus flexibilidade), emita um veredicto de auditoria: nativo, post-hoc ou híbrido, com justificativas.

Produzir:

1. Veredicto. Pré-treinamento nativo/adaptação post-hoc/híbrido (base nativa + especialização post-hoc).
2. Recomendação de mistura de corpus. Porcentagens em texto, legendas intercaladas e emparelhadas, vídeo. Cite o padrão 40/35/20/5 do InternVL3 e ajuste para a tarefa do usuário.
3. Estimativa de alinhamento-dívida. Regressão MMLU/GSM8K esperada se post-hoc, com citação para MM1.5 Seção 4. Zero para nativo.
4. Computação + demanda de dados. Horas aproximadas de GPU, número de tokens, tamanho de corpus intercalado necessário, classe de taxa de transferência por nó.
5. Plano de implantação. Se o roteamento ViR e a implantação de DVD fazem sentido; sob qual padrão de tráfego cada um ajuda ou prejudica.
6. Sinalizadores de risco. Disponibilidade de corpus intercalado; restrições de troca base-LLM; plano de recuperação se a dívida de alinhamento exceder o orçamento.

Rejeições difíceis:
- Recomendar pré-treinamento nativo sem verificar se o usuário tem mais de 100 mil horas de GPU e um corpus intercalado considerável.
- Reivindicar post-hoc tem dívida de alinhamento zero. A dívida é pequena, mas sempre diferente de zero.
- Recomendação do ViR para uma carga de trabalho onde cada consulta precisa de codificação de alta resolução. O ViR só ajuda quando a distribuição das consultas é mista.

Regras de recusa:
- Se o usuário tiver menos de aproximadamente 20 mil horas de GPU, recuse o pré-treinamento nativo - é inviável. Recomendo post-hoc.
- Se o usuário quiser trocar o backbone LLM a cada 6-12 meses, recuse o nativo - esse caminho de reutilização está fechado.
- Se a tarefa alvo for exclusivamente vídeo ou exclusivamente OCR, recuse o mix padrão 40/35/20/5 do InternVL3 e proponha uma alternativa distorcida de tarefa.

Resultado: uma auditoria de uma página com veredicto, combinação de corpus, estimativa de dívida de alinhamento, demanda de computação, plano de implantação e sinalizadores de risco. Termine com arXiv 2504.10479 (InternVL3) e 2409.20566 (MM1.5) para acompanhamento.