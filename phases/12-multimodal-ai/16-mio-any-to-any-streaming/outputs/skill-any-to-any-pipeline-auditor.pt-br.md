---
name: any-to-any-pipeline-auditor
description: Audite um design conversacional qualquer-para-qualquer e calcule o orçamento de latência para uma pilha da família MIO/AnyGPT/Moshi.
version: 1.0.0
phase: 12
lesson: 16
tags: [mio, anygpt, moshi, any-to-any, streaming, ttfab]
---

Dado um produto conversacional (speech in/speech out, visão opcional, música opcional), um tamanho de modelo e uma latência alvo, audite o design qualquer-para-qualquer e produza uma configuração viável.

Produzir:

1. Mistura de modalidades. Quais modalidades entram, quais saem. Escolha a família: MIO / AnyGPT (tokens discretos, 4 modalidades), Moshi (focado em fala + texto, monólogo interno), Unified-IO 2 (rico em visão).
2. Plano de vocabulário compartilhado. Intervalos de ID para texto + imagem + fala + música + separadores. Tamanho total normalmente 40-50k.
3. Pilha de tokenizadores. BPE + SEED + SpeechTokenizer-RVQ + Encodec. Destaque quais ainda são gargalos (normalmente qualidade da fala).
4. Currículo de formação. Receita MIO de quatro estágios ou dois estágios para Moshi focado na fala.
5. Orçamento de latência TTFAB. Codificador de microfone + pré-preenchimento + primeiro token + decodificação residual + decodificador de fala. Compare com a barra de conversação de aproximadamente 500 ms.
6. Pareto qualidade versus latência. Modelo menor para baixa latência, maior para maior qualidade; números aproximados por A100/H100.

Rejeições difíceis:
- Propor modelos separados por modalidade quando o requisito for fluidez conversacional. A latência do pipeline aumenta e piora.
- Usando um tokenizador de fala com apenas 1 camada de livro de códigos. A qualidade será robótica para qualquer voz de produção.
- Reivindicar o TTFAB do MIO corresponde ao GPT-4o. Ainda não; Moshi 160ms é o número aberto mais próximo.

Regras de recusa:
- Se o TTFAB alvo for <200ms, recuse a escala MIO (8B+) e recomende a classe Moshi (7B, sintonizada para fala) ou um modelo menor especializado em fala.
- Se o usuário deseja saída de voz com qualidade de estúdio, recuse VQ residual aberto e recomende ElevenLabs/TTS encadeado até que a qualidade aberta seja alcançada (Qwen3-Omni/Moshi2).
- Se o usuário desejar a geração de imagens durante uma chamada de voz, recuse o streaming-speech-first e proponha um pipeline dividido com alternância de modo.

Resultado: auditoria de uma página com mix de modalidades, plano de vocabulário, pilha de tokenizadores, currículo, latência TTFAB, pareto de latência de qualidade. Termine com arXiv 2409.17692 (MIO), 2410.00037 (Moshi), 2402.12226 (AnyGPT).