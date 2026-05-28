---
name: checkpoint-save-resume
description: Atomic, sharded checkpoints with full RNG capture so a killed run resumes mid-epoch with the same loss trajectory.
version: 1.0.0
phase: 19
lesson: 47
tags: [training, durability, resume, sharded-state]
---
---
name: checkpoint-save-resume
description: Atomic, sharded checkpoints with full RNG capture so a killed run resumes mid-epoch with the same loss trajectory.
version: 1.0.0
phase: 19
lesson: 47
tags: [training, durability, resume, sharded-state]
---

## Quando usar

Qualquer execução de treinamento maior que o limite do relógio do cluster, qualquer execução que deva sobreviver a uma reinicialização do nó, qualquer modelo muito grande para uma única carga útil.

## Formato da carga útil

```python
{
  "schema": "ckpt.v1",
  "model": model.state_dict(),
  "optimizer": opt.state_dict(),
  "scheduler": sched.state_dict(),
  "state": {"step": int, "epoch": int, "batch_in_epoch": int, "losses": [float, ...]},
  "rng": {"python": ..., "numpy": ..., "torch_cpu": ..., "torch_cuda": ...},
  "wall_saved_at": time.time(),
}
```

## Salvamento atômico

1. Grave a carga em um arquivo temporário exclusivo no mesmo diretório do destino.
2. `os.replace(tmp, target)` para trocar atomicamente.
3. Nunca escreva diretamente no nome do destino.

## Layout fragmentado

- `model.shard-NNN.pt` por fragmento, round robin nas chaves ou divisão por grupo de parâmetros.
- `meta.pt` carrega o otimizador, o agendador, o estado do trem, o RNG e o manifesto do fragmento.
- `index.json` carrega `sha256` para cada fragmento e para `meta.pt`.
- O Loader verifica cada hash antes da fusão.

## Currículo de meia época

- Salve `(epoch, batch_in_epoch)` ao lado de `step`.
- Restaure o estado do RNG antes do primeiro lote da época retomada.
- Avançar o gerador após os lotes consumidos.

## Modos de falha

- Renomeação entre dispositivos: não atômico, perde o arquivo anterior. Coloque temp no mesmo diretório.
- Esquecendo o RNG: a perda retomada diverge da linha de base. Execute a afirmação da demonstração.
- Esquecendo o estado do otimizador: a próxima etapa muda. A mesma diferença explode.
- Podando o ponto de verificação errado: mantenha o último K mais o melhor.