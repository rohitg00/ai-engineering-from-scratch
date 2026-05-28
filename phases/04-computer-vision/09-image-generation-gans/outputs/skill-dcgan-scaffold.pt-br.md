---
name: skill-dcgan-scaffold
description: Escreva um scaffold completo de DCGAN a partir de z_dim, image_size e num_channels, incluindo loop de treinamento e salvador de amostras
version: 1.0.0
phase: 4
lesson: 9
tags: ['computer-vision', 'gan', 'dcgan', 'scaffolding']
---


# Scaffold DCGAN

Dado três parâmetros, gere um esqueleto de projeto DCGAN executável com a arquitetura dimensionada corretamente pra resolução de imagem alvo.

## Quando usar

- Começando um novo experimento generativo em um dataset pequeno.
- Ensinando fundamentos de DCGAN com um exemplo mínimo funcional.
- Prototipando GANs condicionais (injeção de label acontece no mesmo scaffold).

## Entradas

- `image_size`: um dos valores 32, 64, 128 (deve ser potência de dois).
- `num_channels`: 1 (escala de cinza) ou 3 (RGB).
- `z_dim`: tipicamente 64 ou 128.
- `with_spectral_norm`: yes | no; padrão yes.

## Dimensionamento da arquitetura

Number of transposed conv blocks in G and strided conv blocks in D depends on `image_size`:

| image_size | blocos G | blocos D |
|------------|----------|----------|
| 32         | 4        | 4        |
| 64         | 5        | 5        |
| 128        | 6        | 6        |

Each additional block doubles (G) or halves (D) the spatial dimension. Feature count starts at 32 and scales with `feat_base * 2^block_index`.

## Arquivos de saída

- `model.py` — Generator + Discriminator classes
- `train.py` — training loop, loss, optimiser setup
- `sample.py` — sample grid saver
- `config.json` — hyperparameters
- `README.md` — 10-line quickstart

## Relatório

```
[scaffold]
  image_size:       <int>
  num_channels:     <int>
  z_dim:            <int>
  spectral_norm:    yes | no

[arch]
  G blocks:         <N>, channels: [list]
  D blocks:         <N>, channels: [list]
  G params (est):   <N>
  D params (est):   <N>

[training defaults]
  optimizer:   Adam(lr=2e-4, betas=(0.5, 0.999))
  batch_size:  64
  epochs:      50
  sample_every: 1 epoch

[files written]
  - model.py
  - train.py
  - sample.py
  - config.json
  - README.md
```

## Regras

- Sempre use `nn.Tanh()` na saída de G e escale os dados pra [-1, 1] durante o treinamento.
- Sempre use `LeakyReLU(0.2)` em D.
- Quando `with_spectral_norm == yes`, envolva cada conv em D com `spectral_norm()` e remova BatchNorm de D. Mantenha BatchNorm em G.
- Nunca gere um scaffold pra image_size > 128 — DCGAN fica instável acima disso; sugira StyleGAN ou um modelo de diffusion.
