---
name: realtime-voice-pipeline
description: Escolha transporte, VAD, streaming STT, LLM, streaming TTS e orquestração para uma latência alvo de ponta a ponta.
version: 1.0.0
phase: 6
lesson: 11
tags: [voice-agent, livekit, pipecat, silero, streaming, latency]
---

Dado o objetivo (latência P50/P95, idioma, canal, offline vs nuvem, volume de chamadas), resultado:

1. Transporte. WebRTC (LiveKit / Daily) · WebSocket · Entroncamento SIP (Twilio / Telnyx). Motivo vinculado à tolerância ao jitter + caso de uso.
2. VAD + turno. Silero VAD (aberto, 99,5% TPR) · Cobra (comercial) · Detector de giro LiveKit. Limiar, duração mínima da fala, ressaca de silêncio.
3. Transmissão STT. Periquito TDT (abertura mais rápida) · Kyutai STT (com truque de descarga) · Deepgram Nova-3 (API, ~150 ms) · Whisper-streaming. Razão.
4. LLM + streaming. Fixe os primeiros 20 tokens antes que o TTS entre em ação. Modelo + configuração de streaming + grades de proteção para injeção imediata.
5. Transmissão de TTS. Kokoro-82M (~100 ms TTFA) · Orfeu · Cartesia Sonic · ElevenLabs Turbo. Pacote de voz ou proteção de clonagem (Lição 8).
6. Orquestração. Agentes LiveKit · Pipecat · Vapi · Recontar · Rust personalizado. Razão ligada às habilidades da equipe + escala.
7. Observabilidade. Histogramas P50/P95/P99 por estágio; taxa de interrupção falso-positiva; taxa de queda de chamadas; Amostras de plantão WER.

Recuse implanta esse buffer de declarações inteiras antes do STT. Recuse TTS que não transmite. Recusar avaliação por latência média — exigir P95. Recusar plataformas gerenciadas (Vapi / Retell) para &gt; 100 mil minutos/mês sem comparação de custos para construir o seu próprio.

Entrada de exemplo: "Agente de voz para cotação de seguro de carro. &lt; 500 ms P95. Inglês, EUA. 50 mil minutos/semana. Conformidade: adjacente à HIPAA (sem PII nos registros)."

Exemplo de saída:
- Transporte: Agentes LiveKit + Twilio SIP. Comprovado em escala de call center, ativação do modo HIPAA.
- VAD: Silero VAD @ limite 0,45, fala mínima 220 ms, ressaca de silêncio 400 ms. Sobreposição do detector de giro LiveKit.
- STT: Deepgram Nova-3 Inglês (~150 ms P95); volte para o Parakeet-TDT se for necessária uma auditoria local.
- LLM: streaming GPT-4o via API OpenAI em tempo real; proteja-se contra injeção imediata com um pós-filtro; fixe os primeiros 20 tokens no TTS.
- TTS: Cartesia Sonic 2 (~150 ms TTFA, clonagem de voz não utilizada — voz predefinida).
- Orquestração: Agentes LiveKit. Observabilidade via Hamming AI para produção.
- Logs: remove CVV/SSN/DOB com uma passagem regex + NER antes da persistência. Reter 30 dias.