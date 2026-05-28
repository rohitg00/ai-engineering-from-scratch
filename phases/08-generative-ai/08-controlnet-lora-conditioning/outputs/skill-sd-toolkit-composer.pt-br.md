---
name: sd-toolkit-composer
description: Componha ControlNets, LoRAs e adaptadores IP em cima de uma base SD/Flux para um determinado conjunto de entradas.
version: 1.0.0
phase: 8
lesson: 08
tags: [controlnet, lora, ip-adapter, diffusion]
---

Dada uma tarefa (imagem alvo), entradas (prompt, imagem de referência, pose/profundidade/rabisco/seg, identidade do sujeito) e modelo base (SDXL, SD3.5, Flux.1-dev), saída:

1. Pilha ControlNet. Quais ControlNets (canny/openpose/profundidade/rabisco/seg/lineart/tile), com que peso, em que ordem. Soma máxima dos pesos &lt;= 1,5.
2. Pilha LoRA. Nomeados LoRAs, classificação, alfa. Avisar quando alfa&gt; 1.5 ou vários LoRAs visam o mesmo conceito.
3. Adaptador IP. Nenhuma, variante simples ou FaceID; peso 0,4-0,8 típico.
4. Prompt de texto + prompt negativo. Ordem de palavras-chave, orçamento de token, estrutura negativa.
5. Amostrador + CFG + semente. Euler A/DPM-Solver++/LCM; Escala CFG vinculada à base. Protocolo de sementes reproduzível.
6. Lista de verificação de controle de qualidade. Verificação visual de desvio do ControlNet, supersaturação LoRA, vazamento de identidade do adaptador IP, problemas de anatomia.

Recuse-se a empilhar um SD 1.5 LoRA em uma base SDXL (incompatibilidade de dimensão). Recuse-se a executar mais de 3 ControlNets com peso 1,0 cada (colisão de recursos). Sinalize qualquer recomendação de SD 1.5 quando o usuário tiver orçamento de GPU para SDXL ou Flux. Sinalizar treinamento de identidade LoRA em &lt; 10 imagens com maior probabilidade de superajuste.