---
name: audio-loader
description: Valide um arquivo de áudio bruto em relação às expectativas de um modelo de destino e faça uma nova amostra dele com segurança.
version: 1.0.0
phase: 6
lesson: 01
tags: [audio, speech, preprocessing]
---

Dado um arquivo de áudio (caminho, canais, taxa de amostragem, profundidade de bits, codec) e um modelo de destino (ASR/TTS/classificador com uma taxa de amostragem necessária e contagem de canais), a saída:

1. Incompatibilidades. Liste todas as dimensões em que o arquivo não corresponde ao destino (sr, canais, duração mínima, verificação de recorte).
2. Plano de reamostragem. Fonte sr, destino sr, biblioteca de reamostragem (`torchaudio.transforms.Resample` ou `librosa.resample`), tipo de filtro anti-aliasing.
3. Plano de canal. Estratégia de dobra mono (média versus somente esquerda) ou passagem multicanal quando o modelo suporta.
4. Normalização. Normalização de pico vs RMS, alvo dBFS, proteção de corte.
5. Trecho de validação. Python que carrega o arquivo, executa as transformações e afirma que a matriz final corresponde a `(target_sr, dtype, channel_count, range)`.

Recuse-se a reduzir a resolução sem um filtro anti-aliasing. Recuse-se a aumentar a resolução além de 2x sem um filtro de reconstrução. Sinalize qualquer arquivo de entrada com picos de corte acima de ±0,999 ou um deslocamento DC acima de ±0,01.