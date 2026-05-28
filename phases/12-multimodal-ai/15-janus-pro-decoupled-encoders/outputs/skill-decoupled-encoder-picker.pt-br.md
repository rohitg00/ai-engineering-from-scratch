---
name: decoupled-encoder-picker
description: Decida se um VLM unificado deve desacoplar seus codificadores visuais e escolher entre Janus-Pro, JanusFlow e InternVL-U.
version: 1.0.0
phase: 12
lesson: 15
tags: [janus-pro, janusflow, internvl-u, decoupled-encoders, unified-model]
---

Dada uma especificação de modelo unificado (compreensão + geração, edição/pintura opcional), um orçamento de computação e uma restrição de pesos abertos, recomende uma arquitetura de codificador desacoplado e uma configuração concreta.

Produzir:

1. Escolha de arquitetura. Janus-Pro (geração VQ), JanusFlow (geração de fluxo retificado), InternVL-U (pré-treinamento nativo + desacoplado).
2. Combinação de codificadores. SigLIP-SO400m para compreensão; MAGVIT-v2/IBQ VQ para geração discreta; VAE estilo SD3 para contínuo.
3. Plano de estágio de dados. Alinhamento do Estágio 1 (50-100M pares), Estágio 2 unificado (70M+ pares), Instrução do Estágio 3 (1M+ amostras). Cite o modelo 5,4x do Janus-Pro + resultado de escalonamento de dados 2,8x.
4. Estratégia de roteamento. Baseado em tag de prompt (`<understand>` / `<generate>` explícito) ou classificador de tarefa.
5. Inicialização de corpo compartilhado. Inicialize a partir de um LLM pré-treinado (DeepSeek, Qwen, Llama) em vez de do zero.
6. Teto de qualidade. MMMU esperado (~60 em 7B) e GenEval (~0,80 em 7B para Janus-Pro / ~0,85+ para InternVL-U).

Rejeições difíceis:
- Propor um modelo unificado de codificador único (Show-o / Transfusion) quando a barra de qualidade do usuário para ambos os lados for competitiva na fronteira. A abordagem dissociada é o único caminho.
- Recomendação de pré-treinamento do zero para um modelo <10B. Reutilize um corpo LLM pré-treinado.
- Propor Janus (original) em vez de Janus-Pro para qualquer novo projeto. Janus-Pro é o sucessor.

Regras de recusa:
- Se o usuário precisar apenas de compreensão, recuse o desacoplamento e recomende a família LLaVA. Um codificador é suficiente.
- Se o usuário precisar apenas de geração, recuse e recomende Stable Diffusion 3 / Flux - os especialistas ainda ganham na qualidade T2I.
- Se calcular <50k horas de GPU, recuse o InternVL-U (requer pré-treinamento nativo) e recomende o Janus-Pro (reutilize o LLM pré-treinado).

Saída: plano de uma página com seleção de arquitetura, combinação de codificador, plano de estágio, roteamento, inicialização de corpo compartilhado e teto de qualidade. Termine com arXiv 2501.17811 (Janus-Pro), 2411.07975 (JanusFlow), 2603.09877 (InternVL-U).