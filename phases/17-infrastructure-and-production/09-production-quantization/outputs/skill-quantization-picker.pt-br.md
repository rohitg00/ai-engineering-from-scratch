---
name: quantization-picker
description: Escolha um formato de quantização de 2026, considerando hardware, mecanismo, carga de trabalho e tolerância de qualidade, e produza um plano de calibração + validação.
version: 1.0.0
phase: 17
lesson: 09
tags: [quantization, awq, gptq, gguf, fp8, nvfp4, calibration]
---

Dado o hardware (CPU / H100 / H200 / B200 / GB200, com contagem), mecanismo (llama.cpp / vLLM / TRT-LLM / SGLang), modelo (tamanho + tipo de tarefa - chat de rotina / raciocínio / código / multi-LoRA) e tolerância de qualidade (pode absorver queda de N pontos em HumanEval / MATH / MMLU), escolha um formato de quantização e produza um plano de validação.

Produzir:

1. Recomendação de formato. Um dos seguintes: GGUF Q4_K_M, GGUF Q5_K_M, GPTQ-Int4 + Marlin, AWQ-Int4 + Marlin, FP8, NVFP4 + FP8 KV ou um combo empilhado. Justifique pela árvore de decisão: CPU → GGUF; raciocínio → FP8; multi-LoRA em vLLM → GPTQ; bate-papo de rotina da GPU → AWQ; Blackwell validado → NVFP4.
2. Orçamento de memória. Pesos do relatório + cache KV (na simultaneidade relatada × contexto) + ativações. Confirme se ele cabe na GPU de destino ou indique o requisito de multi-GPU.
3. Plano de calibração. Fonte do conjunto de dados (com correspondência de domínio para AWQ/GPTQ; C4/WikiText genérico como último recurso). Contagem de amostras (500-2000 para domínio). Conjunto de validação (10% retidos do pool de calibração).
4. Plano de validação. Conjunto de avaliação correspondente à tarefa: HumanEval para código, MATH/MMLU para raciocínio, MT-Bench para chat. Linha de base BF16 vs quantizada. Enviar se a queda for ≤ tolerância de qualidade.
5. Decisão de cache KV. Separado da quantização de peso. Recomendar FP8 KV para fundamentação; BF16 KV se a precisão da atenção for marginal; INT8 KV somente após validação.
6. Caminho de reversão. Mantenha os pesos BF16/FP8 no disco; sinalizador para voltar se a qualidade da produção diminuir.

Rejeições difíceis:
- Recomendação de pesos NVFP4 em cargas de trabalho com muito raciocínio sem validação de conjunto de avaliação.
- Calibração de dados genéricos da web para modelos de domínio. Sempre use no domínio.
- Esquecer o cache KV no orçamento da HBM. Sempre detalhe.
- Reivindicar números de rendimento sem nomear os kernels (Marlin-AWQ vs AWQ simples é 10x).

Regras de recusa:
- Se a carga de trabalho for inerentemente marginal em termos de qualidade (geração criativa aberta, raciocínio de casos extremos), recuse o INT4 agressivo. Fique FP8 ou BF16.
- Se o motor for llama.cpp, recuse qualquer formato diferente de GGUF. O formato correspondente ao motor é a aposta da mesa.
- Se o usuário não puder executar uma avaliação de 1.000 amostras, recuse. Sem quantização cega na produção.

Saída: uma seleção de quantização de uma página listando o formato escolhido, orçamento HBM, plano de calibração, plano de validação, decisão de cache KV e caminho de reversão. Termine com um parágrafo "o que medir a seguir" nomeando um delta de conjunto de avaliação, pressão de cache KV sob simultaneidade de pico ou taxa de transferência em tamanho de lote real, dependendo do risco principal.