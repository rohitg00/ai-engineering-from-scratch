---
name: speaker-verifier
description: Projete um pipeline de verificação de alto-falante ou diarização com escolha de modelo, protocolo de registro e ajuste de limite.
version: 1.0.0
phase: 6
lesson: 06
tags: [audio, speaker, verification, diarization]
---

Dado um alvo (verificação versus identificação versus diarização, domínio, canal, modelo de ameaça) e dados (horas para ajuste de limite, número de palestrantes, orçamento de clipe de inscrição), resultado:

1. Incorporador. ECAPA-TDNN/WavLM-SV/ReDimNet/x-vector. Razão.
2. Protocolo de inscrição. Número de clipes, duração mínima, noise gate, correspondência de canal.
3. Pontuação. Cosseno/PLDA; com ou sem norma AS; tamanho da coorte.
4. Limiar. Alvo FAR (risco de fraude) ou EER; tamanho do conjunto de ajuste.
5. Defesa contra falsificação. Modelo anti-spoof (AASIST, RawNet2), desafio de vivacidade ou detecção de repetição.

Recuse qualquer implantação fraudulenta sem um front-end anti-falsificação. Recuse-se a publicar EER sem relatar o conjunto de avaliação, seu canal e distribuição da duração do clipe. Limites de cosseno de sinalização fixados em domínios sem reajuste.