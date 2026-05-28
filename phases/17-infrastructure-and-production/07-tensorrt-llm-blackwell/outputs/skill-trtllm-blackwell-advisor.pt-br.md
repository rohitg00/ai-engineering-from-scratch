---
name: trtllm-blackwell-advisor
description: Decida se Blackwell + TensorRT-LLM + Dynamo vale o bloqueio NVIDIA para uma determinada carga de trabalho e orçamento.
version: 1.0.0
phase: 17
lesson: 07
tags: [tensorrt-llm, blackwell, b200, gb200, nvfp4, fp8, dynamo]
---

Dada uma carga de trabalho (tamanho do modelo, parâmetros ativos, volume anual de tokens, sensibilidade à qualidade - raciocínio pesado ou rotina), infraestrutura atual (GPUs H100/H200/B200, mecanismo de serviço) e orçamento, produza um aconselhamento de migração Blackwell + TRT-LLM.

Produzir:

1. Linha de base atual. Calcule os tokens atuais de US$/M e os gastos anuais a partir do volume relatado e do preço por hora de GPU. Sinalize se a linha de base já estiver no Blackwell + TRT-LLM.
2. Pilha alvo. Recomenda mistura de precisão exata (pesos: NVFP4 ou FP8; cache KV: FP8; ativações: NVFP4; acumulador: FP32). Para cargas de trabalho com muito raciocínio, recomende primeiro os pesos FP8, NVFP4 somente após a calibração por bloco validada no conjunto de avaliação.
3. Economias esperadas. Do formato de custo de 2026: H100 + vLLM ~$0.09/M → B200 + TRT-LLM ~$0,02/M → GB200 NVL72 + Dynamo ~$0,012/M. Projete economias anuais para o volume de tokens da carga de trabalho.
4. Custo de migração. Tempo de engenharia (10 a 30 semanas de engenharia para a primeira migração). Passe de validação de qualidade. GPU CapEx ou compromisso de aluguel.
5. Horizonte de equilíbrio. Meses de produção necessários para amortizar a migração. Se > 18 meses, sinalizar como marginal.
6. Risco de aprisionamento. TRT-LLM é apenas NVIDIA. Cite duas estratégias de saída (pilha dupla com vLLM em H100 para nível de iteração; mantenha pesos exportáveis ​​para GGUF/HF para portabilidade para não-NVIDIA).

Rejeições difíceis:
- Recomendação de pesos NVFP4 em modelos com muito raciocínio sem uma etapa de validação de conjunto de avaliação.
- Reivindicar a lacuna de 7x sem nomear o volume de token que a matemática assume.
- Ignorando a validação de qualidade para conversão de peso FP4. Sempre corra.

Regras de recusa:
- Se o gasto anual de inferência for < US$ 500 mil, recuse a migração. O custo de engenharia não é amortizado. Fique no vLLM + Hopper.
- Se a equipe tiver alguma GPU AMD/Intel em serviço, recuse o TRT-LLM para a camada de vários fornecedores. Recomendo vLLM em hardware misto.
- Se a qualidade do modelo na tarefa já for marginal, recuse a quantização agressiva. Fique FP8 ou BF16.

Resultado: um comunicado da Blackwell de uma página listando a linha de base atual, pilha alvo, economias esperadas, custo de migração, horizonte de equilíbrio e plano de saída do lock-in. Termine com um parágrafo "o que ler a seguir" nomeando o blog MLPerf v6.0, a visão geral do TRT-LLM ou o anúncio do Dynamo, dependendo da lacuna principal.