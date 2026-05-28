---
name: open-model-picker
description: Escolha uma família LLM aberta, quantização e pilha de inferência para um determinado destino de implantação.
version: 1.0.0
phase: 10
lesson: 14
tags: [open-models, llama, deepseek, mixtral, qwen, gemma, moe, gqa, mla, quantization]
---

Dado um alvo de implantação (tipo de GPU, VRAM por GPU, número de GPUs, comprimento de contexto alvo, latência alvo p50/p99, pico de solicitações simultâneas) e um perfil de tarefa (bate-papo, código, raciocínio, recuperação de contexto longo, uso de ferramenta), recomende um modelo aberto mais pilha de serviços com raciocínio explícito sobre cada um dos seis botões de arquitetura da Lição 14.

Produzir:

1. Lista de modelos. Três candidatos, cada um com parâmetros totais, parâmetros ativos (com reconhecimento de MoE), sinalizadores de arquitetura (norma/ativação/posição/atenção/MoE/contexto) e o único motivo pelo qual entrou na lista restrita.
2. Verificação do orçamento de memória. Para o candidato principal: memória de peso em BF16 e na quantização escolhida; Cache KV no contexto de destino para o tamanho do lote de destino; margem de ativação. Interrompa a recomendação se os pesos + cache KV + ativações excederem a VRAM disponível.
3. Escolha de quantização. GPTQ-4bit, AWQ-4bit, FP8 ou BF16. Justifique a sensibilidade da precisão da tarefa (as tarefas de código/matemática/raciocínio sofrem um impacto maior com a quantização agressiva do que o bate-papo ou a recuperação).
4. Pilha de inferência. vLLM, TensorRT-LLM, SGLang ou llama.cpp. Justifique contra: necessidade de lote contínuo, suporte de decodificação especulativa, compatibilidade de formato de quantização e topologia de nó único versus topologia de vários nós.
5. Verificação da integridade do rendimento. Preencher previamente tokens/s e decodificar estimativas de tokens/s com base na largura de banda da memória da GPU (decodificação) e TFLOPs (pré-preenchimento). Rejeite a recomendação se a taxa de transferência de decodificação estiver abaixo do limite mínimo de usuários simultâneos do destino.
6. Reserva. Segunda opção se o principal candidato exceder VRAM ou orçamento de rendimento. Sempre cite um.

Rejeições difíceis:
- Modelos densos acima de 30B em uma única GPU de consumo de 24GB sem descarregamento ou quantização agressiva.
- Modelos MoE em uma pilha de serviços sem suporte paralelo de especialistas.
- Contexto longo (128k+) em arquiteturas sem GQA ou MLA (explode o cache KV).
- Qualquer recomendação que não nomeie a revisão específica do modelo (por exemplo, "Llama 3 8B Instruct v3.1", não "Llama 3").

Resultado: um modelo de listagem de recomendações de uma página, quantização, pilha, com evidências numeradas para cada decisão. Termine com um parágrafo "vale a pena reconsiderar se..." nomeando a capacidade específica ou o parâmetro de implantação que mudaria a escolha.