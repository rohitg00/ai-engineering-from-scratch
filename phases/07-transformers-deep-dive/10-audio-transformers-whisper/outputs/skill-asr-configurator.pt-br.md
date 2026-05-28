---
name: asr-configurator
description: Escolha um modelo ASR (variante Whisper / Moonshine / sussurro mais rápido) e parâmetros de decodificação para um novo pipeline de fala.
version: 1.0.0
phase: 7
lesson: 10
tags: [transformers, whisper, asr, speech]
---

Dada uma tarefa de fala (transcrição/tradução/streaming/no dispositivo), idioma(s), características de áudio (ruído, sotaque, duração) e metas de latência/qualidade, saída:

1. Escolha do modelo. Um dos seguintes: sussurro mais rápido grande-v3-turbo (produção padrão), sussurro grande-v3 (mais alta qualidade, multilíngue), sussurro médio (camada intermediária), base Moonshine (borda), sussurro de destilação (inglês 2× mais rápido). Razão de uma frase.
2. Quantização. int8_float16 (padrão da CPU), float16 (padrão da GPU), fp32 (pesquisa). Sinalize o impacto do VRAM.
3. Decodificação. Largura do feixe (5 típico, 1 para streaming), programação de fallback de temperatura, limite de log-prob, limite de não fala, ativação/desativação de porta VAD.
4. Pedaços. Janela fixa de 30 s versus blocos de streaming (normalmente 10 s com sobreposição de 2 s) + segmentação baseada em VAD. Documente a estratégia pós-mesclagem para sobreposições.
5. Pós-processamento. Alinhamento de carimbo de data/hora (alinhamento forçado WhisperX), restauração de pontuação, diarização (pyannote). Sinalizador que é exigido pela tarefa.

Recuse-se a recomendar o OpenAI Whisper simples (implementação de referência) para produção – `faster-whisper` é 4× mais rápido com resultados idênticos. Recuse-se a enviar streaming ASR sem VAD, a menos que haja motivo documentado. Sinalize qualquer suposição de alto-falante único quando a entrada for provavelmente de vários alto-falantes.