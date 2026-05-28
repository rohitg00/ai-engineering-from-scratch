---
name: hybrid-picker
description: Escolha entre Transformer puro, híbrido estilo Jamba e SSM puro para uma determinada carga de trabalho.
version: 1.0.0
phase: 10
lesson: 21
tags: [jamba, mamba, ssm, hybrid, long-context, memory-budget, architecture]
---

Dada uma especificação de carga de trabalho (perfil de comprimento de contexto p50/p99, combinação de tarefas, orçamento de memória por GPU, taxa de transferência alvo, prioridade de qualidade versus velocidade), recomende entre um Transformer puro (+MoE +MLA), um híbrido estilo Jamba e um modelo Mamba puro.

Produzir:

1. Bucket de comprimento de contexto. Curta (menos de 16k), média (16k-64k), longa (64k-256k) ou ultralonga (256k ou mais). Impulsiona a decisão de primeira passagem.
2. Recomendação de arquitetura. Escolha um Transformer puro, híbrido 1:7, híbrido 1:3, híbrido 1:15 ou Mamba puro. Justifique o uso do intervalo de contexto mais as demandas de recuperação no contexto da tarefa.
3. Verificação do orçamento de memória. Calcular cache KV + estado SSM no contexto de destino. Confirme se ele cabe no acelerador de destino após contabilizar os pesos e a memória de ativação (normalmente 10-20 GB além dos pesos e do cache KV).
4. Divulgação de compensações de qualidade. Documente o custo da qualidade do nível de dispersão escolhido. Os híbridos abaixo da proporção de 1:7 degradam-se na recuperação no contexto em quantidades mensuráveis; pure Mamba falha em algumas tarefas de rastreamento de estado.
5. Compatibilidade da pilha de inferência. Confirme se a arquitetura escolhida é suportada pela pilha de destino (vLLM, TensorRT-LLM, SGLang, llama.cpp). Os híbridos têm uma cobertura de ferramentas mais fina do que os transformadores puros.

Rejeições difíceis:
- Híbrido estilo Jamba para contexto abaixo de 16k. A sobrecarga arquitetônica não se justifica.
- Pure Mamba para tarefas de raciocínio pesado ou de referência cruzada de vários documentos. Limites de rastreamento de estado afetam.
- Proporções híbridas sub-1:15. Abaixo disso, a recuperação no contexto não é confiável.
- Qualquer recomendação que não se enquadre no orçamento de memória computado no acelerador especificado.

Regras de recusa:
- Se a carga de trabalho for genuinamente mista de contexto curto e longo, recuse a recomendação híbrida e recomende o Transformer puro (com MLA, se possível) — os híbridos brilham especificamente em cargas de trabalho de contexto longo.
- Se o acelerador for de consumo (24 GB ou menos), recuse modelos de tamanho híbrido e recomende um pequeno híbrido destilado ou um Transformer puro quantizado.
- Se a carga de trabalho for de geração em lote 1 sensível à latência e o modelo for novo (sem caminho de implantação existente), recuse e recomende um Transformer puro bem suportado com decodificação especulativa (Fase 10 · 15) como o caminho mais simples.

Saída: uma recomendação de uma página listando o intervalo de contexto, escolha de arquitetura, cache KV no contexto de destino, divulgação de compensação de qualidade e compatibilidade de pilha de inferência. Termine com um parágrafo "o que monitorar" nomeando a avaliação específica de longo contexto (RULER, LongBench, agulha no palheiro) que confirmaria a recomendação nas primeiras 10 mil solicitações de produção.