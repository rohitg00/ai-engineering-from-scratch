---
name: vad-tuner
description: Escolha o modelo VAD, limite, ressaca de silêncio, pre-roll e estratégia de detecção de giro para um agente de voz.
version: 1.0.0
phase: 6
lesson: 14
tags: [vad, silero, cobra, turn-detection, flush-trick]
---

Dada a carga de trabalho (consumidor/call center/borda/acessibilidade; perfil de ruído; mix de idiomas; latência), resultado:

1. VAD. Silero VAD (padrão) · Cobra (precisão comercial) · segmentação pyannote (grau de diarização) · WebRTC VAD (legado/minúsculo). Razão de uma frase.
2. Parâmetros. Limiar (0,3-0,5), fala mínima (200-300 ms), ressaca de silêncio (400-800 ms), pré-rolagem (250-500 ms).
3. Detecção semântica de mudança de direção. Ativado (detector de giro LiveKit ou MLP personalizado) ou não. Motivo vinculado aos padrões de fala esperados do usuário.
4. Truque de descarga. Ativado (se STT suportar — Kyutai/Deepgram) ou não. Economias de latência esperadas.
5. Guardas. Rejeitar fala com duração inferior a um minuto; sempre mantenha o anúncio precedente; substituição de ressaca de silêncio por usuário; falha na abertura se o serviço VAD estiver inativo (trate tudo como fala).

Recuse VAD apenas de energia para produção – muito barulhento. Recuse a ressaca de silêncio zero - interromperá os usuários. Recuse VAD baseado em Whisper quando Silero dedicado estiver disponível (mais lento, menos preciso).

Entrada de exemplo: "IVR da central de atendimento para remarcação de companhia aérea. Fundo barulhento (aeroporto). Inglês + espanhol. Detecção de mudança de direção < 500 ms."

Exemplo de saída:
- VAD: Cobra (comercial) pela vantagem de resistência ao ruído. Recorra a Silero se o custo for proibitivo.
- Parâmetros: limite 0,4 (piso de ruído do aeroporto é alto); min fala 300 ms; silêncio de ressaca 600 ms (os usuários costumam fazer uma pausa durante o IVR para ler os números dos voos); pré-rolagem 400 ms.
- Turno semântico: detector de giro LiveKit habilitado - pausas no meio da frase são comuns ("Preciso mudar meu voo... para amanhã").
- Truque de descarga: ativado no streaming do Deepgram. Economia esperada: 400 ms → 150 ms de latência no final do turno.
- Guardas: falha na abertura se Cobra/Deepgram estiver inacessível; log de auditoria de cada evento de disparo de VAD para ajuste.