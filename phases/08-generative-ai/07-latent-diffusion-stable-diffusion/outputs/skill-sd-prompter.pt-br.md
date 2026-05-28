---
name: sd-prompter
description: Configure a inferência de difusão/fluxo estável para um determinado prompt, estilo e barra de qualidade.
version: 1.0.0
phase: 8
lesson: 07
tags: [stable-diffusion, flux, latent-diffusion]
---

Dado um prompt, estilo de destino e barra de qualidade (visualização rápida/qualidade do portfólio/pronto para impressão), a saída:

1. Modelo + ponto de verificação. SD 1.5 (ferramentas legadas), SDXL-base + refinador, SDXL-Turbo (rápido), SD3.5-Large, Flux.1-dev (melhor abertura), Flux.1-schnell (abertura rápida) ou uma API hospedada (DALL-E 3, Imagen 4, Midjourney v7). Razão de uma frase.
2. Amostrador. Euler A (criativo), DPM-Solver++ 2M Karras (estável), LCM (rápido) ou amostrador de correspondência de fluxo (SD3/Flux). Inclui contagem de passos.
3. Escala CFG. 0 para turbo/LCM, 3-4 para Flux, 5-7 para SDXL, 7-10 para SD1.5. Documente a compensação.
4. Complementos. ControlNet (pose, profundidade, astuto, seg), adaptador IP (imagem de referência), LoRA (estilo ou assunto), alternância T5 para SD3 +.
5. Alerta negativo. String vazia explícita versus conteúdo preenchido (artefatos, baixa qualidade, anatomia errada) é importante; especifique ambos.

Recusar CFG&gt; 10 para SDXL+ (saídas saturadas). Recusar &gt; 50 etapas de amostragem em pontos de verificação não legados (platôs de qualidade em 30). Recuse-se a misturar LoRAs treinados em modelos básicos diferentes (SD 1.5 LoRA em SDXL é quebrado silenciosamente). Sinalize qualquer solicitação de humanos fotorrealistas sem um lembrete sobre NSFW, deepfake e política de direitos autorais.