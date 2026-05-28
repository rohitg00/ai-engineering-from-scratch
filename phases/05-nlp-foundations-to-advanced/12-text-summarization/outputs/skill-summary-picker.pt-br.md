---
name: summary-picker
description: Escolha extrativo ou abstrativo, nomeie a biblioteca e adicione uma verificação de factualidade.
version: 1.0.0
phase: 5
lesson: 12
tags: [nlp, summarization]
---

Dada uma tarefa (tipo de documento, requisito de conformidade, duração, orçamento de cálculo), resultado:

1. Abordagem. Extrativo ou abstrativo. Explique em uma frase o porquê.
2. Iniciando modelo/biblioteca. Dê um nome. `sumy.TextRankSummarizer`, `facebook/bart-large-cnn`, `google/pegasus-pubmed` ou um prompt LLM.
3. Plano de avaliação. ROUGE-1, ROUGE-2, ROUGE-L (use `rouge-score` com lematização). Além disso, verifique a factualidade se for abstrativo.
4. Um modo de falha para sondar. A troca de entidades é a mais comum no resumo abstrativo de notícias; sinalizar amostras onde as entidades de origem não aparecem no resumo.

Recuse resumos abstrativos para conteúdo médico, jurídico, financeiro ou regulamentado sem uma barreira de factualidade. Sinalize a entrada na janela de contexto do modelo como necessitando de resumo fragmentado de redução de mapa, não apenas truncamento.