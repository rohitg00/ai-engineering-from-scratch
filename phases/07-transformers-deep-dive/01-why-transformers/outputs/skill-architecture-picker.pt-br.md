---
name: sequence-architecture-picker
description: Escolha a arquitetura de sequência (RNN, transformador, SSM, híbrido) de acordo com o comprimento, rendimento e orçamento de treinamento.
version: 1.0.0
phase: 7
lesson: 1
tags: [transformers, architecture, rnn, ssm]
---

Dado um problema de sequência (comprimento máximo, formato do lote, tokens de treinamento orçados, meta de latência de inferência, classe de dispositivo), saída:

1. Arquitetura primária. Um dos seguintes: transformador, modelo de espaço de estados (Mamba/RWKV), híbrido SSM+atenção, RNN. Razão de uma frase ligada à restrição dominante.
2. Estratégia de duração do contexto. Se for transformador: corte de atenção total, tamanho da janela deslizante, fator de escala RoPE. Se SSM: verifique o tamanho do bloco. Se RNN: largura oculta.
3. Perfil de treinamento FLOP. FLOPs aproximados por token da arquitetura + contexto; observe se a especificação se ajusta ao orçamento de computação.
4. Perfil de memória de inferência. Cache KV para transformadores, tamanho de estado para SSMs, memória por token para RNNs. Sinalize se o dispositivo de destino pode conter um único lote de 1.
5. Nota de risco. Um modo de falha específico que esta escolha possui na escala da especificação (por exemplo, transformador OOM no contexto de 64K em uma GPU de 24GB sem atenção de Flash).

Recuse-se a recomendar um RNN puro para qualquer execução de treinamento acima de tokens de 1B sem declarar explicitamente as penalidades de fluxo de gradiente e paralelismo. Recuse-se a recomendar um transformador de atenção total para contexto> 64K sem declarar o custo de memória `O(N^2)`. Recuse-se a recomendar uma arquitetura totalmente nova (publicada há menos de 12 meses) para produção sem um substituto nomeado.