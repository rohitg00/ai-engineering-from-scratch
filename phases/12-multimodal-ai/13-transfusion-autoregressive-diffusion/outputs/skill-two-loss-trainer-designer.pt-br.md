---
name: two-loss-trainer-designer
description: Design a Transfusion / MMDiT-style two-loss training setup (NTP on one modality, diffusion on another) with loss weights, mask design, and schedule.
version: 1.0.0
phase: 12
lesson: 13
tags: [transfusion, mmdit, two-loss, flow-matching, hybrid-attention]
---
---
name: two-loss-trainer-designer
description: Design a Transfusion / MMDiT-style two-loss training setup (NTP on one modality, diffusion on another) with loss weights, mask design, and schedule.
version: 1.0.0
phase: 12
lesson: 13
tags: [transfusion, mmdit, two-loss, flow-matching, hybrid-attention]
---

Dada uma especificação de treinamento multimodal (duas modalidades, que obtém NTP e que obtém difusão, escala do modelo alvo, comprimento da amostra alvo), projete uma configuração funcional de duas perdas.

Produzir:

1. Divisão de modalidade. Quais tokens são discretos (NTP) e quais são contínuos (difusão). Justifique por tipo de conteúdo (texto sempre discreto; imagens, áudio, vídeo podem ir em qualquer direção).
2. Máscara de atenção. Desenhe a máscara triangular de bloco para um exemplo de sequência. Especifique regiões bidirecionais e regiões causais.
3. Perda de peso. Pesos iniciais para (text_loss, image_loss). Recomenda-se o ajuste pela relação padrão-gradiente alvo. Cite o padrão ~0,1 da Transfusion.
4. Correspondência de fluxo vs DDPM. Escolha a variante de difusão; correspondência de fluxo para matemática mais simples, fluxo retificado para menos etapas de inferência.
5. Plano de inferência. Caminho NTP (amostragem autorregressiva sobre texto) + caminho de difusão (eliminação de ruído condicional sobre manchas de imagem). Especifique as etapas de redução de ruído (10-30).
6. Divisão MMDiT vs Transfusão. Quando adicionar pesos de bloco específicos da modalidade (MMDiT) versus compartilhar totalmente (Transfusão); regra prática por contagem de parâmetros.

Rejeições difíceis:
- Reivindicar uma máscara serve para todas as sequências. Cada amostra tem uma extensão de imagem diferente e precisa de sua própria máscara triangular de bloco.
- Utilização de DDPM sem vazão retificada ou casamento de vazão. Ambos precisam de menos etapas de inferência e são mais simples de ajustar.
- Equilibrar as perdas por peso fixo sem medir a relação gradiente-norma.

Regras de recusa:
- Se o usuário quiser apenas compreensão (entrada de imagem, saída de texto), recuse e recomende a fusão tardia no estilo LLaVA (Lição 12.05). Duas perdas são para geração.
- Se o usuário quiser o modelo <1B, recuse duas perdas e recomende tokens discretos (Chameleon) — em pequena escala, a cabeça de difusão é inadequada.
- Se o usuário não puder pagar a inferência dupla (NTP + loops de difusão), recuse e recomende Show-o (difusão discreta, loop único) ou Emu3.

Saída: design de uma página com divisão de modalidade, diagrama de máscara, pesos de perda, variante de fluxo, plano de inferência e decisão MMDiT versus compartilhada. Termine com arXiv 2408.11039 (Transfusion) e 2403.03206 (SD3) para referências canônicas.