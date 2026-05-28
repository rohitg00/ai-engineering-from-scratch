---
name: duplex-pipeline
description: Escolha a arquitetura full-duplex (Moshi) versus pipeline (VAD + STT + LLM + TTS) para uma carga de trabalho de agente de voz.
version: 1.0.0
phase: 6
lesson: 15
tags: [moshi, hibiki, full-duplex, voice-agent, streaming]
---

Dada a carga de trabalho (meta de latência, necessidades de chamada de ferramentas, cobertura de idioma, orçamento de hardware, nuvem versus borda), resultado:

1. Arquitetura. Full-duplex (Moshi / GPT-4o Realtime / Gemini Live) vs pipeline (LiveKit + STT + LLM + TTS, Lição 12). Razão de uma frase.
2. Modelo. Moshi · Hibiki · Hibiki-Zero · Sesame CSM · GPT-4o Realtime · Gemini 2.5 Live · pipeline tradicional. Razão.
3. Escala. Custo de GPU por sessão (Moshi ocupa um slot), máximo de sessões simultâneas, impacto de inicialização a frio.
4. Caminho de chamada de ferramenta. Se necessário — pipeline híbrido (duplex + LLM externo para chamadas de ferramentas) ou pipeline puro. Explique a compensação.
5. Cobertura linguística. Os modelos full-duplex têm suporte restrito a idiomas; pipelines herdam a capacidade multilíngue do LLM.

Recuse a arquitetura full-duplex apenas para agentes corporativos que precisam de chamada/recuperação de ferramentas — Moshi é um modelo de diálogo, não uma estrutura de agente. Recuse apenas pipeline para agentes conversacionais com menos de 250 ms – os estágios se somam. Recuse Moshi por &gt; 4 sessões simultâneas em uma GPU – atinge a contenção.

Entrada de exemplo: "Acompanhante de voz para aprendizagem de idiomas - prática de fluência de conversação. Inglês + francês. Capacidade de resposta <250 ms. 10 mil atividades diárias."

Exemplo de saída:
- Arquitetura: full-duplex (Moshi). O requisito de latência abaixo de 250 ms + fluência de conversação atende aos pontos fortes de Moshi.
- Modelo: Moshi. EN + FR ambos bem suportados. Licença CC-BY 4.0.
- Escala: uma GPU L4 por 4-6 sessões simultâneas → ~1.500 GPUs no pico para 10k DAU com 10% de simultaneidade. Planeje o modo de luz no dispositivo usando Kyutai Pocket TTS + Whisper local para um caminho silencioso.
- Chamada de ferramenta: mínimo - "revelar dica gramatical" e "traduzir esta frase" podem ser roteados por meio de um pequeno sidecar LLM; a maior parte da interação é um diálogo aberto onde Moshi brilha.
- Cobertura linguística: EN + FR (nativo); ES / DE / JP via adaptação Hibiki-Zero (1000 h de áudio necessárias por novo idioma).