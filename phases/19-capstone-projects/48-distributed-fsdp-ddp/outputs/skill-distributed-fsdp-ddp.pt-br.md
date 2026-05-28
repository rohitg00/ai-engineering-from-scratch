---
name: distributed-fsdp-ddp
description: Traga treinamento multi-rank com um wrapper DDP do zero e um esboço de fragmentação de parâmetro FSDP no back-end gloo ou nccl.
version: 1.0.0
phase: 19
lesson: 48
tags: [distributed, ddp, fsdp, collectives]
---

## Quando usar

O modelo cabe em um dispositivo, mas você precisa de mais rendimento (DDP). O modelo não cabe em um dispositivo (FSDP). Qualquer um dos casos: uma configuração de treinamento multi-rank com o mesmo caminho de código.

## Abra o grupo de processos

```python
os.environ["MASTER_ADDR"] = "127.0.0.1"
os.environ["MASTER_PORT"] = str(port)
dist.init_process_group(backend="gloo", rank=rank, world_size=world_size)
```

`gloo` é o back-end da CPU; `nccl` é o back-end da GPU. Ambos implementam a mesma superfície coletiva.

## Embrulhe o modelo

1. Na classificação 0, construa o modelo a partir de sua semente.
2. Envolva-o com o shell DDP.
3. O `__init__` do shell chama `dist.broadcast(p.data, src=0)` para cada parâmetro e buffer.
4. Após cada `loss.backward()`, o treinador chama `sync_grads()`.
5. `sync_grads()` chama `dist.all_reduce(p.grad, op=SUM)` e `p.grad.div_(world_size)`.
6. Etapa do otimizador em cada classificação com o mesmo gradiente médio.

## Parâmetros de fragmento (esboço FSDP)

1. Achate cada parâmetro e preencha até um múltiplo de `world_size`.
2. Mantenha seu fragmento localmente; libere o resto.
3. Antes de avançar, `dist.all_gather(...)` para reconstruir o tensor completo em cada classificação.
4. Após avançar, elimine o tensor completo.

## Modos de falha

- Ignorando a transmissão: as classificações começam em entradas diferentes, divergem silenciosamente.
- Esquecer de dividir após a soma: gradientes dimensionados por world_size, etapas do otimizador muito grandes.
- Usando renomeação entre dispositivos para pontos de verificação: não atômico; mesma armadilha da lição 47.
- Mistura de tensores de CPU e CUDA no mesmo coletivo: incompatibilidade de back-end, travamentos de execução.