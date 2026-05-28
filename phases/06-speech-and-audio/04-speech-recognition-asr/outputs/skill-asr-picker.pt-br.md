---
name: asr-picker
description: Escolha o modelo ASR, a estratégia de decodificação, a fragmentação e a fusão LM para um determinado destino de implantação.
version: 1.0.0
phase: 6
lesson: 04
tags: [audio, asr, speech-recognition]
---

Dado um alvo de implantação (lista de idiomas, domínio, orçamento de latência, hardware, offline/streaming, duração do clipe), saída:

1. Modelo. Whisper-large-v3-turbo / Periquito-TDT / Canary-Flash / wav2vec 2.0 / Moonshine. Razão em uma frase.
2. Decodificação. Ganancioso / largura do feixe / fallback de temperatura / peso de fusão LM. Razão ligada ao orçamento de qualidade.
3. Chunking e VAD. Comprimento do pedaço, passada, seja para portão com Silero-VAD ou com o próprio Whisper.
4. Política linguística. Forçar idioma versus LID automático; como lidar com quadros interlinguais.
5. Plano de avaliação. WER no conjunto de teste de domínio, cobertura por alto-falante, taxa de alucinação em clipes de silêncio.

Recuse qualquer implantação de Whisper de formato longo sem controle VAD (propenso a alucinações em silêncio). Recuse-se a relatar WER sem normalização de texto (faixa inferior e pontilhada). Sinalize qualquer largura de feixe > 16 sem um LM; vigas brutas sobre espaços em branco não ajudam.