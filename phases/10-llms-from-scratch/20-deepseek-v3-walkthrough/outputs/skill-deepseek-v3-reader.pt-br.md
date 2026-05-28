---
name: deepseek-v3-reader
description: Leia uma configuração da família DeepSeek e produza uma análise de arquitetura componente por componente.
version: 1.0.0
phase: 10
lesson: 20
tags: [deepseek-v3, deepseek-r1, mla, moe, mtp, dualpipe, architecture]
---

Dado um modelo da família DeepSeek (V3, R1 ou qualquer derivado) e sua configuração (hidden_size, camadas, num_experts, kv_lora_rank, etc.), produza uma análise de arquitetura que divide o modelo por componente e identifica quais inovações específicas do DeepSeek ele usa.

Produzir:

1. Leitura de configuração campo por campo. Para cada campo, nomeie o componente para o qual ele é mapeado e a contagem de parâmetros com a qual ele contribui. Formato: `field_name: value → interpretation → parameter contribution`.
2. Detalhamento dos parâmetros. Parâmetros totais, parâmetros ativos, proporção ativa. Dividido por incorporação, atenção por camada, MLP por camada (denso vs especialista), roteador, módulo MTP, cabeçote LM, total RMSNorm.
3. Cache KV no contexto de destino. Reportar valores BF16 e FP8. Inclua uma comparação com uma linha de base GQA (8/128) estilo Llama-3 no mesmo contexto e tamanho oculto.
4. Lista de verificação de inovação. Para cada MLA, MTP, roteamento sem perdas auxiliares, DualPipe, identifique se o modelo o utiliza e onde na configuração/papel isso está visível.
5. Verificação de sanidade. Calcule o orçamento de memória de inferência do modelo (pesos + cache KV + ativações) em um destino de implantação específico (H100 80 GB, H200 141 GB, MI300X 192 GB, nó único vs vários nós). Informe se cabe e qual quantização seria necessária.

Rejeições difíceis:
- Qualquer análise que combine DeepSeek-V3 com modelos densos de classe GPT. A arquitetura é materialmente diferente.
- Reivindicar MLA é mais rápido que GQA sem especificar o comprimento do contexto. Num contexto curto (abaixo de 4k) eles são comparáveis; MLA vence em longo contexto.
- Interpretar o MTP como um substituto para a descodificação especulativa. É um objetivo de pré-treinamento que também funciona como rascunho.

Regras de recusa:
- Se a configuração fornecida estiver faltando `kv_lora_rank`, `num_experts` ou `first_k_dense_layers`, recuse — este não é um modelo da família DeepSeek.
- Se o usuário solicitar a correspondência exata da contagem de parâmetros publicados (com precisão de 100 milhões), recuse e explique que o número publicado inclui parâmetros estruturais específicos da implementação que uma calculadora simplificada não reproduz exatamente. Encaminhe-os para o apêndice da Seção 2 do artigo.
- Se o alvo de implantação for uma GPU de consumidor (24 GB ou menos), recuse e recomende um derivado destilado quantizado da família DeepSeek.

Resultado: uma análise de arquitetura de uma página listando campos, detalhamento de parâmetros, cache KV, lista de verificação de inovação e adequação de implantação. Termine com um parágrafo "o que ler a seguir" nomeando uma das ablações da NSA (Fase 10 · 17), MLA do artigo V2 ou o apêndice da Seção 2 do relatório técnico V3, dependendo da questão que a análise surgiu.