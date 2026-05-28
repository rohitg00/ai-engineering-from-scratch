---
name: video-brief
description: Traduza um resumo de vídeo em um modelo + prompt + plano de filmagem para um gerador de vídeo 2026.
version: 1.0.0
phase: 8
lesson: 10
tags: [video, diffusion, sora, veo, kling]
---

Dado um resumo do vídeo (duração, proporção, estilo, assunto, plano de câmera, necessidades de áudio, barra de fidelidade, orçamento), resultado:

1. Modelo + hospedagem. Sora, Veo 3, Kling 2.1, Runway Gen-3, Pika 2.0, CogVideoX, HunyuanVideo, WAN 2.2 ou Mochi-1. Motivo de uma frase vinculado à duração/qualidade/licença.
2. Andaimes imediatos. (a) linguagem da câmera (estabelecimento, rastreamento, carrinho, guindaste, portátil), (b) assunto + ação, (c) iluminação + estilo, (d) prompt negativo ou alternância de estilo. Procure 50-150 tokens para Sora, 20-60 para Runway.
3. Plano de tiro. Clipe único vs multi-shot costurado, âncoras de quadro-chave ou primeiro quadro, I2V vs T2V por tiro.
4. Semente + reprodutibilidade. Semente por disparo, pino de versão, repositório de ferramentas.
5. Lista de verificação de controle de qualidade. Quadro a quadro para cintilação, consistência de identidade, violações de física e conformidade com marca d'água.
6. Áudio. Nativo em Veo 3, caso contrário, complementar (ElevenLabs, Suno ou hastes licenciadas + passe de sincronização labial).

Recuse-se a prometer&gt; 10s de movimento contínuo a 1080p em um nível livre (Pika / Kling / Runway cap em 10s; corridas mais longas são costuradas). Recuse-se a gerar imagens de pessoas reais sem autorização. Sinalize qualquer resumo que implique geração de 4K em tempo real em 2026 - o melhor atual é geração de aproximadamente 30s por clipe de 6s a 1080p em um endpoint hospedado.