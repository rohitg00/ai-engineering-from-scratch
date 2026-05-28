---
name: edge-target-picker
description: Escolha um alvo de inferência de borda (Apple ANE, Qualcomm Hexagon, WebGPU/WebLLM, NVIDIA Jetson) e formato de quantização correspondente de acordo com o dispositivo, modelo e orçamento de latência.
version: 1.0.0
phase: 17
lesson: 12
tags: [edge, ane, hexagon, webgpu, webllm, jetson, core-ml, qnn, nvfp4]
---

Dada a plataforma de implantação (iOS, Android, navegador, robótica/automotivo/servidor de borda), modelo e orçamento de latência/memória, produza uma recomendação de alvo de borda.

Produzir:

1. Alvo. Nomeie o NPU/GPU específico (ANE, Hexagon, WebGPU, Jetson Orin Nano/AGX/Thor). Justifique com a plataforma e a cobertura do tempo de execução de 2026.
2. Limite de largura de banda. Calcule o teto de decodificação teórico: largura de banda_GB_s / model_size_GB. Compare com os requisitos de tok/s do usuário. Se o teto estiver abaixo do exigido, recuse ou proponha um modelo menor/quantização mais rigorosa.
3. Formato de quantização. Escolha Q4 GGUF (navegador/CPU de borda), Core ML INT4 + FP16 (ANE), QNN INT8/INT4 (Hexagon) ou NVFP4 + FP8 KV (Jetson Thor/Edge-LLM).
4. Pipeline de conversão. Nomeie o conversor exato (conversor Core ML, Qualcomm AI Hub, MLC-LLM para WebLLM, compilador TensorRT-LLM Edge).
5. Orçamento contextual. Indique o contexto máximo que se ajusta aos pesos na RAM do dispositivo. Para casos de uso de contexto longo, especifique a quantização de KV (Q4 KV) ou recuse.
6. Reserva. Quando o dispositivo estiver incapacitado ou o WebGPU não estiver disponível (Firefox Android, navegadores mais antigos), especifique o substituto da API do lado do servidor com a mesma interface compatível com OpenAI.

Rejeições difíceis:
- Tok/s promissores acima do limite de largura de banda. Recusar – física.
- Direcionar ANE diretamente por meio de um tempo de execução não Core ML em 2026. Somente Core ML expõe ANE nativamente.
- Supondo que o WebGPU esteja em todos os navegadores. A cobertura em 2026 é de aproximadamente 70-75% móvel; sempre especifique o substituto.

Regras de recusa:
- Se o modelo tiver >6 GB e o alvo for um telefone (4-8 GB de RAM), recuse — proponha primeiro um modelo menor ou uma quantização agressiva.
- Se a solicitação for de contexto de 128K em um modelo 7B no iPhone, recuse – a RAM do dispositivo não cabe sem Q4 KV mais atenção de janela deslizante.
- Se a implantação exigir streaming de contexto longo no Android via WebGPU e o usuário precisar de suporte do Firefox, recuse e exija o Chrome ou um servidor substituto.

Resultado: um plano de uma página nomeando meta, teto, quantização, conversor, orçamento de contexto, substituto. Termine com uma única métrica: tok/s observados no pior dispositivo da frota alvo.