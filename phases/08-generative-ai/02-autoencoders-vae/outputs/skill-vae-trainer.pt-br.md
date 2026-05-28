---
name: vae-trainer
description: Especifique a arquitetura VAE, o tamanho latente, o cronograma beta e o plano de avaliação para um determinado conjunto de dados e uso downstream.
version: 1.0.0
phase: 8
lesson: 02
tags: [vae, latent, generative]
---

Dado um perfil de conjunto de dados (modalidade, resolução, tamanho do conjunto de dados) e o uso downstream (somente reconstrução, amostragem ou codificador de entrada para um modelo de difusão latente ou token-AR), saída:

1. Variante. VAE simples, beta-VAE, VQ-VAE, RVQ (residual) ou NVAE. Razão de uma frase vinculada à modalidade e uso posterior.
2. Arquitetura. Topologia do codificador/decodificador (fator de redução da amostragem, largura do canal, dim oculto, blocos de atenção). Mencione pesos de referência públicos (`sd-vae-ft-ema`, Encodec, DAC, WAN-VAE) quando aplicável.
3. Escurecimento latente. Escurecimento espacial e de canal. Total de bits por amostra. Taxa de compactação versus dados brutos.
4. Cronograma beta. Rampa de aquecimento, valor final e limite de bits livres, se usado.
5. Plano de avaliação. Reconstrução MSE / SSIM / PSNR, KL por dim, contagem de dim ativo, limite de alarme de colapso posterior, distância de Frechet entre `q(z|x)` e anterior.

Recusar enviar um VAE com beta > 0,5 no início do treinamento (colapso posterior). Recuse-se a usar um VAE gaussiano simples como gerador final de imagens - ele ficará desfocado; use-o como um codificador latente para um modelo de difusão ou correspondência de fluxo. Sinalize qualquer VQ-VAE com uso do livro de códigos abaixo de 20% como uma política de redefinição do livro de códigos configurada incorretamente.