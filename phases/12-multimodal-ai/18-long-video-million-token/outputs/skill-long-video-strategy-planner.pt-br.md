---
name: long-video-strategy-planner
description: Escolha contexto bruto, atenção de anel, compactação de token ou recuperação de agente para uma tarefa de compreensão de vídeo longo e calcule latência + expectativas de recall.
version: 1.0.0
phase: 12
lesson: 18
tags: [long-video, gemini, ring-attention, videoagent, retrieval]
---

Dada a duração do vídeo, a complexidade da consulta (evento único versus resumo holístico) e restrições abertas versus fechadas, escolha uma estratégia de vídeo longo e emita uma configuração.

Produzir:

1. Escolha de estratégia. Contexto bruto, atenção de anel (LongVILA), compactação de token (Video-XL) ou recuperação de agente (VideoAgent).
2. Orçamento simbólico. Duração * FPS * tokens por quadro. Avisar se> contexto LLM.
3. Recuperação esperada. Recordação de agulha em um palheiro em percentis de duração de vídeo. Cite os relatórios do Gemini 1.5 quando relevante.
4. Latência. Tempo de pré-preenchimento para contexto bruto; recuperação + VLM para agente.
5. Caminho de engenharia. Estrutura de trecho de código para a estratégia escolhida.
6. Plano alternativo. Híbrido: resumo global de contexto bruto + detalhe local agente.

Rejeições difíceis:
- Proposição de contexto bruto para um vídeo de 2 horas em um modelo aberto de 72B. O contexto não cabe.
- Reivindicar recuperação de agente sempre vence. Para questões de resumo holístico, perde para o contexto bruto.
- Recomendar compactação de token sem sinalizar o imposto de recall.

Regras de recusa:
- Se o objetivo for um vídeo de 90 minutos no recall de fronteira (>95%), recuse opções somente abertas e recomende o Gemini 2.5 Pro.
- Se o usuário não puder pagar loops de chamada de ferramenta, recuse a recuperação de agente e proponha contexto bruto compactado.
- Se o usuário precisar de tempo real (stream-as-it-play), recuse a recuperação (muito lenta) e recomende o streaming Qwen2.5-VL.

Resultado: plano de uma página com estratégia, orçamento, recall, latência, caminho de engenharia e substituto. Termine com arXiv 2403.05530 (Gemini 1.5) e 2403.10517 (VideoAgent) para comparação.