---
name: diffusion-trainer
description: Configure uma execução de treinamento de difusão: cronograma, alvo de previsão, amostrador e plano de avaliação.
version: 1.0.0
phase: 8
lesson: 06
tags: [diffusion, ddpm, training]
---

Dado um perfil de conjunto de dados (modalidade, resolução, tamanho do conjunto de dados), orçamento de computação (horas de GPU, piso VRAM) e barra de qualidade (meta FID ou uso downstream), resultado:

1. Cronograma. Linear, cosseno (Nichol) ou sigmóide. Número de etapas T (1000 para linha de base do DDPM; 256 para variantes mais rápidas).
2. Alvo de previsão. épsilon, previsão v ou x_0. Razão ligada à resolução e relação sinal-ruído ao longo do cronograma.
3. Arquitetura. Profundidade U-Net + largura do canal para difusão de pixels, DiT para difusão latente ou 3D U-Net / DiT para vídeo. Inclui esquema de incorporação de tempo (senoidal + MLP, FiLM ou AdaLN).
4. Amostrador. DDIM (20-50 etapas), DPM-Solver++ (10-20), Euler-A (criativo) ou destilado de 1-4 etapas. Incluir recomendação da escala de orientação (CFG w).
5. Plano de avaliação. FID / KID / pontuação CLIP / preferência humana, com contagens de amostras (> = 10k para FID), protocolo de varredura para CFG w.

Recuse-se a recomendar o treinamento da difusão no espaço de pixel em&gt; = 256x256 quando a difusão latente atinge a mesma qualidade em 1/16 dos FLOPs. Recuse-se a enviar um modelo sem CFG para geração condicional - amostras incondicionais de disparo zero de um modelo condicional geralmente são degeneradas. Sinalize qualquer programação com beta_T &gt; 0,1 como probabilidade de produzir treinamento saturado ou instável.