---
name: voice-pipeline
description: Scaffold a Pipecat-shaped voice pipeline (VAD + STT + LLM + TTS + transport) with barge-in, confidence gating, and latency budget enforcement.
version: 1.0.0
phase: 14
lesson: 22
tags: [voice, pipecat, livekit, webrtc, latency]
---
---
name: voice-pipeline
description: Scaffold a Pipecat-shaped voice pipeline (VAD + STT + LLM + TTS + transport) with barge-in, confidence gating, and latency budget enforcement.
version: 1.0.0
phase: 14
lesson: 22
tags: [voice, pipecat, livekit, webrtc, latency]
---

Dada uma especificação de produto de voz (idioma, transporte, provedores), crie um pipeline baseado em quadro.

Produzir:

1. Tipo `Frame` com `kind`, `payload`, `direction` (downstream/upstream).
2. Processadores: `VAD`, `STT`, `LLM`, `TTS`, `Transport`. Cada um com `process(frame)`.
3. `link()` auxiliar encadeando processadores para frente e para trás.
4. Cancelar manipulação de quadros: caminho UPSTREAM do transporte para TTS, para LLM e para STT, eliminando o trabalho pendente em cada estágio.
5. Observadores: métricas de latência por estágio; emitir um intervalo OTel por quadro que atravessa um processador (Lição 23).
6. Portal de confiança no STT: abaixo do limite, emita um quadro de texto "repita" em vez de uma transcrição.

Rejeições difíceis:

- Pipeline sem manuseio UPSTREAM. A interrupção não é opcional para voz.
- Chamadas LLM sem streaming. A latência do primeiro token domina; deve ser transmitido.
- STT cego para a confiança. Alimentar transcrições erradas no LLM produz respostas erradas.

Regras de recusa:

- Se a latência ponta a ponta exceder 1.500 ms em operação a frio, recuse o envio. Otimize a cadeia ou use um MultimodalAgent (áudio direto do LiveKit).
- Se o produto prioriza a telefonia e o pipeline não possui adaptador SIP, recuse. Roteie através do LiveKit SIP ou de uma plataforma (Vapi/Retell).
- Se o produto transportar áudio PII sem criptografia em trânsito, recuse.

Saída: `frames.py`, `processors.py`, `pipeline.py`, `observers.py`, `README.md` explicando o orçamento de latência, design de interrupção e escolha de transporte. Termine com "o que ler a seguir" apontando para a Lição 23 (OTel), Lição 24 (back-ends de observabilidade) ou documentos do LiveKit para detalhes do WebRTC.