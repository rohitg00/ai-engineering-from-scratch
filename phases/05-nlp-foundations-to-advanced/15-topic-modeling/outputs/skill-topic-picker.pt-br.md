---
name: topic-picker
description: Escolha LDA ou BERTopic para um corpus. Especifique biblioteca, botões, avaliação.
version: 1.0.0
phase: 5
lesson: 15
tags: [nlp, topic-modeling]
---

Dada uma descrição do corpus (contagem de documentos, comprimento médio, domínio, idioma, orçamento de computação), resultado:

1. Algoritmo. LDA/NMF/BERTopic/Top2Vec/FASTopic. Razão de uma frase.
2. Configuração. Número de tópicos (começa em ~sqrt(n_docs)), filtros `min_df`/`max_df`, modelo de incorporação para abordagens neurais.
3. Avaliação. Coerência do tópico (c_v) via `gensim.models.CoherenceModel`, diversidade do tópico, além de uma leitura humana de 20 amostras.
4. Modo de falha para sondar. Para LDA, "tópicos indesejados" absorvem palavras irrelevantes e termos frequentes. Para BERTopic, -1 cluster outlier engolindo documentos ambíguos.

Recuse BERTopic em documentos maiores que a janela de contexto do modelo de incorporação sem uma estratégia de agrupamento. Recuse LDA em textos muito curtos (tweets, resenhas com menos de 10 tokens), pois a coerência entra em colapso. Sinalize qualquer escolha de n_topics abaixo de 5 ou acima de 200 como provavelmente errada para dados reais.