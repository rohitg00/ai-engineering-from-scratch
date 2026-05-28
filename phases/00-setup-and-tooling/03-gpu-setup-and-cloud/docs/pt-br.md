# Configuração de GPU e Nuvem

> Treinar em CPU é bom pra aprender. Treinar de verdade precisa de uma GPU.

**Tipo:** Build
**Linguagens:** Python
**Pré-requisitos:** Fase 0, Aula 01
**Tempo:** ~45 minutos

## Objetivos de Aprendizado

- Verificar disponibilidade de GPU local usando `nvidia-smi` e a API CUDA do PyTorch
- Configurar Google Colab com GPU T4 para experimentos gratuitos na nuvem
- Fazer benchmark de multiplicação de matrizes em CPU vs GPU e medir o speedup
- Estimar o maior modelo que cabe na sua VRAM usando a regra de bolso do fp16

## O Problema

A maioria das aulas das fases 1-3 rodam bem em CPU. Mas quando você começar a treinar CNNs, transformers ou LLMs (fases 4+), precisa de aceleração por GPU. Um treino de 8 horas em CPU leva 10 minutos em GPU.

Você tem três opções: GPU local, GPU na nuvem ou Google Colab (gratuito).

## O Conceito

```
Suas opções:

1. GPU NVIDIA local
   Custo: $0 (você já tem)
   Setup: Instalar CUDA + cuDNN
   Melhor para: Uso regular, grandes datasets

2. Google Colab (plano gratuito)
   Custo: $0
   Setup: Nenhum
   Melhor para: Experimentos rápidos, sem GPU em casa

3. GPU na nuvem (Lambda, RunPod, Vast.ai)
   Custo: $0.20-2.00/hora
   Setup: SSH + instalação
   Melhor para: Treino pesado, modelos grandes
```

## Construa

### Opção 1: GPU NVIDIA Local

Verifique se você tem uma:

```bash
nvidia-smi
```

Instale PyTorch com CUDA:

```python
import torch

print(f"CUDA available: {torch.cuda.is_available()}")
print(f"CUDA version: {torch.version.cuda}")
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
```

### Opção 2: Google Colab

1. Acesse [colab.research.google.com](https://colab.research.google.com)
2. Runtime > Change runtime type > T4 GPU
3. Execute `!nvidia-smi` para verificar

Faça upload dos notebooks deste curso direto pro Colab.

### Opção 3: GPU na Nuvem

Para Lambda Labs, RunPod ou Vast.ai:

```bash
ssh user@your-gpu-instance

pip install torch torchvision torchaudio
python -c "import torch; print(torch.cuda.get_device_name(0))"
```

### Sem GPU? Sem problema.

A maioria das aulas funciona em CPU. As que precisam de GPU vão avisar e incluem links pro Colab.

```python
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using: {device}")
```

## Construa: Benchmark GPU vs CPU

```python
import torch
import time

size = 5000

a_cpu = torch.randn(size, size)
b_cpu = torch.randn(size, size)

start = time.time()
c_cpu = a_cpu @ b_cpu
cpu_time = time.time() - start
print(f"CPU: {cpu_time:.3f}s")

if torch.cuda.is_available():
    a_gpu = a_cpu.to("cuda")
    b_gpu = b_cpu.to("cuda")

    torch.cuda.synchronize()
    start = time.time()
    c_gpu = a_gpu @ b_gpu
    torch.cuda.synchronize()
    gpu_time = time.time() - start
    print(f"GPU: {gpu_time:.3f}s")
    print(f"Speedup: {cpu_time / gpu_time:.0f}x")
```

## Exercícios

1. Execute o benchmark acima e compare os tempos de CPU vs GPU
2. Se você não tiver uma GPU, rode no Google Colab e compare
3. Verifique quanto de memória de GPU você tem e estime o maior modelo que cabe (regra de bolso: 2 bytes por parâmetro para fp16)

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| CUDA | "Programação de GPU" | A plataforma de computação paralela da NVIDIA que permite rodar código na GPU |
| VRAM | "Memória da GPU" | RAM de vídeo na GPU, separada da RAM do sistema. Limita o tamanho do modelo |
| fp16 | "Precisão reduzida" | Ponto flutuante de 16 bits, usa metade da memória do fp32 com perda mínima de precisão |
| Tensor Core | "Hardware rápido de matriz" | Cores eespecificaçãoializados da GPU para multiplicação de matrizes, 4-8x mais rápidos que cores normais |
