# Modelos de Língua de Áudio: o sussurro para Áudio Flamingo 3 Arc

> Whisper (Radford et al., dezembro de 2022) resolveu o reconhecimento de fala  680k horas de fala multilingue deficiente, um simples transformador de codificador-decodificador, um ponto de referência que fez com que cada versão subsequente da ASR o citasse. Mas reconhecer não é raciocínio. Perguntar "que instrumentos estão nesta gravação" ou "que emoção o orador está expressando" ou "o que aconteceu no minuto 3" requer entendimento de áudio, não transcrição. Qwen-Audio, SALMONN, LTU e o Audio Flamingo 3 da NVIDIA (AF3, julho 2025) construíram progressivamente essa pilha: manter os codificadores da classe Whisper, ligar os Q-formadores, treinar dados de instrução de texto de áudio, adicionar raciocínio de cadeia de pensamento. Esta lição vai no arco.

**Type:** Build
**Languages:** Python (stdlib, log-Mel spectrogram + audio Q-former skeleton), TypeScript
**Prerequisites:** Phase 6 (Speech and Audio), Phase 12 · 03 (Q-Former)
**Time:** ~180 minutes

## Objetivos de aprendizagem

- Compute um espectrograma log-Mel a partir de uma forma de onda: ventana, FFT, bancos de filtros, transformação de log.
- Compare as opções de codificadores: Whisper encoder, BEATs, AF-Whisper híbrido.
- Construa um formato de áudio Q: N consulta aprendizagem atendendo aos patches do espectrograma.
- Explique a formação em cascata (Whisper-then-LLM) versus end-to-end audio-LLM: por que a escala end-to-end é melhor para o raciocínio.

## O problema

O reconhecimento de fala foi resolvido por Whisper. O OCR de áudio é uma mercadoria. Mas " mercadoria " pára na transcrição. Se o modelo não consegue raciocinar sobre o que ouviu  tempo, alto-falantes, emoção, estrutura musical, sons ambientais  transcrição sozinha não pode impulsionar as características do produto.

Três rotas óbvias:

1. Cascade: Whisper transcribe, LLM argumenta sobre a transcrição. Funciona para cenários de fala pura. Falha para música, áudio ambiental, superposição de multi-falantes, emoção.

2. End-to-end audio-LLM: um codificador de áudio alimenta tokens de áudio diretamente em um LLM, ignorando a transcrição. Preserva informações acústicas (emoção, alto-falante, ambiente). Necessita de novos dados de treinamento.

3. Híbrido: codificador de áudio + decodificador de texto que pode transcrever e raciocinar.

## O conceito

### Espectograma log-Mel: a função de entrada

Cada codificador de áudio começa com a mesma característica: um espectrograma log-Mel.

1. Re-estampagem a 16 kHz.
2. Transformação Fourier de curto prazo com janelas de 25 ms, salto de 10 ms.
3. Tomar a magnitude do resultado da FFT.
4. Aplicar bancos de filtros Mel (normalmente 80 filtros com espaço de registro de 0-8000 Hz) para distorcer a frequência perceptiva.
5. Compressão de tronco$(\log(1 + x))$para o alcance dinâmico.

Resultado: uma matriz 2D de forma (T, 80) onde T é o número de quadros de tempo. Para um clip de 30 segundos a frequência de quadros de 100 Hz: (3000, 80).

### O codificador do sussurro

O codificador do Whisper é um transformador de estilo ViT de 12 camadas que processa o espectrograma log-Mel como uma sequência de quadros de tempo.

Para ASR, o decodificador do Whisper é um transformador de atenção cruzada que gera tokens de texto condicionados à saída do encodificador.

Para ALMs (audio-LLMs), você quer a saída do codificador como entrada para um LLM diferente. O padrão: Whisper encoder congelado, Q-former treinable, LLM congelado ou sintonizado.

### Codificadores de áudio específicos

O Whisper foi treinado com dados dominantes da fala. É mais fraco para música e áudio ambiental.

O BEATs (Chen et al., 2022) é um transformador auto-supervisionado treinado no AudioSet. Captura música e sons ambientais melhor do que o Whisper no mesmo número de parâmetros.

AF-Whisper (encoder de Áudio Flamingo 3): comece com o encoder Whisper-large-v3 e continue treinando-o em voz, som e música juntos, de modo que um encoder carrega tanto o sinal linguístico quanto o acústico. Sistemas anteriores como SALMONN obtiveram a mesma cobertura por concatenar características de Whisper e BEAT.

### Audio Q-former

O mesmo padrão que o visual Q-former do BLIP-2. um número fixo de consultas aprendíveis (muitas vezes 32 ou 64) atender cruzada sobre os quadros de saída do codificador de áudio. As consultas se tornam tokens de áudio consumidos pelo LLM.

Estágio de alinhamento de formação: Q-former sozinho, perdas contraditórias + de legendas em pares de texto e áudio (AudioCaps, Clotho).

### O arco  SALMONN, Qwen-Audio, AF3

SALMONN (Tang et al., 2023): Whisper + BEATs + Q-former + LLaMA. O primeiro LLM de áudio aberto com capacidade de raciocínio sério.

Qwen-Audio (Chu et al., 2023): arquitetura similar, treinada em um conjunto de dados mais rico, sintonizada para diálogo de várias voltas. MMAU ~ 0,60.

LTU  Ouça, pense, compreenda (Gong et al., 2023): dados de raciocínio explícito, foque na cadeia de pensamento em cima de clips de áudio.

Audio Flamingo 3 (Goel et al., julho 2025): a atual SOTA aberta. 7B LLM backbone (Qwen2.5-7B), um codificador de áudio AF-Whisper construído a partir de Whisper-large-v3, pequenas camadas de adaptador no LLM, treinamento em pares de instrução de áudio-texto 1M +. MMAU 0.72, combina com a fronteira proprietária em algumas sub-tarefas.

AF3 também introduz uma cadeia de pensamento sob demanda para áudio: o modelo pode emitir tokens de pensamento opcionalmente ("deixe-me identificar os instrumentos primeiro: ...") antes da resposta final.

### Cascada vs end-to-end

Tubos em cascata:

1. Whisper transcreve áudio → texto.
2. - O LLM é por texto.

Funciona perfeitamente para "resumir este podcast". Falha para:
- "Qual é o humor desta música?"  O humor está no som, não nas palavras.
- "Quem está falando, Alice ou Bob?"  requer identificação do orador.
- "Em que segundo acontece a explosão?" "A terra temporal perdida no texto".
- "É real ou gerado áudio?"  Detecção de deepfake precisa de recursos acústicos.

Qwen-Audio e AF3 lidam com música, ambiente e emoção de forma nativa.

### 2026 receita de produção

Para um novo produto de audiovisão:

- Cascada se: transcrição é o objetivo, sem música, sem inferência emocional.
- AF3 / Qwen-Audio-família se: música, emoção, multi-falantes ou raciocínio de áudio complexo.

Cascada é mais barata e simples.

### MMAU  o critério de referência de raciocínio de áudio

MMAU (Massive Multimodal Audio Understanding) é o padrão de referência de raciocínio de áudio 2024-2025.

- 10.000 pares de QA de texto de áudio através da fala, música, sons ambientais.
- Abrange classificação, raciocínio temporal, raciocínio causal, QA aberto.
- Teste o que os oleodutos em cascata sistematicamente perdem.

O SOTA aberto (AF3) em 0,72; fronteira proprietária ~ 0,78 (Gemini 2.5 Pro, Claude Opus 4.7).

```figure
audio-text-ctc
```

## Usá-lo

`code/main.py`- Não .

- Implementa o cálculo de espectrograma log-Mel em stdlib: windowswing, naívo DFT, Mel filter-bank.
- O esqueleto de áudio Q-ex: dados quadros de saída do codificador, computa Q, K, V, atenção e emite tokens N.
- Comparar cascada contra extremo a extremo numa tarefa de brinquedo.

## Envia-o

Esta lição produz`outputs/skill-audio-llm-pipeline-picker.md`. Dada uma tarefa de áudio (transcrição, etiquetado musical, inferência de emoção, diarização de alto-falantes, classificação do ambiente), ele escolhe a AF3 em cascata, de ponta a ponta ou um híbrido.

## Exercícios

1. Calcule a dimensão do espectrograma log-Mel para um clip de 30 segundos em 16kHz, 25ms janela, 10ms saltar, 80 Mel canhões.

2. Por que o Whisper tem um desempenho inferior na música?

3. Audio Q-former com 64 consultas vs 32: em que tarefa complexa 64 paga? 32 salvar computação para quê?

4. Leia a secção 4 do AF3 sobre pensamento sob demanda. Propõe três tarefas de áudio em que a cadeia de pensamento ajuda mais.

5. Implementar um canal de diarização mínimo usando a saída do AF3.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Log-Mel spectrogram | "Mel features" | 2D (time, frequency) array of log-magnitude values after Mel filter banks |
| Audio Q-former | "Audio Perceiver" | Cross-attention bottleneck from audio encoder output to fixed-length queries feeding the LLM |
| Cascaded | "ASR-then-LLM" | Pipeline where Whisper transcribes and a text LLM reasons; loses acoustic information |
| End-to-end | "Audio-LLM" | Audio features enter the LLM directly via Q-former; preserves acoustic signal |
| BEATs | "Audio AudioSet encoder" | SSL transformer trained on AudioSet; strong on music + environmental sounds |
| MMAU | "Audio reasoning bench" | 10k QA pairs across speech, music, environment; 2024 eval standard |
| On-demand thinking | "Audio CoT" | Model can optionally emit reasoning tokens before final answer, lifts accuracy 3-5 pts |

## Mais leitura

- [Radford et al. — Whisper (arXiv:2212.04356)](https://arxiv.org/abs/2212.04356)
- [Chu et al. — Qwen-Audio (arXiv:2311.07919)](https://arxiv.org/abs/2311.07919)
- [Goel et al. — Audio Flamingo 3 (arXiv:2507.08128)](https://arxiv.org/abs/2507.08128)
- [Tang et al. — SALMONN (arXiv:2310.13289)](https://arxiv.org/abs/2310.13289)
- [Gong et al. — LTU (arXiv:2305.10790)](https://arxiv.org/abs/2305.10790)
