---
name: unified-gen-model-picker
description: Escolha entre as famílias Show-o / Transfusion / Emu3 / Janus-Pro para um produto que precisa de compreensão multimodal e geração com pesos abertos.
version: 1.0.0
phase: 12
lesson: 14
tags: [show-o, masked-diffusion, unified, t2i, inpainting]
---

Dado um produto que precisa de compreensão e geração unificadas (VQA, legendagem, T2I, pintura opcional) com uma restrição de pesos abertos e um orçamento de latência, escolha uma família de modelos e emita uma configuração de referência.

Produzir:

1. Veredicto familiar. Show-o (difusão discreta mascarada), Transfusion / MMDiT (difusão contínua), Emu3 / Chameleon (autoregressivo discreto) ou Janus-Pro (codificadores desacoplados).
2. Orçamento por etapas de inferência. 16 passos para Show-o, 20 para Transfusion, 1024+ para Emu3. Justifique a escolha com o orçamento de latência do usuário.
3. Suporte para pintura. O show-o é gratuito; A transfusão adiciona um canal de máscara; O Emu3 precisa de um ajuste separado. Sinalize isso para o usuário.
4. Escolha do tokenizador. Para famílias discretas, recomendo IBQ/MAGVIT-v2/SBER; para contínuo, recomendo VAE do SD3.
5. Estabilidade de treinamento. Duas perdas (Transfusão) necessita de ajuste de peso; A única perda de Show-o é mais limpa.
6. Caminho de migração se o usuário crescer. Do Show-o à Transfusão quando a qualidade se torna o limite.

Rejeições difíceis:
- Propor Emu3/Chameleon quando a latência de inferência for <10s por imagem. A autorregressão em aproximadamente 1.024 tokens é muito lenta.
- Reivindicar Show-o corresponde à Transfusão em qualidade de imagem de fronteira. Isso não acontece. O tokenizer é o teto.
- Recomendar Difusão Estável para um produto que necessita de VQA. SD não consegue raciocinar sobre imagens.

Regras de recusa:
- Se o usuário desejar <2s por geração de imagem, recuse o Show-o e recomende Stable Diffusion + um VLM separado para compreensão. Aceite a complexidade multimodelo.
- Se o usuário deseja a "melhor qualidade da categoria" com pesos abertos, recuse Show-o / Emu3 e recomende Transfusion-family (MMDiT) ou JanusFlow.
- Se o usuário não puder se comprometer com um tokenizer (teme licenciamento, limite de qualidade), recuse famílias apenas discretas e recomende a Transfusão.

Resultado: escolha de uma página com veredicto da família, orçamento de etapas, suporte de pintura, recomendação de tokenizador, plano de estabilidade e caminho de migração. Termine com arXiv 2408.12528 (Show-o), 2408.11039 (Transfusão), 2501.17811 (Janus-Pro).