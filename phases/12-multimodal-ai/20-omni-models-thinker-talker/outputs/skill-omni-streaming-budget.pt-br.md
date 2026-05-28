---
name: omni-streaming-budget
description: Dimensione um pipeline de streaming de voz Thinker-Talker (Qwen-Omni/Moshi/Mini-Omni) para um TTFAB alvo e conjunto de recursos.
version: 1.0.0
phase: 12
lesson: 20
tags: [qwen-omni, moshi, mini-omni, streaming, ttfab, thinker-talker]
---

Dada uma especificação de produto de voz em primeiro lugar (TTFAB alvo, taxa de amostragem de microfone, visão em sim/não, bilíngue, full-duplex) e uma restrição de computação (classe de GPU, orçamento), dimensione o pipeline Thinker-Talker.

Produzir:

1. Escolha modelo de família. Moshi (melhor latência), Qwen2.5-Omni (melhores recursos abertos), Qwen3-Omni (qualidade de fronteira), Mini-Omni (mais simples).
2. Tamanhos do Pensador e do Falador. Pensador 7B + locutor 200-300M para <400ms TTFAB. 70B+ Pensador de qualidade, aceita TTFAB superior.
3. Análise do TTFAB. Estimativa de latência componente por componente.
4. Modo duplex. Half-duplex com tomada de turno VAD como padrão; full-duplex se o produto exigir backchannel.
5. Integração da visão. TMRoPE com carimbos de data/hora absolutos para quadros de vídeo intercalados.
6. Forma de implantação. GPU única versus divisão (Thinker em A, Talker em B) com base nas necessidades de taxa de transferência.

Rejeições difíceis:
- Propondo o locutor 70B. O locutor deve ser pequeno para acompanhar a taxa do token de fala.
- Usando decodificador de fala sem streaming. TTFAB explode.
- Reivindicar full-duplex é plug-and-play. Requer dados de treinamento especializados.

Regras de recusa:
- Se o alvo TTFAB for <200ms, recuse qualquer coisa maior que a classe Moshi (7B fundido) em um único A100.
- Se o produto exigir geração de música in-stream, recuse esta arquitetura e recomende um canal de música separado.
- Se a taxa de amostragem do microfone for 48kHz com qualidade rigorosa, sinalize a necessidade de um codificador de fala mais forte; não reduza a resolução cegamente.

Resultado: plano de streaming de uma página com escolha de modelo, tamanhos, detalhamento do TTFAB, modo duplex, estratégia de visão, implantação. Termine com arXiv 2503.20215 (Qwen2.5-Omni), 2410.00037 (Moshi).