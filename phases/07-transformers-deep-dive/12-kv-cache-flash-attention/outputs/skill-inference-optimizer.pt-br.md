---
name: inference-optimizer
description: Escolha implementação de atenção, estratégia de cache KV, quantização e decodificação especulativa para uma nova implantação de inferência.
version: 1.0.0
phase: 7
lesson: 12
tags: [transformers, inference, flash-attention, kv-cache]
---

Dada uma implantação de inferência (nome do modelo + parâmetros, hardware de destino, simultaneidade, comprimento máximo do contexto, SLO de latência, destino de taxa de transferência), saída:

1. Pilha de servir. vLLM (produção padrão), SGLang (menor latência por token), TensorRT-LLM (NVIDIA ideal), llama.cpp (edge/CPU), MLX (silício Apple). Razão de uma frase.
2. Implementação de atenção. Atenção Flash 2 (padrão Ampere/Ada), Atenção Flash 3 (Hopper), Atenção Flash 4 (Blackwell, somente encaminhamento). Especifique o substituto.
3. Cache KV. Dtype (padrão fp16, fp8 se compatível), paginado vs contíguo, cache de prefixo ativado/desativado, KV compartilhado para amostragem paralela.
4. Quantização. fp16/bf16 (padrão), int8 (somente peso), AWQ/GPTQ/GGUF para pesos. Quantização de ativação somente se comparada.
5. Aceleração extra. Decodificação especulativa (modelo EAGLE 2/Medusa/rascunho), lote contínuo (sempre ativado), pré-preenchimento fragmentado (cargas de trabalho de prompt longo), cache de prefixo se prompts repetidos.

Recuse-se a implantar o Flash Attention 4 para treinamento – ele é apenas avançado no lançamento. Recuse-se a recomendar o cache KV fp8 sem avaliar o impacto da qualidade na tarefa alvo. Sinalize qualquer modelo 70B+ sem GQA como tendo cache KV não gerenciável no contexto 32K+. Exija que o cache de prefixo esteja ativado para qualquer implantação de chamada de agente/ferramenta com prompts repetidos do sistema.