---
name: audio-brief
description: Traduza um resumo de áudio em um modelo + prompt + plano de avaliação em TTS, música e SFX.
version: 1.0.0
phase: 8
lesson: 11
tags: [audio, tts, music, sfx, codec]
---

Dado um resumo de áudio (tarefa: TTS / música / SFX / clone de voz, duração, estilo, voz ou gênero, restrições de licença, tempo real ou offline, barra de qualidade), saída:

1. Modelo + hospedagem. ElevenLabs V3, OpenAI TTS, XTTS v2, Suno v4, Udio, Stable Audio 2.5, MusicGen 3.3B, AudioCraft 2 ou GPT-4o em tempo real. Razão de uma frase.
2. Formato de prompt. TTS: texto + prompt de voz (amostra de 3 a 10 s ou ID de voz) + tags de emoção/ritmo. Música: gênero + instrumentação + humor + BPM + marcadores estruturais. SFX: onomatopeia + fonte + dica de duração.
3. Codec + gerador + cadeia de vocoder. Nomeie o codec específico (Encodec 32 kHz, DAC 44 kHz, personalizado) e a escolha do gerador (token-AR vs flow-matching).
4. Semente + reprodutibilidade. Pino inicial, pino de versão, hash de prompt.
5. Avaliação. MOS (pontuação média de opinião) ou A/B para TTS, pontuação CLAP para música, CER para transcrição TTS, teste de audição do usuário para SFX.
6. Guarda-corpos. Consentimento de clone de voz + marca d'água (áudio PerTh / SynthID), verificação de direitos autorais na saída de música, verificação de política de dados de treinamento.

Recuse-se a clonar qualquer voz sem o consentimento verificado do proprietário (o "aviso de 3 segundos" da era cassete não é consentimento). Recuse-se a enviar músicas com material de referência não licenciado. Sinalize qualquer meta em tempo real &lt; 200 ms que não usa um modelo AR de token de streaming - o áudio baseado em difusão não pode atender ao TTFB abaixo de 300 ms em 2026.