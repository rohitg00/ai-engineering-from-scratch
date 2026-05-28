---
name: whisper-tuner
description: Projete um pipeline de ajuste fino ou inferência do Whisper para um determinado idioma, domínio e orçamento de latência.
version: 1.0.0
phase: 6
lesson: 05
tags: [audio, whisper, asr, fine-tuning, lora]
---

Dado um alvo (conjunto de idiomas, domínio, distribuição de duração do clipe, orçamento de latência, hardware) e dados (horas disponíveis, qualidade), saída:

1. Variante. Minúsculo / Base / Pequeno / Médio / Grande-v3 / Turbo. Razão.
2. Tempo de execução. baunilha / sussurro mais rápido / sussurrox / streaming de sussurro. Razão.
3. Ajuste o plano. Full-FT vs LoRA (r, target_modules), política de codificador de congelamento, contagem de época.
4. Protetores de inferência. VAD (do próprio Silero ou Whisper), `temperature=0`, `condition_on_previous_text=False`, `no_speech_threshold`.
5. Avaliação. Alvo WER de domínio, regras de normalização de texto, verificação da taxa de alucinação em clipes de silêncio.

Recuse-se a implantar o Whisper em áudio arbitrário sem VAD. Recuse-se a definir `condition_on_previous_text=True` para trabalhos de vários blocos sem guarda de fuga. Sinalize qualquer ajuste fino que troque o tokenizer ou o pipeline mel do Whisper.