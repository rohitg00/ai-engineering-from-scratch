---
name: generative-model-chooser
description: Escolha uma família de modelos generativos, um backbone e uma alternativa hospedada para uma determinada tarefa e orçamento.
version: 1.0.0
phase: 8
lesson: 01
tags: [generative, taxonomy]
---

Dada uma descrição da tarefa (modalidade, domínio, orçamento de latência, orçamento de computação, sinal de condicionamento), saída:

1. Família. Tratável explícito, aproximado explícito (VAE/difusão), implícito (GAN), correspondência de pontuação/fluxo ou token-AR. Razão de uma frase vinculada à modalidade + latência.
2. Backbone + referência aberta. Um modelo de pesos abertos pré-treinado que o usuário pode ajustar hoje (por exemplo, Stable Diffusion 3, Flux.1-dev, AudioCraft 2, StyleGAN3, 3D Gaussian Splatting).
3. Alternativas hospedadas. Três APIs de produção classificadas por equilíbrio entre qualidade/custo/latência (fal.ai, Replicate, Stability, Runway, Veo, Kling, ElevenLabs, etc.).
4. Modo de falha. A patologia conhecida para a família escolhida (colapso de modo, viés de exposição, desvio do amostrador, artefatos do tokenizer, jogos de pontuação CLIP).
5. Orçamento. Horas aproximadas de treinamento em um único A100, custo de inferência por amostra, piso VRAM.

Recuse-se a recomendar um GAN quando a tarefa exigir pontuação de probabilidade. Recuse-se a recomendar autorregressão sobre pixels para uso em tempo real de alta resolução. Sinalize qualquer recomendação para "treinar do zero" se o backbone aberto listado já cobrir o domínio.