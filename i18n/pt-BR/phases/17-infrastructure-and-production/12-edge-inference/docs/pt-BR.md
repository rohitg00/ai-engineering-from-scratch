# Inferência de bordo  Apple Neural Engine, Qualcomm Hexagon, WebGPU/WebLLM, Jetson

> A restrição de borda do núcleo é a largura de banda da memória, não o computação. A DRAM móvel fica a 50-90 GB/s; o datacenter HBM3 limpa 2-3 TB/s  uma lacuna de 30-50x. A decodificação é limitada à memória, por isso a lacuna é decisiva. Em 2026, a paisagem divide-se em quatro partes. O Apple M4/A18 Neural Engine chega a 38 TOPS com memória unificada (sem cópia CPUNPU). Qualcomm Snapdragon X Elite / 8 Gen 4 Hexagon chega a 45 TOPS. WebGPU + WebLLM executa Llama 3.1 8B (Q4) a ~ 41 tok/s no M3 Max (cerca de 70-80% nativo); 17,6k estrelas GitHub, API compatível com OpenAI, ~ 70-75% cobertura móvel. NVIDIA Jetson Orin Nano Super (8GB) combina com Llama 3.2 3B / Phi-3; AGX Orin corre gpt-oss-20b via vLLM a ~ 40 tok/s; Jetson T4000 (JetPack 7.1) é 2x AGX Orin. TensorRT Edge-LLM suporta EAGLE-3, NVFP4, preenchimento em pedaços mostrado no CES 2026 pela Bosch, ThunderSoft, MediaTek.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy bandwidth-bound decode simulator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 17 · 09 (Production Quantization)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Explique porque a inferência de LLM móvel é limitada à largura de banda de memória e a computação é secundária.
- Enumere os quatro alvos de borda (Apple ANE, Qualcomm Hexagon, WebGPU/WebLLM, NVIDIA Jetson) e ajuste cada um a um caso de uso.
- Nomear a lacuna de cobertura WebGPU 2026 (Firefox Android alcançando) e o Safari iOS 26 pouso.
- Escolha um formato de quantização por alvo (Core ML INT4 + FP16 para ANE, QNN INT8/INT4 para Hexagon, WebGPU Q4 para navegador, NVFP4 para Jetson Thor).

## O problema

Um cliente quer um chatbot no dispositivo: voz-primeira, privada por padrão, funciona offline. Em um MacBook Pro M3 Max, Llama 3.1 8B Q4 funciona a ~55 tok/s  bem. Em um iPhone 16 Pro, o mesmo modelo funciona a 3 tok/s  não bem. Em um Android de gama média com Snapdragon 8 Gen 3, 7 tok/s. No navegador através de WebGPU no Chrome Android v121+, 4-8 tok/s dependendo do dispositivo.

A variação de throughput não é um problema de porting. É a diferença de largura de banda vezes o formato de quantização vezes se o NPU é acessível a partir do espaço do usuário.

## O conceito

### O largura de banda é o verdadeiro teto

O decode lê o conjunto completo de pesos para cada token. Um modelo 7B no Q4 é de 3,5 GB. Ler 3,5 GB a 50 GB / s leva 70 ms  um limite teórico de ~ 14 tok / s. A 90 GB / s (high-end DRAM móvel) o limite se move para ~ 25 tok / s. Nenhuma quantidade de computação ajuda abaixo deste número.

Datacenter HBM3 a 3 TB/s limpa o mesmo 3,5 GB em 1,2 ms  teto é 830 tok/s. O mesmo modelo, os mesmos pesos.

### Motor Neural da Apple (M4 / A18)

- Até 38 TOPS. Memória unificada (CPU e ANE compartilham o mesmo pool)  sem custo superior de cópia.
- Acesso através do Core ML + `.mlmodel`Modelos compilados, ou através de Shaders de desempenho de metal (MPS) através de PyTorch.
- Llama.cpp Metal backend usa MPS, não ANE diretamente; ANE nativo requer conversão Core ML.
- Melhor caminho prático para aplicativos iOS em 2026: Core ML com pesos INT4 + ativações FP16.

### Qualcomm Hexagon (Snapdragon X Elite / 8 Gen 4)

- Integra com CPU e GPU no SoC, mas com domínio de memória separado.
- QNN (Qualcomm Neural Network) SDK e AI Hub fornecem conversão a partir de PyTorch / ONNX.
- Modelos de chat, Llama 3.2, Phi-3 todos enviados como artefatos de primeira classe no AI Hub.

### Intel / AMD NPUs (Lunar Lake, Ryzen AI 300)

- O software está atrasado pela Apple/Qualcomm; o OpenVINO está melhorando, mas é um nicho.
- Melhor para aplicativos de copiloto ARM do Windows; nativo em desktops AMD/Intel para local-primeiro.

### WebGPU + WebLLM

- Execute modelos no navegador através de shaders de computação WebGPU; nenhuma instalação.
- Llama 3.1 8B Q4 a ~ 41 tok/s em M3 Max  aproximadamente 70-80% nativo através do mesmo backend.
- 17,6k GitHub estrelas em WebLLM; OpenAI-compatível JS API; Apache 2.0.
- 2026 cobertura: Chrome Android v121+, Safari iOS 26 GA, Firefox Android ainda alcançando.

### NVIDIA Família Jetson

- Orin Nano Super (8GB): combina com Llama 3.2 3B, Phi-3 a bons tok/s.
- AGX Orin: corre gpt-oss-20b via vLLM a ~ 40 tok/s.
- Thor / T4000 (JetPack 7.1): 2x desempenho AGX Orin, EAGLE-3 e NVFP4 suportados.
- TensorRT Edge-LLM (2026) suporta a decodificação especulativa EAGLE-3, pesos NVFP4, preenchimento em pedaços  as otimizações do datacenter portadas para a borda.

### A escolha de quantificação por alvo

| Target | Format | Notes |
|--------|--------|-------|
| Apple ANE | INT4 weights + FP16 activations | Core ML conversion path |
| Qualcomm Hexagon | QNN INT8 / INT4 | AI Hub converters |
| WebGPU / WebLLM | Q4 MLC (q4f16_1) | Use `mlc_llm convert_weight` + compiled `.wasm`; GGUF is not supported |
| Jetson Orin Nano | Q4 GGUF or TRT-LLM INT4 | Memory-bound |
| Jetson AGX / Thor | NVFP4 + FP8 KV | Edge-LLM path |

### A armadilha de longo contexto está a ponta

O contexto 128K do Llama 3.1 é um recurso do datacenter. Em um telefone com 8 GB de RAM, modelo de 4 GB + 2 GB de cache KV para tokens 32K + OS overhead = OOM. As implementações de Edge mantêm o contexto em 4K-8K a menos que a quantização KV agressiva (Q4 KV) seja aceita.

### A voz é o aplicativo assassino

Os agentes de voz são sensíveis à latência (primeiro token < 500 ms). A inferência local elimina completamente a latência da rede. Combinado com fala-a-texto (variantes de Whisper Turbo executadas em borda) e inferência de borda se torna o loop de voz de qualidade de produção.

### Números que você deve lembrar

- Apple M4 / A18 ANE: 38 TOPS.
- Qualcomm Hexagon SD X Elite: 45 TOPS.
- WebLLM M3 Max: ~ 41 tok/s no Llama 3.1 8B Q4.
- AGX Orin: ~ 40 tok/s em gpt-oss-20b via vLLM.
- O espaço de largura de banda do datacenter é de 30 a 50 vezes maior.
- Cobertura móvel WebGPU: ~ 70-75% (Lacagem do Firefox Android).

```figure
edge-bandwidth-pipe
```

## Usá-lo

`code/main.py`Comparar com benchmarks observados e destaques onde a largura de banda, não a computação, é o gargalo de engarrafamento.

## Envia-o

Esta lição produz`outputs/skill-edge-target-picker.md`. Dada a plataforma (iOS/Android/browser/Jetson), modelo e orçamento de latência/memória, escolhe um formato de quantização e um pipeline de conversão.

## Exercícios

1. Corra .`code/main.py`Para um modelo 7B no Q4 em um Snapdragon 8 Gen 3 (~ 77 GB / s largura de banda), calcular o teto de decodificação. Comparar com 6-8 tok / s observados  é o tempo de execução eficiente?
2. WebGPU no Android requer Chrome v121+. Projeto de um fallback para navegadores mais antigos  lado do servidor através da mesma API compatível com OpenAI.
3. O seu aplicativo iOS precisa de streaming de conteúdo 4K. Que combinação de modelo/formato permite que você fique com menos de 4 GB de memória ativa em um iPhone 16?
4. Jetson AGX Orin executa gpt-oss-20b a 40 tok/s. Jetson Nano cabe apenas a 3B. Se o seu produto alveja ambos, como você unificar a pilha de inferência?
5. Argumente se "WebLLM está pronto para produção em 2026". Cite a cobertura, desempenho e a lacuna do Firefox Android.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| ANE | "Apple neural engine" | On-device NPU in M-series and A-series; unified memory |
| Hexagon | "Qualcomm NPU" | Snapdragon NPU; QNN SDK for access |
| WebGPU | "browser GPU" | W3C-standardized browser GPU API; Chrome/Safari 2026 |
| WebLLM | "browser LLM runtime" | MLC-LLM project; Apache 2.0; OpenAI-compatible JS |
| Jetson | "NVIDIA edge" | Orin Nano / AGX / Thor / T4000 family |
| TRT Edge-LLM | "edge TensorRT" | 2026 edge port of TensorRT-LLM; EAGLE-3 + NVFP4 |
| Unified memory | "shared pool" | CPU and NPU see same RAM; no copy overhead |
| Bandwidth-bound | "memory limited" | Decode gated by bytes/sec reading weights |
| Core ML | "Apple conversion" | Apple framework for ANE-native models |
| QNN | "Qualcomm stack" | Qualcomm Neural Network SDK |

## Mais leitura

- [On-Device LLMs State of the Union 2026](https://v-chandra.github.io/on-device-llms/) paisagem e referências.
- [NVIDIA Jetson Edge AI](https://developer.nvidia.com/blog/getting-started-with-edge-ai-on-nvidia-jetson-llms-vlms-and-foundation-models-for-robotics/)Orin / AGX / Thor.
- [NVIDIA TensorRT Edge-LLM](https://developer.nvidia.com/blog/accelerating-llm-and-vlm-inference-for-automotive-and-robotics-with-nvidia-tensorrt-edge-llm/) Anúncio de portos de bordo de 2026.
- [WebLLM (arXiv:2412.15803)](https://arxiv.org/html/2412.15803v2) design e valores de referência.
- [Apple Core ML](https://developer.apple.com/documentation/coreml) Conversion nativa.
- [Qualcomm AI Hub](https://aihub.qualcomm.com/) Modelos pré-convertidos para Hexagon.
