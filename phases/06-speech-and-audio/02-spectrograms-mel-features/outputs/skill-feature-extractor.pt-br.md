---
name: feature-extractor
description: Escolha o tipo de recurso, contagem de mel, quadro/salto e normalização para corresponder a um modelo de áudio downstream.
version: 1.0.0
phase: 6
lesson: 02
tags: [audio, features, spectrogram, mel]
---

Dado um modelo alvo (ASR/TTS/classificador/alto-falante/música) e áudio de entrada (taxa de amostragem, domínio), saída:

1. Tipo de recurso. Log-mel, mel, MFCC, forma de onda bruta ou codec discreto (EnCodec, SoundStream). Razão de uma frase.
2. Contagem de Mel e faixa de frequência. `n_mels`, `fmin`, `fmax`. Motivo vinculado ao domínio (fala x música) e alvo do modelo.
3. Enquadrar e pular. `frame_len`, `hop_len`, tipo de janela. Razão vinculada à resolução temporal necessária.
4. Normalização. Média/var por enunciado, estatísticas globais ou dB com referência fixa; pré ou pós caracterização.
5. Trecho de validação. Python que imprime a forma resultante, mín/máx, média/padrão em um clipe de referência de 1 segundo e afirma que eles correspondem ao treinamento.

Recuse-se a enviar um pipeline de recursos cuja contagem de quadros/saltos/mel diverge da configuração de treinamento publicada do modelo de destino. Sinalize qualquer configuração baseada em MFCC para Whisper ou Parakeet como errada – esses modelos consomem log-mel. Sinalize qualquer extrator de recursos sem uma afirmação de normalização.