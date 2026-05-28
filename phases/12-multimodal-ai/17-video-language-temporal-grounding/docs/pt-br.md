# Modelos Vídeo-Linguagem: Tokens Temporais e Grounding

> Vídeo não é uma pilha de fotos. Um clip de 5 segundos tem ordenação causal, verbos de ação e temporização de eventos que um modelo de imagem não consegue representar. Video-LLaMA (Zhang et al., junho 2023) lançou o primeiro video-LLM open com grounding audio-visual. VideoChat e Video-LLaVA escalaram o padrão. Até 2025, o TMRoPE do Qwen2.5-VL fechou a lacuna com modelos proprietários frontier. Cada sistema resolveu tokens temporais de forma diferente — Q-former por clip, concat-pool por frame, TMRoPE por token. Esta aula analisa os padrões, constrói um sampler de frames uniforme-vs-dinâmico, e avalia em tarefas de grounding temporal.

**Tipo:** Construção
**Linguagens:** Python (stdlib, sampler de frames + avaliador de grounding temporal)
**Pré-requisitos:** Fase 12 · 08 (LLaVA-OneVision)
**Tempo:** ~180 minutos

## Objetivos de Aprendizado

- Explicar por que codificação posicional temporal muda performance de VLM de vídeo independentemente do encoder de visão.
- Comparar amostragem uniforme, de FPS dinâmico e dirigida por evento em tokens-por-segundo vs acurácia de grounding.
- Descrever Q-former por clip (Video-LLaMA) vs pooling por frame (Video-LLaVA) vs M-RoPE por token (Qwen2.5-VL).
- Nomear os quatro benchmarks de vídeo: VideoMME, TempCompass, EgoSchema, Video-MMMU.

## O Problemo

Um vídeo de 1 minuto a 30 FPS tem 1800 frames. A 196 tokens visuais por frame (ViT-B a 224), isso são 352k tokens — maior que qualquer contexto de LLM de 2024.

Três estratégias de redução existem:

1. Subamostragem de frames (1-8 FPS dependendo do conteúdo).
2. Pooling agressivo dos tokens de patch por frame (pool bilinear 3x3 ou 4x4).
3. Compressão via Q-former que pega um clip de 16 frames e produz 64 tokens.

Cada trade-off é diferente. Subamostragem perde detalhe temporal. Pooling perde detalhe espacial. Q-former perde um pouco dos dois, mas economiza tokens.

Codificação posicional temporal é o outro eixo: como o modelo sabe que o frame 5 veio antes do frame 6? Opções incluem RoPE temporal 1D simples (Video-LLaMA), embeddings temporais aprendidos (Video-LLaVA) e TMRoPE (Qwen2.5-VL, 3D completo).

## O Conceito

### Video-LLaMA: Q-former por clip + ramo de áudio

Video-LLaMA (2023) foi o primeiro video-LLM open. Arquitetura:

- Clips de 16 frames a 2 FPS (então 8 segundos).
- Features ViT por frame -> Video Q-former que faz cross-attention sobre os 16 frames -> 32 queries aprendidos -> LLM.
- Ramo de áudio paralelo: forma de onda -> encoder de áudio ImageBind -> Audio Q-former -> 32 queries -> LLM.

Força: raciocínio audio-visual conjunto. Fraqueza: comprimento de clip fixo, sem grounding temporal arbitrário.

### VideoChat e Video-LLaVA

VideoChat manteve a ideia do Video-LLaMA, mas largou áudio e simplificou. Video-LLaVA (Lin et al., 2023) treinou um encoder visual único em imagens e frames de vídeo ("alinhamento antes da projeção"), dando uma representação unificada. Ambos são encoder-CLIP-congelado + MLP + LLM.

Nenhum lida com vídeo longo. Ambos são sistemas de 8-16 frames.

### Qwen2.5-VL e TMRoPE

Qwen2.5-VL introduziu TMRoPE — Temporal-Modality Rotary Position Embedding. Cada token de patch carrega uma posição (t, h, w) onde t é o timestamp real (não o índice do frame).

Diferenças-chave de embedding temporal simples:

- Tempo absoluto, não índice. O modelo vê "em 4.2 segundos" não "no frame 15."
- Rotação por token, não por clip. Cada token visual rotaciona independentemente por seu timestamp.
- Compatível com FPS dinâmico. Se você amostra a 2 FPS aqui e 4 FPS ali, TMRoPE lida com o espaçamento desigual nativamente.

TMRoPE permite perguntas "em que segundo o gato pula?". O modelo pode sair "em 4.2 segundos." Video-LLaMA só conseguia dizer "no início do clip."

### Estratégias de amostragem de frames

Uniforme: amostra N frames uniformemente ao longo da duração. Simples, perde picos de movimento.

FPS dinâmico: amostra adaptativamente baseado em intensidade de movimento. Fluxo óptico ou differencing de frames escolhe segmentos de alto movimento pra amostragem mais densa. Qwen2.5-VL treina assim.

Dirigido por evento: roda um detector leve, amostra mais onde a ação acontece. Usado por VideoAgent.

Keyframe + contexto: amostra em limites de cena + alguns frames adjacentes. Usado pra conteúdo cinematográfico.

### Pooling por frame

A 1 FPS e 576 tokens por frame, um clip de 5 minutos tem 172.800 tokens. Factível com o contexto de 128k do Qwen2.5-VL-72B, mas caro.

Pool bilinear 3x3 reduz pra 64 tokens por frame -> 19.200 tokens pra 5 minutos. Sweet spot pra maioria das tarefas.

Pooling mais agressivo (6x6 -> 16 tokens por frame) pra workflows de agent onde detalhe espacial importa menos.

### Os quatro benchmarks de vídeo

- VideoMME: compreensão de vídeo abrangente, curto + médio + longo.
- TempCompass: raciocínio temporal refinado, perguntas "antes" / "depois".
- EgoSchema: vídeo de primeira pessoa de horizonte longo.
- Video-MMMU: perguntas multimodais multidisciplinares de vídeo.

Uma avaliação completa de video-VLM atinge os quatro. Eles estressam eixos diferentes — TempCompass é todo sobre ordenação, EgoSchema é raciocínio de 3+ minutos, VideoMME abrange durações.

### Formatos de saída de grounding

Formatos de saída pra grounding temporal:

- Texto livre: "O gato pula por volta dos 4 segundos." Fácil de parsear, mas impreciso.
- JSON estruturado: `{"event": "jump", "start": 4.1, "end": 4.3}`. Qwen2.5-VL treina isso.
- Baseado em tokens: tokens especiais `<time>4.1</time>` intercalados com a resposta. Formato interno do Qwen2.5-VL.

Baseado em tokens é o mais preciso pra uso downstream. O formato JSON de saída do Qwen2.5-VL parseia diretamente.

### Prática recomendada em 2026

Pra VLMs de vídeo em 2026:

- Encoder: SigLIP 2 com M-RoPE ou TMRoPE (Qwen2.5-VL).
- Amostragem de frames: FPS dinâmico (1-4 dependendo do movimento) com teto de frames máximos.
- Pooling por frame: bilinear 3x3.
- Saída: JSON estruturado com campos de tempo + evento.
- Benchmarks: VideoMME + TempCompass pra geral; EgoSchema pra horizonte longo.

## Use

`code/main.py` inclui:

- Samplers de frames uniforme e FPS dinâmico.
- Um avaliador toy de grounding temporal: dado um evento "ground truth" no tempo T e uma saída de modelo, pontua acurácia com tolerância.
- Uma comparação entre Video-LLaMA (16 frames, Q-former), Video-LLaVA (8 frames, MLP), Qwen2.5-VL (FPS dinâmico + TMRoPE).

## Implemente

Esta aula produz `outputs/skill-video-vlm-frame-planner.md`. Dada uma tarefa de vídeo (monitoramento, reconhecimento de ação, grounding temporal, sumarização), escolhe o sampler de frames, fator de pooling, formato de saída e tier de acurácia esperado.

## Exercícios

1. Pra uma demonstração de culinária de 3 minutos, escolha uniforme vs FPS dinâmico. Justifique com contagem de tokens.

2. O TMRoPE adiciona o que especificamente que uma tabela simples de embedding temporal não consegue fazer?

3. Escreva um schema JSON pra grounding temporal que um VLM possa aprender a emitir. Inclua casos de erro.

4. Leia a Seção 3 do Video-LLaVA sobre "Alinhamento Antes da Projeção." Por que isso é melhor que treinar encoders de imagem e vídeo separados?

5. Dado o leaderboard VideoMME, qual é a lacuna entre o melhor modelo open e o melhor modelo proprietário em 2026? Quanto dessa lacuna é atribuível a codificação temporal vs escala do LLM base?

## Termos-Chave

| Termo | O que a galera diz | O que realmente significa |
|-------|-------------------|--------------------------|
| Grounding temporal | "Respostas com localização temporal" | VLM produz uma faixa de timestamp específica pra quando um evento acontece |
| TMRoPE | "RoPE Multimodal Temporal" | Rotação posicional 3D com timestamps absolutos, usado por Qwen2.5-VL |
| FPS dinâmico | "Amostragem consciente de movimento" | Amostra mais frames em segmentos de alto movimento, menos nos estáticos |
| Pooling de frames | "Compressão espacial por frame" | Reduz patches por frame com interpolação bilinear antes do LLM |
| Video Q-former | "Compressor de clip" | Gargalo de cross-attention que mapeia N frames pra K queries aprendidos |
| VideoMME | "Benchmark de vídeo" | Benchmark abrangente de vídeo curto/médio/longo, 2500+ amostras |

## Leitura Complementar

- [Zhang et al. — Video-LLaMA (arXiv:2306.02858)](https://arxiv.org/abs/2306.02858)
- [Li et al. — VideoChat (arXiv:2305.06355)](https://arxiv.org/abs/2305.06355)
- [Lin et al. — Video-LLaVA (arXiv:2311.10122)](https://arxiv.org/abs/2311.10122)
- [Qwen Team — Qwen2.5-VL (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)
- [Lin et al. — VILA-1.5 (arXiv:2312.07533)](https://arxiv.org/abs/2312.07533)
