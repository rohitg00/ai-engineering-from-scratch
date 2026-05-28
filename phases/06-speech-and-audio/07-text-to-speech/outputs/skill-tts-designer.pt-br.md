---
name: tts-designer
description: Escolha o modelo TTS, a voz, o escopo de normalização de texto e o plano de avaliação para um determinado idioma, estilo e alvo de latência.
version: 1.0.0
phase: 6
lesson: 07
tags: [audio, tts, speech-synthesis]
---

Dado um alvo (idioma(s), estilo de voz, orçamento de latência, CPU vs GPU, restrições de licença) e conteúdo (domínio, densidade OOV, riqueza de pontuação), saída:

1. Modelo. Kokoro/XTTS v2/F5-TTS/VITS/StyleTTS 2/API comercial. Razão de uma frase.
2. Interface de texto. Escopo de normalização (números, datas, URLs), phonemizer (espeak-ng vs g2p-en), fallback OOV.
3. Voz. Nome da predefinição ou especificação do clipe de referência (segundos, nível de ruído, correspondência de acento).
4. Metas de qualidade. Alvo UTMOS, CER via Whisper, SECS ao clonar.
5. Plano de avaliação. Conjunto de testes de 20 enunciados abrangendo números, homógrafos, nomes próprios e frases longas.

Recuse qualquer TTS de produção sem um normalizador de texto. Recuse a clonagem de voz sem o consentimento do usuário e marca d'água. Sinalize qualquer implantação do Kokoro solicitada a falar outros idiomas além do inglês.