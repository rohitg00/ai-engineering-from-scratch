---
name: alm-picker
description: Escolha um modelo de linguagem de áudio, subconjunto de benchmark, modalidade de saída (texto versus fala) e proteções para uma tarefa de compreensão de áudio.
version: 1.0.0
phase: 6
lesson: 10
tags: [alm, lalm, qwen-omni, audio-flamingo, gemini-audio, mmau]
---

Dada a tarefa (fala/som/música/multi-áudio/áudio longo, modalidade de saída, latência, licença), saída:

1. Modelo. Qwen2.5-Omni-7B · Qwen3-Omni · SALMONN · Áudio Flamingo 3 · AF-Next · LTU · GAMA · Gemini 2.5 Pro (API) · Áudio GPT-4o (API). Razão de uma frase.
2. Subconjunto de referência para validar. Fala / som / música / multi-áudio MMAU-Pro · LongAudioBench · AudioCaps · ClothoAQA. Escolha o eixo que corresponde à tarefa do usuário.
3. Modalidade de saída. Somente texto · texto + fala (Qwen-Omni, GPT-4o Audio). Faça um orçamento para um decodificador de voz adicional, se necessário.
4. Guarda-corpos. Rejeite prompts que exijam comparação de vários áudios quando a pontuação de vários áudios do seu modelo for &lt; 30% (quase aleatório). Diarize antes do LALM para &gt; Entradas de 10 minutos.
5. Escalada. Quando esta tarefa deve recorrer a um modelo especializado - Whisper para transcrição, BEATs para classificação, pyannote para diarização. LALM não é o melhor de cada um.

Recuse-se a enviar tarefas de comparação de vários áudios sem verificar as pontuações do seu modelo &gt; 40% no subconjunto multiáudio MMAU-Pro. Recuse áudio longo (&gt; 10 min) sem diarização upstream. Sinalize qualquer implantação que use números informados pelo fornecedor sem nova verificação independente.

Entrada de exemplo: "Auditoria de conformidade: transcrever gravações de chamadas bancárias de 10 minutos + detectar se o agente leu a divulgação obrigatória."

Exemplo de saída:
- Modelo: Whisper-large-v3-turbo para transcrição + Gemini 2.5 Pro (via API) para verificação de divulgação de controle de qualidade sobre a transcrição. LALM direto em áudio bruto é tentador, mas a precisão do LALM de áudio longo cai além de 10 minutos.
- Subconjunto de referência: subconjunto de fala MMAU-Pro (Gemini 2.5 Pro = 73,4%) — cobre o eixo fala-raciocínio. Verifique também seu próprio conjunto de ouro de 50 chamadas.
- Modalidade de saída: somente texto. A saída de fala não é necessária para um relatório de auditoria.
- Guardrails: diarize com pyannote 3.1 primeiro; enviar segmentos por alto-falante separadamente; registrar pontuação de confiança por chamada.
- Escalação: se uma chamada falhar na verificação de divulgação, encaminhe para o revisor humano em vez do sinalizador autônomo.