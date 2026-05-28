---
name: img2img-chooser
description: Escolha uma abordagem imagem a imagem, considerando dados emparelhados e não emparelhados, especificidade de domínio e orçamento de latência.
version: 1.0.0
phase: 8
lesson: 04
tags: [pix2pix, img2img, conditional]
---

Dada uma descrição da tarefa (domínio de origem, domínio de destino, disponibilidade de dados - amostras emparelhadas/não emparelhadas/N, orçamento de latência, barra de qualidade), resultado:

1. Abordagem. Pix2Pix (emparelhado, estreito), Pix2PixHD (emparelhado, alta resolução), CycleGAN (não pareado), SPADE (seg-to-image) ou variante ControlNet sobre SD3 / Flux.1 (geral, domínio aberto).
2. Especificação de dados de treinamento. Contagem mínima de pares, resolução, acréscimos, considerações sobre licença.
3. Arquitetura. G (profundidade U-Net, largura do canal), D (campo receptivo PatchGAN, norma espectral), pesos de perda (adv, L1, VGG-perceptual).
4. Latência de inferência. Alvo ms/imagem em uma única GPU de consumidor (RTX 4090, M3 Max), compensação de resolução.
5. Avaliação. LPIPS contra dados pareados retidos, FID em amostras de 5k, métricas específicas de tarefas (mIoU para tarefas seg, PSNR para super-resolução), preferência humana.

Recuse-se a recomendar Pix2Pix quando os dados não estiverem emparelhados - em vez disso, prescreva CycleGAN ou ControlNet. Recuse-se a treinar um modelo emparelhado com menos de 500 pares sem conselhos de aumento/pré-treinamento. Sinalize qualquer solicitação que diga "prompt de texto arbitrário" - eles precisam de difusão + ControlNet, não de um GAN emparelhado.