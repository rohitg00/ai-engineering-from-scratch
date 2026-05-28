---
name: codec-picker
description: Escolha um codec de áudio neural (EnCodec/DAC/SNAC/Mimi) para uma determinada tarefa de geração ou compressão.
version: 1.0.0
phase: 6
lesson: 13
tags: [codec, encodec, dac, snac, mimi, rvq, semantic-tokens]
---

Dada a tarefa (LM generativo, compressão, diálogo full-duplex, edição de música, alvo de fidelidade), saída:

1. Codec. EnCodec-24k · EnCodec-48k · DAC-44.1k · SNAC-24k · Mimi · (fallback: Opus para compressão não neural). Razão de uma frase.
2. Taxa de quadros + livros de códigos. Orçamento da taxa de bits, contagem do livro de códigos (geralmente 4-12), duração da sequência para a duração do clipe alvo.
3. Esquema de tokenização. Plano vs hierárquico (SNAC) vs semântico + acústico (Mimi). Como o LM consome tokens.
4. Decodificador. Decodificador no codec · vocoder externo (HiFi-GAN) · Somente LM (sem vocoder, prevê tokens de codec diretamente). Explique por quê.
5. Implicações formativas. Precisa treinar codificador/decodificador? Ajustar o áudio do domínio (somente fala → música específica do domínio)? Congelado pronto para uso?

Recuse DAC para cargas de trabalho AR-LM com orçamentos de latência apertados – taxa de quadros de 86 Hz × 8 livros de códigos = 5.504 tokens por 10 s, muito tempo para geração rápida. Recuse Mimi para música - ela é afinada para a fala. Recuse o EnCodec para geração semântico-condicional - sem livro de códigos semântico, fala borrada do texto.

Entrada de exemplo: "Construa um AR LM para TTS de conversão de texto em fala. Meta TTFA 200 ms. Somente inglês."

Exemplo de saída:
- Codec: Mimi. A divisão semântica + acústica permite a fatoração de texto → livro de códigos 0 → livros de códigos 1-7, que é rápida e suporta clonagem de voz.
- Taxa de quadros + livros de códigos: 12,5 Hz · 8 livros de códigos · 4,4 kbps. 10s = 1.000 fichas.
- Tokenização: preveja o livro de códigos 0 primeiro a partir do texto + referência do locutor; em seguida, preveja os livros de código 1-7, dado o livro de código 0 + referência do alto-falante (padrão do transformador de profundidade).
- Decodificador: decodificador integrado do Mimi, sem necessidade de codificador de voz externo.
- Treinamento: treinar o LM de texto para codec; congele Mimi.