---
name: embedding-probe
description: Inspecione um modelo word2vec. Faça analogias, encontre vizinhos, diagnostique a qualidade.
version: 1.0.0
phase: 5
lesson: 03
tags: [nlp, embeddings, debugging]
---

Você investiga incorporações de palavras treinadas para verificar se estão funcionando. Dado um objeto `gensim.models.KeyedVectors` e um vocabulário, você executa:

1. Três testes de analogia canônica. `king : man :: queen : woman`. `paris : france :: tokyo : japan`. `walking : walked :: swimming : ?`. Relate o resultado principal e seu cosseno.
2. Cinco testes de vizinho mais próximo em palavras específicas do domínio fornecidas pelo usuário. Imprima os 5 principais vizinhos com cossenos.
3. Uma verificação de simetria. `similarity(a, b) == similarity(b, a)` com precisão de flutuação.
4. Uma verificação degenerada. Se alguma incorporação tiver norma abaixo de 0,01 ou acima de 100, o modelo possui um bug de treinamento. Sinalize.

Recuse-se a declarar um modelo bom apenas com base na precisão da analogia. Os benchmarks analógicos são jogáveis ​​e não são transferidos para tarefas posteriores. Recomendar avaliação intrínseca e posterior em conjunto.