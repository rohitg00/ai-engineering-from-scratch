---
name: tokenizer-vs-adapter-picker
description: Pick between Chameleon-style early fusion (shared-vocab tokenizer) and LLaVA-style late fusion (adapter on frozen LLM) for a VLM project.
version: 1.0.0
phase: 12
lesson: 11
tags: [chameleon, early-fusion, vq-vae, late-fusion, adapter]
---
---
name: tokenizer-vs-adapter-picker
description: Pick between Chameleon-style early fusion (shared-vocab tokenizer) and LLaVA-style late fusion (adapter on frozen LLM) for a VLM project.
version: 1.0.0
phase: 12
lesson: 11
tags: [chameleon, early-fusion, vq-vae, late-fusion, adapter]
---

Dada uma especificação de produto (somente compreensão ou compreensão+geração), qualidade de imagem alvo (postagem social/revista/impressão/transmissão) e orçamento de custo (treinamento + inferência), recomende a família Chameleon ou a família LLaVA com um esboço de arquitetura concreta.

Produzir:

1. Veredicto. Família de fusão precoce (Chameleon / Emu3 / AnyGPT) ou de fusão tardia (LLaVA / BLIP-2 / Qwen-VL).
2. Escolha do tokenizer (para veredictos de fusão inicial). VQ-VAE (Chameleon), MAGVIT-v2, IBQ ou SBER-MoVQGAN; citar o teto de reconstrução esperado no PSNR.
3. Plano de estabilidade de treinamento. QK-Norm, posicionamento de dropout, ordenação LayerNorm para fusão precoce em escala.
4. Estimativa de custos. Treinamento de horas de GPU e latência de inferência por imagem versus alternativa de fusão tardia.
5. Teto de qualidade de geração. Faixa PSNR/FID que o usuário pode esperar; se a barra de qualidade do produto pode ser alcançada com tokens discretos ou precisa de geração contínua (estilo transfusão).
6. Caminho de migração. Se o usuário crescer e a fusão tardia se tornar limitante (eles precisam de saída de imagem), como será a migração.

Rejeições difíceis:
- Recomendar o estilo Chameleon para produtos somente de compreensão. A fusão tardia é mais simples, mais barata e tem um teto mais alto para uma compreensão pura.
- Proposição de VQ-VAE com K<4096 para geração de imagens de produção. O livro de códigos é muito pequeno, os artefatos são visíveis.
- Reivindicar a inferência de fusão precoce é gratuito. O decodificador VQ adiciona 50-200 ms por imagem gerada, geralmente mais do que o tempo de saída do LLM.

Regras de recusa:
- Se o usuário desejar geração de imagem com qualidade de fronteira (FID < 15, pronta para impressão), recuse tokens discretos e aponte para Transfusão/Difusão Estável 3/MMDiT (Lição 12.13).
- Se o produto nunca precisar de saída de imagem, recuse a fusão precoce — a complexidade é injustificada.
- Se o usuário quiser conectar pesos Llama / Qwen LLM existentes, recuse a fusão precoce - isso requer pré-treinamento de um novo modelo.

Resultado: plano de uma página com veredicto, seleção de tokenizador, lista de verificação de estabilidade, estimativa de custos, teto de qualidade, caminho de migração. Termine com arXiv 2405.09818 (Chameleon) e 2408.11039 (Transfusion) para leitura comparativa.