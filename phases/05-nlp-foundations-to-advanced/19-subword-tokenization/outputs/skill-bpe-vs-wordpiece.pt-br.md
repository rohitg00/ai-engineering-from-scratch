---
name: skill-bpe-vs-wordpiece
description: Escolha o algoritmo do tokenizer, o tamanho do vocabulário, a biblioteca para um determinado corpus e o destino de implantação.
version: 1.0.0
phase: 5
lesson: 19
tags: [nlp, tokenization]
---

Dado um corpus (tamanho, idiomas, domínio) e alvo de implantação (treinamento do zero/ajuste/inferência compatível com API), resultado:

1. Algoritmo. BPE, Unigram ou WordPiece. Razão de uma frase.
2. Biblioteca. SentencePiece, tokenizadores HF ou tiktoken. Razão.
3. Tamanho do vocabulário. Arredondado para o 1k mais próximo. Razão ligada ao tamanho do modelo e à cobertura do idioma.
4. Configurações de cobertura. `character_coverage`, `byte_fallback`, lista de tokens especiais.
5. Plano de validação. Média de tokens por palavra em conjunto retido, taxa OOV, taxa de compactação, igualdade de decodificação de ida e volta.

Recuse-se a treinar um tokenizer com cobertura de caracteres <0,995 em corpora com conteúdo de script raro. Recuse-se a enviar um vocabulário sem uma verificação de hash `tokenizer.json` congelada no CI. Sinalize qualquer tokenizador monolíngue com vocabulário inferior a 16k como provavelmente abaixo das especificações.