# Inferência na Edge — Apple Neural Engine, Qualcomm Hexagon, WebGPU/WebLLM, Jetson

> A restrição central da edge é a largura de banda de memória, não o compute. DRAM mobile opera a 50-90 GB/s; HBM3 de datacenter chega a 2-3 TB/s — gap de 30-50x. Decode é memory-bound então o gap é decisivo. Em 2026 o cenário se divide em quatro frentes. Apple M4/A18 Neural Engine atinge 38 TOPS com memória unificada (sem cópia CPU↔NPU). Qualcomm Snapdragon X Elite / 8 Gen 4 Hexagon atinge 45 TOPS. WebGPU + WebLLM roda Llama 3.1 8B (Q4) a ~41 tok/s no M3 Max (aproximadamente 70-80% do nativo); 17.6k estrelas no GitHub, API compatível com OpenAI, ~70-75% de cobertura mobile. NVIDIA Jetson Orin Nano Super (8GB) comporta Llama 3.2 3B / Phi-3; AGX Orin roda gpt-oss-20b via vLLM a ~40 tok/s; Jetson T4000 (JetPack 7.1) é 2x o AGX Orin. TensorRT Edge-LLM suporta EAGLE-3, NVFP4, chunked prefill — demonstrado no CES 2026 por Bosch, ThunderSoft, MediaTek.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, simulador de decode memory-bound)
**Pré-requisitos:** Fase 17 · 04 (Internals do vLLM Serving), Fase 17 · 09 (Quantização em Produção)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Explicar por que inferência LLM mobile é memory-bandwidth-bound e o compute é secundário.
- Enumerar os quatro alvos edge (Apple ANE, Qualcomm Hexagon, WebGPU/WebLLM, NVIDIA Jetson) e associar cada um a um caso de uso.
- Nomear a lacuna de cobertura WebGPU de 2026 (Firefox Android pegando carona) e o lançamento do Safari iOS 26.
- Escolher um formato de quantização por alvo (Core ML INT4 + FP16 para ANE, QNN INT8/INT4 para Hexagon, WebGPU Q4 para browser, NVFP4 para Jetson Thor).

## O Problema

Um cliente quer um chatbot on-device: voz-first, privado por padrão, funciona offline. Num MacBook Pro M3 Max, Llama 3.1 8B Q4 roda a ~55 tok/s — tudo bem. Num iPhone 16 Pro, o mesmo modelo roda a 3 tok/s — não vai. Num Android intermediário com Snapdragon 8 Gen 3, 7 tok/s. No browser via WebGPU no Chrome Android v121+, 4-8 tok/s dependendo do dispositivo.

A variância de throughput não é problema de porting. É o gap de largura de banda vezes o formato de quantização vezes se a NPU é acessível a partir do user-space. Inferência na edge em 2026 são quatro problemas diferentes com quatro soluções diferentes.

## O Conceito

### Largura de banda é o teto real

Decode lê o conjunto completo de pesos para cada token. Um modelo 7B em Q4 ocupa 3.5 GB. Ler 3.5 GB a 50 GB/s leva 70 ms — teto teórico de ~14 tok/s. A 90 GB/s (DRAM mobile de ponta) o teto vai para ~25 tok/s. Nenhuma quantidade de compute ajuda abaixo desse número.

HBM3 de datacenter a 3 TB/s lê os mesmos 3.5 GB em 1.2 ms — teto de 830 tok/s. Mesmo modelo, mesmos pesos. Subsistema de memória diferente.

### Apple Neural Engine (M4 / A18)

- Até 38 TOPS. Memória unificada (CPU e ANE compartilham o mesmo pool) — sem custo de cópia.
- Acesso via Core ML + modelos compilados `.mlmodel`, ou via Metal Performance Shaders (MPS) pelo PyTorch.
- O backend Metal do llama.cpp usa MPS, não ANE diretamente; ANE nativo requer conversão para Core ML.
- Melhor caminho prático para apps iOS em 2026: Core ML com pesos INT4 + ativações FP16.

### Qualcomm Hexagon (Snapdragon X Elite / 8 Gen 4)

- Até 45 TOPS. Integrado com CPU e GPU no SoC mas domínio de memória separado.
- QNN (Qualcomm Neural Network) SDK e AI Hub fornecem conversão do PyTorch/ONNX.
- Chat templates, Llama 3.2, Phi-3 todos vêm como artefatos de primeira classe no AI Hub.

### Intel / AMD NPUs (Lunar Lake, Ryzen AI 300)

- 40-50 TOPS. Software atrás de Apple/Qualcomm; OpenVINO melhorando mas nicho.
- Melhor para apps copilot Windows ARM; nativo em desktops AMD/Intel para local-first.

### WebGPU + WebLLM

- Rode modelos no browser via compute shaders do WebGPU; sem instalação.
- Llama 3.1 8B Q4 a ~41 tok/s no M3 Max — aproximadamente 70-80% do nativo via mesmo backend.
- 17.6k estrelas no GitHub do WebLLM; API JS compatível com OpenAI; Apache 2.0.
- Cobertura 2026: Chrome Android v121+, Safari iOS 26 GA, Firefox Android ainda pegando carona. Cobertura mobile total ~70-75%.

### Família NVIDIA Jetson

- Orin Nano Super (8GB): comporta Llama 3.2 3B, Phi-3 com bom tok/s.
- AGX Orin: roda gpt-oss-20b via vLLM a ~40 tok/s.
- Thor / T4000 (JetPack 7.1): performance 2x o AGX Orin, suporte a EAGLE-3 e NVFP4.
- TensorRT Edge-LLM (2026) suporta speculative decoding EAGLE-3, pesos NVFP4, chunked prefill — otimizações de datacenter portadas para edge.

### Escolha de quantização por alvo

| Alvo | Formato | Notas |
|------|---------|-------|
| Apple ANE | Pesos INT4 + ativações FP16 | Caminho de conversão Core ML |
| Qualcomm Hexagon | QNN INT8 / INT4 | Conversores do AI Hub |
| WebGPU / WebLLM | Q4 MLC (q4f16_1) | Use `mlc_llm convert_weight` + `.wasm` compilado; GGUF não é suportado |
| Jetson Orin Nano | Q4 GGUF ou TRT-LLM INT4 | Memory-bound |
| Jetson AGX / Thor | NVFP4 + FP8 KV | Caminho Edge-LLM |

### A armadilha do long-context na edge

O contexto de 128K do Llama 3.1 é funcionalidade de datacenter. Num celular com 8 GB de RAM, 4 GB de modelo + 2 GB de KV cache para 32K tokens + overhead do OS = OOM. Deployments na edge mantêm contexto em 4K-8K a menos que quantização agressiva de KV (Q4 KV) seja aceita.

### Voz é o aplicativo killer

Agentes de voz são sensíveis a latência (primeiro token < 500 ms). Inferência local elimina latência de rede completamente. Combine com speech-to-text (variantes do Whisper Turbo rodam na edge) e inferência na edge vira o loop de voz com qualidade de produção.

### Números que você deve lembrar

- Apple M4 / A18 ANE: 38 TOPS.
- Qualcomm Hexagon SD X Elite: 45 TOPS.
- WebLLM M3 Max: ~41 tok/s no Llama 3.1 8B Q4.
- AGX Orin: ~40 tok/s no gpt-oss-20b via vLLM.
- Gap de largura de banda datacenter-edge: 30-50x.
- Cobertura mobile WebGPU: ~70-75% (Firefox Android atrás).

## Use

`code/main.py` calcula os tetos teóricos de throughput de decode a partir de matemática memory-bound para diferentes alvos edge. Compara com benchmarks observados e destaca onde a largura de banda, não o compute, é o gargalo.

## Entregue

Esta aula produz `outputs/skill-edge-target-picker.md`. Dados plataforma (iOS/Android/browser/Jetson), modelo e orçamento de latência/memória, escolhe um formato de quantização e pipeline de conversão.

## Exercícios

1. Execute `code/main.py`. Para um modelo 7B em Q4 num Snapdragon 8 Gen 3 (~77 GB/s de largura de banda), calcule o teto de decode. Compare com o observado de 6-8 tok/s — o runtime é eficiente?
2. WebGPU no Android requer Chrome v121+. Projete um fallback para browsers antigos — server-side via mesma API compatível com OpenAI.
3. Seu app iOS precisa de streaming de contexto 4K. Qual combinação de modelo/formato permite ficar abaixo de 4 GB de memória ativa num iPhone 16?
4. Jetson AGX Orin roda gpt-oss-20b a 40 tok/s. Jetson Nano comporta apenas um 3B. Se seu produto mira em ambos, como unificar o stack de inferência?
5. Argumente se "WebLLM está pronto para produção em 2026". Cite cobertura, performance e a lacuna do Firefox Android.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| ANE | "neural engine da Apple" | NPU on-device nas séries M e A; memória unificada |
| Hexagon | "NPU da Qualcomm" | NPU Snapdragon; QNN SDK para acesso |
| WebGPU | "GPU do browser" | API GPU padronizada pelo W3C; Chrome/Safari 2026 |
| WebLLM | "runtime LLM no browser" | Projeto MLC-LLM; Apache 2.0; JS compatível com OpenAI |
| Jetson | "NVIDIA edge" | Família Orin Nano / AGX / Thor / T4000 |
| TRT Edge-LLM | "TensorRT da edge" | Port edge 2026 do TensorRT-LLM; EAGLE-3 + NVFP4 |
| Memória unificada | "pool compartilhado" | CPU e NPU veem a mesma RAM; sem custo de cópia |
| Bandwidth-bound | "limitado por memória" | Decode limitado por bytes/sec na leitura de pesos |
| Core ML | "conversão da Apple" | Framework Apple para modelos nativos ANE |
| QNN | "stack da Qualcomm" | Qualcomm Neural Network SDK |

## Leituras Adicionais

- [On-Device LLMs State of the Union 2026](https://v-chandra.github.io/on-device-llms/) — cenário e benchmarks.
- [NVIDIA Jetson Edge AI](https://developer.nvidia.com/blog/getting-started-with-edge-ai-on-nvidia-jetson-llms-vlms-and-foundation-models-for-robotics/) — Orin / AGX / Thor.
- [NVIDIA TensorRT Edge-LLM](https://developer.nvidia.com/blog/accelerating-llm-and-vlm-inference-for-automotive-and-robotics-with-nvidia-tensorrt-edge-llm/) — anúncio do port edge 2026.
- [WebLLM (arXiv:2412.15803)](https://arxiv.org/html/2412.15803v2) — design e benchmarks.
- [Apple Core ML](https://developer.apple.com/documentation/coreml) — conversão nativa ANE.
- [Qualcomm AI Hub](https://aihub.qualcomm.com/) — modelos pré-convertidos para Hexagon.
