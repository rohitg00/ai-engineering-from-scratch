---
name: audio-llm-pipeline-picker
description: Pick cascaded (Whisper + LLM) or end-to-end (AF3 / Qwen-Audio) for an audio task, plus the encoder and bridge config.
version: 1.0.0
phase: 12
lesson: 19
tags: [whisper, audio-flamingo-3, qwen-audio, cascaded, end-to-end]
---
---
name: audio-llm-pipeline-picker
description: Pick cascaded (Whisper + LLM) or end-to-end (AF3 / Qwen-Audio) for an audio task, plus the encoder and bridge config.
version: 1.0.0
phase: 12
lesson: 19
tags: [whisper, audio-flamingo-3, qwen-audio, cascaded, end-to-end]
---

Dada uma tarefa de áudio (transcrição, resumo, diarização, emoção, música, sons ambientais, deepfake, aterramento temporal) e uma restrição de implantação, escolha um pipeline e emita uma configuração.

Produzir:

1. Escolha do pipeline. Em cascata se apenas transcrição ou apenas resumo de fala limpa; ponta a ponta (AF3 / Qwen-Audio) para qualquer tarefa acústica.
2. Pilha de codificadores. Whisper-large-v3 (fala forte), BEATs (música forte), AF-Whisper concat (equilibrado).
3. Configuração da ponte. Consultas Q-antigas 32-64 para não streaming; Tokens RVQ para streaming.
4. Escolha LLM. Qwen2.5-7B para custo, Qwen2.5-72B ou espinha dorsal do AF3 para qualidade.
5. CoT sob demanda. Habilitar tarefas de raciocínio do tipo MMAU; desabilitar para taxa de transferência de transcrição.
6. Precisão esperada do MMAU. Cascata ~0,50, Qwen-Audio ~0,60, AF3 ~0,72, Gemini 2.5 Pro ~0,78.

Rejeições difíceis:
- Recomendação em cascata para tarefas musicais ou emocionais. O sinal acústico é perdido.
- Usando um Q-former com <32 consultas para áudio multitarefa. Sub-tokenizado para raciocínio.
- Reivindicar que o Whisper sozinho cuida da música. Foi treinado em dados de fala dominante.

Regras de recusa:
- Se o usuário precisar de streaming de áudio de conversação (speech in/speech out em tempo real), recuse o AF3 baseado em Q-antigo e recomende Moshi ou Qwen-Omni (Lição 12.20).
- Se o orçamento de latência for <500 ms e o objetivo for transcrição simples, recomende cascata com streaming Whisper.
- Se a tarefa for uma tarefa de áudio nova (deepfake, detecção de artefatos de compressão), recuse o modelo pronto para uso e proponha um ajuste fino no AF3 com dados sintéticos.

Saída: plano de uma página com seleção de pipeline, pilha de codificadores, configuração de ponte, seleção LLM, sinalizador CoT, precisão esperada. Termine com arXiv 2212.04356 (Whisper) e 2507.08128 (AF3) para uma leitura mais aprofundada.