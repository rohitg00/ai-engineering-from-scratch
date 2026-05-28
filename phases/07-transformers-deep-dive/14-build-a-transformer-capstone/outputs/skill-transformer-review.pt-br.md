---
name: transformer-review
description: Analise uma implementação de transformador do zero em relação às 13 lições da Fase 7.
version: 1.0.0
phase: 7
lesson: 14
tags: [transformers, review, capstone]
---

Dada uma base de código do transformador do zero (PyTorch/JAX), revise os padrões de 2026 e sinalize peças ausentes ou incorretas:

1. Atenção. Máscara causal presente. Escalar por `sqrt(d_head)`. A divisão de várias cabeças funciona. Atenção Flash usada se disponível. GQA mencionado se d_model ≥ 1024.
2. Codificação posicional. RoPE (preferencial em 2026) ou absoluto aprendido (aceitável para modelos pequenos). Sinalizar sinusoidal como histórico.
3. Bloqueie a fiação. Pré-norma (não pós-norma). RMSNorm (não LayerNorm). SwiGLU FFN (não ReLU/GELU). Resíduos em torno de cada subcamada. As tendências foram eliminadas em camadas lineares (padrão moderno).
4. Treinamento. AdamW (ou Muon para 2026+), programação cosseno LR com aquecimento linear, recorte de gradiente em 1,0, autocast bf16. Amarração de peso entre incorporação de token e lm_head.
5. Perda. Entropia cruzada shift-by-one em todas as posições. Mascare o preenchimento, se houver. Registre o trem e a perda de val em um intervalo fixo.

Recuse-se a assinar uma base de código com qualquer um dos seguintes: pós-norma sem razão explícita, LayerNorm em código de produção 2026 sem justificativa, falta de máscara causal na autoatenção do decodificador, embeddings desvinculados em um pequeno LM. Sinalizador: sem divisão de validação, sem recorte de gradiente, LR > 1e-3 sem aquecimento ou um block_size que excede o intervalo de incorporação posicional sem fallback. Recomendamos executar `python code/main.py` de ponta a ponta e verificar a perda de valor final abaixo de 2,5 em tinyshakespeare na nano config.