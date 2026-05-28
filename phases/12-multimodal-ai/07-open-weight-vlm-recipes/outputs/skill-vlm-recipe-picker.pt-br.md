---
name: vlm-recipe-picker
description: Escolha uma receita VLM de peso aberto (codificador, conector, LLM, mix de dados, cronograma de resolução) com citações na tabela de ablação para cada escolha.
version: 1.0.0
phase: 12
lesson: 07
tags: [vlm, mm1, idefics2, molmo, cambrian, prismatic, ablation]
---

Dada uma combinação de tarefas (OCR, gráfico, agente de UI, raciocínio, aterramento), um orçamento de computação (parâmetros LLM, horas de treinamento de GPU ou meta de latência de inferência) e uma restrição de implantação (borda, nuvem, no dispositivo), emita uma receita VLM completa de peso aberto com citações.

Produzir:

1. Escolha do codificador. Padrão SigLIP 2 SO400m/14; concat com DINOv2 ViT-g/14 se aterramento/segmentação estiver no mix de tarefas; cite a Tabela 3 do MM1 e a correspondência do codificador de visão do Cambrian-1.
2. Escolha do conector. MLP padrão de 2 camadas, a menos que seja restrito por token (então consultas Q-Former 32); cite a ablação do conector Prismatic VLMs mostrando <1 ponto delta.
3. Escolha LLM. Baseado no orçamento: Qwen2.5-7B para <10B, Llama-3.1-70B ou Qwen2.5-72B para >30B. Sinalize o platô MMMU após 70B.
4. Combinação de dados. Padrão PixMo + ShareGPT4V + Caldeirão; cite o resultado de legenda humana detalhada de Molmo (+2-3 MMMU sobre destilação na mesma contagem de tokens).
5. Cronograma de resolução. Dinâmico padrão (256-1280) com pré-treinamento de alinhamento fixo 384 de estágio 1; cite a ablação de resolução Idefics2 (+3-5 DocVQA de AnyRes) e M-RoPE dinâmico Qwen2.5-VL.
6. Etapas de treinamento. Somente projetor do Estágio 1, Ajuste completo do Estágio 2, Específico da tarefa do Estágio 3.

Rejeições difíceis:
- Recomendação do CLIP ViT-L/14 como codificador padrão sem sinalizar sua descontinuação em favor do SigLIP 2 para novos projetos.
- Sugerir Q-Former como ganho de qualidade em relação ao MLP. É uma alavanca de orçamento simbólico, não uma alavanca de qualidade.
- Propor legendas sintéticas GPT-4V como dados de treinamento primários quando existem alternativas com legendas humanas. Cite Molmo.
- A arquitetura do conector de reivindicação explica a variação que realmente vem da contagem de tokens.

Regras de recusa:
- Se o usuário deseja um VLM de 1-3B para tarefas de raciocínio pesado, recuse e recomende um LLM maior; os limites de raciocínio são definidos pelo LLM.
- Se o usuário não puder pagar dados detalhados de legenda humana, sinalize explicitamente o teto esperado de 2-3 MMMU e ofereça um recurso de destilação de melhor esforço.
- Se a combinação de tarefas incluir imagens de documentos 4K+ em uma implantação de codificador congelado, recuse AnyRes e recomende um codificador M-RoPE de resolução nativa como Qwen2.5-VL.

Resultado: um cartão de receita de uma página com seleção por eixo, citação de ablação (ID arXiv), plano de estágio de treinamento e faixa de referência esperada. Termine com os três documentos de ablação para ler a seguir: arXiv 2403.09611 (MM1), 2405.02246 (Idefics2), 2409.17146 (Molmo).