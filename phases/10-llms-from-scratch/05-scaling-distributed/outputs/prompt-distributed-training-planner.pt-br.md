---
name: prompt-distributed-training-planner
description: Planeje uma execução de treinamento distribuído de acordo com o tamanho do modelo e o hardware disponível
version: 1.0.0
phase: 10
lesson: 5
tags: [distributed-training, fsdp, deepspeed, tensor-parallelism, pipeline-parallelism, scaling]
---

# Planejador de treinamento distribuído

Ao planear uma execução de treino distribuída para um modelo de linguagem grande, utilize esta estrutura para determinar a estratégia de paralelismo, o orçamento de memória, a sobrecarga de comunicação e o rendimento esperado.

## Requisitos de entrada

Fornecer:
- **Tamanho do modelo** (parâmetros em bilhões)
- **Tokens de treinamento alvo** (em trilhões)
- **GPUs disponíveis** (tipo: A100/H100/H200, contagem, interconexão: NVLink/InfiniBand)
**Memória GPU** (80 GB para A100/H100, 141 GB para H200)
- **Nós** (GPUs por nó, número de nós)
- **Restrições orçamentárias** (custo máximo em dólares, tempo máximo de funcionamento)

## Etapa 1: Orçamento de memória

Calcule a memória por GPU para cada componente:

| Componente | Fórmula | FP16 | FP32 |
|-----------|---------|------|------|
| Pesos | parâmetros x bytes_per_param | parâmetros x 2 | parâmetros x 4 |
| Otimizador Adam (m + v) | parâmetros x 4 x 2 | 8 bytes/parâmetro sempre | 8 bytes/parâmetro |
| Gradientes | parâmetros x bytes_per_param | parâmetros x 2 | parâmetros x 4 |
| Ativações (estimativa) | seq_len x lote x oculto x camadas x 2 | varia | varia |

Se o total exceder a memória da GPU, será necessária a fragmentação. Tente em ordem:
1. ZeRO-1 (somente otimizador de shard) – comunicação mais barata
2. ZeRO-2 (+ gradientes) – comunicação moderada
3. FSDP/ZeRO-3 (+ pesos) – maior comunicação, mas máxima economia de memória
4. Adicione um ponto de verificação de ativação se as ativações ainda forem muito grandes
5. Adicione paralelismo de tensor se uma única camada não couber em uma GPU

## Etapa 2: Estratégia de Paralelismo

### Árvore de decisão

1. **Uma camada cabe em uma GPU?**
   - Não: você precisa de paralelismo tensorial. Defina TP = 2, 4 ou 8 (dentro de um nó).
   - Sim: Ignore o paralelismo do tensor.

2. **O modelo completo (com fragmentação) cabe em GPUs dentro de um nó?**
   - Não: você precisa de paralelismo de pipeline. Definir PP = número de nós/grupos.
   - Sim: ignore o paralelismo do pipeline.

3. **Quantas GPUs restantes para paralelismo de dados?**
   - DP = total_gpus / (TP x PP)

4. **Qual nível de fragmentação no grupo paralelo de dados?**
   - Comece com FSDP (ZeRO-3). Reduza para ZeRO-2 ou ZeRO-1 se a comunicação apresentar gargalos.

### Configurações Típicas

| Tamanho do modelo | Total de GPUs | PT | PP | DP | Fragmentação |
|-----------|-----------|----|----|-----|----------|
| 7B | 8 | 1 | 1 | 8 | FSDP |
| 13B | 16 | 2 | 1 | 8 | FSDP |
| 70B | 64 | 8 | 1 | 8 | FSDP |
| 70B | 128 | 8 | 2 | 8 | FSDP |
| 405B | 16.384 | 8 | 16 | 128 | FSDP |

## Etapa 3: Análise da Comunicação

Estime o volume de comunicação por etapa de treinamento:

- **Paralelo de dados (redução total)**: 2 x gradiente_size x (N-1)/N por etapa
- **FSDP (reunião total + dispersão reduzida)**: ~3 x peso_tamanho x (N-1)/N por etapa (maior que DP)
- **Tensor paralelo (redução total por camada)**: 2 x activate_size x num_layers por etapa (precisa de NVLink)
- **Pipeline paralelo (ponto a ponto)**: activate_size por limite de estágio (mínimo)

Se o tempo de comunicação exceder 20% do tempo de computação, a estratégia estará vinculada à comunicação. Soluções:
- Acúmulo de gradiente (reduzir a frequência totalmente reduzida)
- Sobreposição de comunicação com computação (o FSDP faz isso por padrão)
- Aumentar o tamanho do microlote (melhor relação computação-comunicação)
- Mude para um estágio de fragmentação com menos comunicação

## Etapa 4: estimativa de rendimento e custo

**FLOPS por etapa de treinamento:**
- Encaminhar: ~2 x parâmetros x tokens_per_batch
- Retroceder: ~4 x parâmetros x tokens_per_batch (2x avançar)
- Total: ~6 x parâmetros x tokens_per_batch

**Tempo de treinamento:**
- total_flops = 6 x parâmetros x total_tokens
- time_seconds = total_flops / (num_gpus x gpu_tflops x 1e12 x utilização)
- Utilização típica: 35-45% (considerando comunicação, bolhas de pipeline, sobrecarga de memória)

**Custo:**
- total_gpu_horas = num_gpus x tempo_segundos / 3600
- custo = total_gpu_hours x cost_per_gpu_hour

## Etapa 5: Lista de verificação de validação

Antes do lançamento:

1. A memória por GPU se ajusta ao limite de hardware (com 10% de espaço livre)
2. O tamanho efetivo do lote corresponde ao alvo (per_gpu_batch x DP x gradiente_accumulation_steps)
3. A relação comunicação-computação está abaixo de 20%
4. A fração de bolha do pipeline está abaixo de 15% (microlotes suficientes)
5. A taxa de aprendizagem é dimensionada para o tamanho efetivo do lote
6. A frequência de verificação considera a probabilidade de falha (economize a cada 1-2 horas para grandes execuções)
7. O recorte de gradiente está definido (normalmente 1,0 para modelos grandes)
8. As etapas de aquecimento são proporcionais ao total de etapas (normalmente 0,1-1% do total)

## Bandeiras Vermelhas

- **TP > 8**: o paralelismo de tensor entre nós (sobre InfiniBand) é quase sempre mais lento que o paralelismo de pipeline
- **Estágios do pipeline > 32**: a sobrecarga de bolha torna-se significativa mesmo com muitos microlotes
- **Tamanho efetivo do lote > 10 milhões de tokens**: Retornos decrescentes; pode prejudicar a convergência
- **Utilização abaixo de 30%**: Limitada à comunicação – reavaliar a estratégia de paralelismo
- **Nenhum ponto de verificação de ativação acima de 13B**: você ficará sem memória durante a passagem para trás
- **Sem acúmulo de gradiente com lote pequeno por GPU**: O ruído do gradiente aumenta; acumular para um lote efetivo de mais de 256 amostras