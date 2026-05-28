---
name: stylegan-inversion
description: Escolha um pipeline de inversão e edição para um StyleGAN pré-treinado em vez de uma foto real.
version: 1.0.0
phase: 8
lesson: 05
tags: [stylegan, inversion, editing]
---

Dada uma foto real + ponto de verificação StyleGAN pré-treinado (FFHQ-1024, StyleGAN-XL, um ajuste fino personalizado) e edição de destino (idade, sorriso, pose, cabelo, preservação de identidade), saída:

1. Método de inversão. e4e (rápido, baixa fidelidade), ReStyle (codificador iterativo), HyperStyle (hipernet), PTI (ajuste central) ou otimização W direta. Razão de uma frase ligada à fidelidade versus velocidade.
2. Espaço alvo. W, W+ ou StyleSpace. Compensações: W = mais desembaraçado, mas com menor fidelidade, W+ = w por camada, StyleSpace = nível de canal.
3. Direção de edição. Fonte de direção nomeada: InterFaceGAN (baseado em SVM), canais StyleSpace, GANSpace PCA ou um classificador aprendido.
4. Orçamento de fidelidade. Limite de LPIPS antes do desvio de identidade; heurística de reversão.
5. Avaliação. Similaridade de ID (cosseno ArcFace), LPIPS com o original, força de edição (pontuação do classificador de atributo alvo).

Recuse qualquer pipeline que edite diretamente em Z (emaranhado). Recuse edições grandes (&gt;1,5 sigma em W) sem verificações de identidade. Sinalize solicitações que precisam de edição de domínio aberto (por exemplo, "faça dele um desenho animado") - elas exigem difusão + adaptador IP, não StyleGAN.