---
name: video-vlm-frame-planner
description: Planeje a amostragem de quadros, o pool por quadro, o formato de saída e os alvos de benchmark para uma implantação de modelo de linguagem de vídeo.
version: 1.0.0
phase: 12
lesson: 17
tags: [video-vlm, temporal-grounding, tmrope, dynamic-fps, benchmarks]
---

Dada uma tarefa de vídeo (reconhecimento de ação, aterramento temporal, resumo, monitoramento, reprodução do fluxo de trabalho do agente) e uma restrição de implantação (contexto do modelo, orçamento de latência, taxa de transferência), emita uma amostragem de quadros e um plano de saída.

Produzir:

1. Escolha do amostrador de quadros. Uniforme para conteúdo estável, FPS dinâmico para movimentos mistos, orientado a eventos para muita ação, quadro-chave + contexto para cinematográfico.
2. Pool por quadro. 2x2 para alto nível de detalhes, 3x3 padrão, 4x4 ou 6x6 para fluxos de trabalho de agentes onde a densidade do conteúdo é menos importante do que a cobertura.
3. Codificação temporal. TMRoPE para família Qwen2.5-VL; incorporação temporal aprendida para modelos menores; nenhuma codificação para tarefas de clipe único.
4. Formato de saída. JSON com `{event, start, end, confidence}` para aterramento; texto livre para sumarização; delimitado por token para fluxos mistos.
5. Plano de referência. VideoMME para geral, TempCompass para aterramento, EgoSchema para horizonte longo. Especifique o nível de precisão esperado.
6. Orçamento de contexto/latência. Total de tokens = duração * fps * tokens_per_frame. Avisar se ultrapassar 40% do contexto.

Rejeições difíceis:
- Propor amostragem uniforme para vídeos com muita ação. Perde eventos de pico.
- A reivindicação de saída delimitada por token corresponde à precisão do JSON para análise downstream. JSON é mais robusto.
- Recomendação do Video-LLaMA para qualquer projeto a partir de 2026. Arquiteturas mais antigas não são mais competitivas.

Regras de recusa:
- Se duração > 10 minutos e contexto < 32k, recuse e recomende resumo hierárquico ou recuperação agente (Lição 12.18).
- Se a precisão do alvo for limite (dentro de 2 pontos do Gemini 2.5 Pro no VideoMME), recuse modelos 7B abertos e exija 32B+ ou proprietários.
- Se a meta de FPS dinâmico > 8 em um clipe > 30s a 7B, recuse a latência e recomende um limite inferior.

Saída: plano de quadro de uma página com amostrador, pooling, codificação temporal, formato de saída, alvos de benchmark, estimativa de contexto. Termine com arXiv 2502.13923 (Qwen2.5-VL) e 2306.02858 (Video-LLaMA) para leitura comparativa.