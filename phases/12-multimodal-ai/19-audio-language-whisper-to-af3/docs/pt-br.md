# Modelos de Áudio-Linguagem: o Arco do Whisper ao Audio Flamingo 3

> O Whisper (Radford et al., dezembro de 2022) resolveu reconhecimento de fala — 680 mil horas de fala multilíngue fracamente supervisionada, um transformer encoder-decoder simples, um benchmark que fez toda publicação subsequente de ASR citá-lo. Mas reconhecimento não é raciocínio. Perguntar "quais instrumentos tem nessa gravação" ou "que emoção o falante está expressando" ou "o que aconteceu no minuto 3" exige compreensão de áudio, não transcrição. Qwen-Audio, SALMONN, LTU e o Audio Flamingo 3 da NVIDIA (AF3, julho de 2025) construíram progressivamente essa stack: mantiveram encoders de classe Whisper, encaixaram Q-formers, treinaram em dados de instrução de texto-áudio, adicionaram raciocínio com chain-of-thought. Esta aula percorre o arco.

**Tipo:** Construção
**Linguagens:** Python (stdlib, eespecificaçãotrograma log-Mel + esqueleto de Q-former de áudio)
**Pré-requisitos:** Fase 6 (Fala e Áudio), Fase 12 · 03 (Q-Former)
**Tempo:** ~180 minutos

## Objetivos de Aprendizado

- Computar um eespecificaçãotrograma log-Mel a partir de uma forma de onda: janelamento, FFT, bancos de filtros, transformação logarítmica.
- Comparar opções de encoder: encoder Whisper, BEATs, híbrido AF-Whisper. Quando cada um ganha.
- Construir um Q-former de áudio: N queries aprendíveis com cross-attention sobre patches do eespecificaçãotrograma.
- Explicar a diferença entre cascade (Whisper depois LLM) e treinamento de ponta a ponta de áudio-LLM: por que de ponta a ponta escala melhor para raciocínio.

## O Problema

Reconhecimento de fala foi resolvido pelo Whisper. OCR-de-áudio é commodity. Mas "commodity" para na transcrição. Se o modelo não consegue raciocinar sobre o que ouviu — timing, falantes, emoção, estrutura de música, sons ambientais — a transcrição sozinha não sustenta funcionalidades de produto.

Três rotas óbvias:

1. Cascata: Whisper transcreve, LLM raciocina sobre a transcrição. Funciona para cenários de fala pura. Falha para música, áudio ambiental, sobreposição de múltiplos falantes, emoção.

2. Áudio-LLM de ponta a ponta: um encoder de áudio alimenta tokens de áudio diretamente num LLM, pulando a transcrição. Preserva informação acústica (emoção, falante, ambiente). Precisa de novos dados de treinamento.

3. Híbrido: encoder de áudio + decoder de texto que tanto transcreve quanto raciocina. Qwen-Audio e Audio Flamingo escolhem essa rota.

## O Conceito

### Eespecificaçãotrograma log-Mel: a funcionalidade de entrada

Todo encoder de áudio começa com a mesma feature: um eespecificaçãotrograma log-Mel.

1. Resample para 16 kHz.
2. Transformada Fourier de curto prazo com janelas de 25ms, hop de 10ms.
3. Pegar a magnitude do resultado da FFT.
4. Aplicar bancos de filtros Mel (tipicamente 80 filtros com espaçamento logarítmico de 0-8000 Hz) para deformar para frequência perceptual.
5. Compressão logarítmica (log(1 + x)) para faixa dinâmica.

Resultado: um array 2D de shape (T, 80) onde T é o número de frames de tempo. Para um clipe de 30 segundos a 100 Hz de frame rate: (3000, 80).

### O encoder do Whisper

O encoder do Whisper é um transformer estilo ViT com 12 camadas processando o eespecificaçãotrograma log-Mel como sequência de frames de tempo. Saída: um vetor de hidden state por frame de tempo.

Para ASR, o decoder do Whisper é um transformer com cross-attention que gera tokens de texto condicionados na saída do encoder. Encoder-decoder padrão.

Para ALMs (áudio-LLMs), você quer a saída do encoder como entrada de um LLM diferente. O padrão: encoder Whisper congelado, Q-former treinável, LLM congelado ou ajustado.

### BEATs e encoders eespecificaçãoíficos de áudio

O Whisper foi treinado em dados dominados por fala. É mais fraco para música e áudio ambiental.

BEATs (Chen et al., 2022) é um transformer auto-supervisionado treinado no AudioSet. Captura música e sons ambientais melhor que o Whisper com a mesma contagem de parâmetros.

AF-Whisper (o híbrido do Audio Flamingo 3): concatena features do Whisper + BEATs como entrada de áudio. Whisper carrega o sinal linguístico, BEATs carrega o sinal acústico.

### Q-former de áudio

Mesmo padrão do Q-former visual do BLIP-2. Um número fixo de queries aprendíveis (geralmente 32 ou 64) faz cross-attention sobre os frames de saída do encoder de áudio. As queries se tornam tokens de áudio consumidos pelo LLM.

Estágio de alinhamento de treinamento: Q-former sozinho, perdas contrastivas + captioning em pares de texto-áudio (AudioCaps, Clotho). Estágio de instrução: de ponta a ponta, descongelar o LLM, treinar em dados de instrução.

### O arco — SALMONN, Qwen-Audio, AF3

SALMONN (Tang et al., 2023): Whisper + BEATs + Q-former + LLaMA. O primeiro áudio-LLM aberto com capacidade séria de raciocínio. Benchmarks no MMAU mostram ~0.55 composto.

Qwen-Audio (Chu et al., 2023): arquitetura similar, treinado num dataset mais rico, ajustado para diálogo multi-turno. MMAU ~0.60.

LTU — Listen, Think, Understand (Gong et al., 2023): dados de raciocínio explícitos, foco em chain-of-thought sobre clipes de áudio. Menor mas mais focado.

Audio Flamingo 3 (Goel et al., julho de 2025): o SOTA aberto atual. Backbone de LLM de 8B (Qwen2 7B), encoder Whisper-large concatenado com BEATs, Q-former de 64 queries, treinado em mais de 1M pares de instrução de texto-áudio. MMAU 0.72, iguala o proprietário em frente em algumas subtarefas.

AF3 também introduz raciocínio sob demanda para áudio: o modelo pode opcionalmente emitir tokens de raciocínio ("deixe-me primeiro identificar os instrumentos: ...") antes da resposta final. A acurácia em tarefas complexas de raciocínio sobe 3-5 pontos quando o raciocínio é ativado.

### Cascata vs de ponta a ponta

Pipeline em cascata:

1. Whisper transcreve áudio → texto.
2. LLM raciocina sobre o texto.

Funciona perfeitamente para "resumir esse podcast". Falha para:
- "Qual é o humor dessa música?" — o humor está no som, não nas palavras.
- "Quem está falando, Alice ou Bob?" — requer identificação do falante.
- "Em que segundo a explosão acontece?" — fundamentação temporal perdida no texto.
- "Isso é áudio real ou gerado?" — detecção de deepfake precisa de features acústicas.

End-to-end preserva o sinal acústico. Qwen-Audio e AF3 lidam com música, ambiente e emoção nativamente.

### Receita de produção em 2026

Para um novo produto de compreensão de áudio:

- Cascata se: transcrição é o objetivo, sem música, sem inferência de emoção.
- AF3 / família Qwen-Audio se: música, emoção, múltiplos falantes, ou raciocínio complexo de áudio.

Cascata é mais barato e simples. End-to-end é mais capaz.

### MMAU — o benchmark de raciocínio de áudio

MMAU (Massive Multimodal Audio Understanding) é o benchmark de raciocínio de áudio de 2024-2025:

- 10.000 pares de Q&A de texto-áudio cobrindo fala, música, sons ambientais.
- Cobre classificação, raciocínio temporal, raciocínio causal, Q&A aberto.
- Testa o que pipelines em cascata sistematicamente erram.

SOTA aberto (AF3) em 0.72; proprietário na frente ~0.78 (Gemini 2.5 Pro, Claude Opus 4.7). A diferença é menor que o delta aberto-vs-fechado do VideoMME, indicando que áudio-LLMs estão amadurecendo.

## Use

`code/main.py`:

- Implementa cálculo de eespecificaçãotrograma log-Mel em stdlib: janelamento, DFT ingênuo, banco de filtros Mel.
- Esqueleto de Q-former de áudio: dada saída de frames do encoder, computa Q, K, V, attention, e emite N tokens.
- Comparação cascata-vs-de ponta a ponta numa tarefa de exemplo.

## Entregue

Esta aula produz `outputs/skill-audio-llm-pipeline-picker.md`. Dada uma tarefa de áudio (transcrição, tag de música, inferência de emoção, diarização de múltiplos falantes, classificação de ambiente), escolhe cascata, AF3 de ponta a ponta, ou um híbrido.

## Exercícios

1. Compute a dimensão do eespecificaçãotrograma log-Mel para um clipe de 30 segundos a 16kHz, janela de 25ms, hop de 10ms, 80 bins Mel. Como muda a 48kHz?

2. Por que o Whisper tem desempenho inferior em música? Que features acústicas o BEATs captura que o Whisper não captura?

3. Q-former de áudio com 64 queries vs 32: em que complexidade de tarefa 64 compensa? 32 economiza computação para quê?

4. Leia a Seção 4 do AF3 sobre raciocínio sob demanda. Proponha três tarefas de áudio onde chain-of-thought mais ajuda.

5. Implemente um pipeline mínimo de diarização usando a saída do AF3. Como você sinaliza mudanças de falante?

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|------------------------|--------------------------|
| Eespecificaçãotrograma log-Mel | "Features Mel" | Array 2D (tempo, frequência) de valores de magnitude logarítmica após bancos de filtros Mel |
| Q-former de áudio | "Perceiver de áudio" | Gargalo de cross-attention da saída do encoder de áudio para queries de comprimento fixo que alimentam o LLM |
| Cascata | "ASR depois LLM" | Pipeline onde Whisper transcreve e um LLM de texto raciocina; perde informação acústica |
| End-to-end | "Áudio-LLM" | Features de áudio entram no LLM diretamente via Q-former; preserva sinal acústico |
| BEATs | "Encoder AudioSet de áudio" | Transformer SSL treinado no AudioSet; forte em música + sons ambientais |
| MMAU | "Benchmark de raciocínio de áudio" | 10k pares de Q&A cobrindo fala, música, ambiente; padrão de avaliação 2024 |
| Raciocínio sob demanda | "CoT de áudio" | Modelo pode opcionalmente emitir tokens de raciocínio antes da resposta final, eleva acurácia 3-5 pontos |

## Leitura Adicional

- [Radford et al. — Whisper (arXiv:2212.04356)](https://arxiv.org/abs/2212.04356)
- [Chu et al. — Qwen-Audio (arXiv:2311.07919)](https://arxiv.org/abs/2311.07919)
- [Goel et al. — Audio Flamingo 3 (arXiv:2507.08128)](https://arxiv.org/abs/2507.08128)
- [Tang et al. — SALMONN (arXiv:2310.13289)](https://arxiv.org/abs/2310.13289)
- [Gong et al. — LTU (arXiv:2305.10790)](https://arxiv.org/abs/2305.10790)
