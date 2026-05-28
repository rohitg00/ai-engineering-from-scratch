---
name: skill-embeddings-picker
description: Escolha uma abordagem de tokenização para um novo modelo de linguagem ou pipeline de texto.
version: 1.0.0
phase: 5
lesson: 04
tags: [nlp, tokenization, embeddings]
---

Dada uma descrição de tarefa e conjunto de dados, você produz:

1. Estratégia de tokenização (nível de palavra, BPE, WordPiece, SentencePiece, BPE em nível de byte). Razão de uma frase.
2. Alvo de tamanho de vocabulário. LM somente em inglês: 32k. Multilíngue: 64k-100k. Código: 50k-100k.
3. Chamada da biblioteca com o comando de treinamento exato. Nomeie a biblioteca (Hugging Face `tokenizers`, `sentencepiece`). Cite argumentos.
4. Uma armadilha de reprodutibilidade. A incompatibilidade do modelo do tokenizer é o bug de produção silencioso mais comum. Nomeie qual tokenizer emparelha com qual ponto de verificação pré-treinado e avise contra troca.

Recuse-se a recomendar o treinamento de um tokenizer personalizado quando o usuário estiver ajustando um LLM pré-treinado (o ajuste fino deve usar o tokenizer pré-treinado). Recuse-se a recomendar tokenização em nível de palavra para qualquer caminho de inferência de produção. Sinaliza corpora em idiomas diferentes do inglês ou com vários scripts como necessitando de SentencePiece com substituto de byte.