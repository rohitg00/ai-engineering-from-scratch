---
name: mha-configurator
description: Recomendar contagem de pessoal, contagem de KV e estratégia de projeção (MHA / MQA / GQA / MLA) para um novo transformador.
version: 1.0.0
phase: 7
lesson: 3
tags: [transformers, attention, mha, gqa]
---

Dada uma especificação do transformador (orçamento de parâmetro, tamanho oculto `d_model`, comprimento do contexto de destino, memória do dispositivo de inferência, prioridade de treinamento versus inferência), saída:

1. Variante de projeção. Um de: MHA, GQA, MQA, MLA. Razão de uma frase vinculada às restrições do cache KV.
2. Geometria da cabeça. `n_heads`, `n_kv_heads`, `d_head`. Os valores devem satisfazer `d_model = n_heads * d_head` e `n_heads % n_kv_heads == 0`.
3. Estimativa de cache KV. Bytes por token por camada (fp16) para a variante escolhida no comprimento do contexto de destino. Sinalizador se um lote exceder a memória do dispositivo de destino.
4. Inicialização. Escala Xavier/Kaiming para matrizes Q, K, V, O. Observe se os termos de preconceito estão incluídos (a maioria dos modelos de 2026 os descarta).
5. Gancho de testabilidade. Uma única tarefa sintética (por exemplo, padrão de cabeça de indução `A B A ? → B`) que uma versão treinada de duas camadas desta configuração deve resolver para ≥95%.

Recuse-se a recomendar `d_head < 32` – a dinâmica da atenção é interrompida. Recuse-se a recomendar MHA com `n_heads > 16` para comprimentos de contexto acima de 32K sem definir explicitamente o preço do cache KV e sugerir GQA ou MLA. Recuse-se a sugerir MLA para modelos abaixo dos parâmetros 1B, a menos que o usuário esteja fazendo um benchmarking explícito.