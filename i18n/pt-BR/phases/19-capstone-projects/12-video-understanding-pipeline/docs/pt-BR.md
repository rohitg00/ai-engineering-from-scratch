# Capstone 12  Video Compreensão de Pipeline (Escena, QA, Busca)

> Doze Laboratórios produziram Marengo + Pegasus. O VideoDB enviou a API CRUD-for-video. O Molmo 2 da AI2 publicou postos de controlo VLM abertos. O Gemini de longo contexto lida com horas de vídeo nativo. TimeLens-100K define a fixação temporal em escala. O pipeline 2026 está resolvido: segmentação de cenas, legenda por cena + incorporação, alinhamento de transcrições, índice multi-vector e uma consulta que responde com (iniciar, terminar) timestamps mais pré-visualizações de quadros. A pedra final está a ingerir 100 horas, a atingir os índices públicos e a medir alucinações sobre questões de contagem e ação.

**Type:** Capstone
**Languages:** Python (pipeline), TypeScript (UI, pipeline scaffold)
**Prerequisites:** Phase 4 (CV), Phase 6 (speech), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 17 (infrastructure)
**Phases exercised:**P4 · P6 · P7 · P11 · P12 · P17
**Time:** 30 hours

## Problemas

A qualidade de vídeo de longa forma é o problema multimodal mais faminto de largura de banda em escala de 2026. O Gemini 2.5 Pro pode ler um vídeo de 2 horas nativo, mas ingerir 100 horas de vídeo em um corpo consultavel ainda requer um índice de nível de cena. A forma de produção combina segmentação de cena (TransNetV2 ou PySceneDetect), legendas por cena com um VLM (Gemini 2.5, Qwen3-VL-Max, ou Molmo 2), alinhamento de transcrição (Whisper-v3-turbo com timestamps de palavras) e um índice multi-vector que armazena legendas, inserção de quadro e transcrição lado a lado. A linha de perguntas responde com marcas de tempo (começo, fim) e pré-visualizações de quadros.

Os benchmarks são públicos (ActivityNet-QA, NeXT-GQA) mais seu próprio conjunto personalizado de 100 consultas.

## Conceptos

Três oleodutos correm em paralelo ao ingerir. **Scene segmentation**Cortar o vídeo em cenas.**VLM captioning**gera uma legenda por cena e um quadro incorporado a partir de um quadro de teclado. **ASR alignment**Cada cena recebe três tipos de vetores em um índice multi-vetor (Qdrant): inscrição de legenda, inscrição de tela de chave, inscrição de transcrição.

No momento da consulta, a pergunta em linguagem natural dispara contra todos os três vetores; os resultados se fundem com RRF; um adaptador de aterragem temporal (estilo TimeLens) refina a janela (começo, fim) dentro da cena superior. O sintetizador VLM (Gemini 2.5 Pro ou Qwen3-VL-Max) toma consulta + cenas superiores + quadros cortados e respostas com timestamps citados e uma pré-visualização de quadros.

A medição de alucinações é importante. As perguntas de contagem ("quantas pessoas entram na sala?") e tipo de ação ("o chef despeja antes de agitar?") são notoriamente improváveis.

## Arquitetura

```
video file / URL
      |
      v
PySceneDetect / TransNetV2  (scene segmentation)
      |
      +--- per-scene keyframe --- VLM caption + frame embedding
      |                            (Gemini 2.5 Pro / Qwen3-VL-Max / Molmo 2)
      |
      +--- audio channel --- Whisper-v3-turbo ASR + word timestamps
      |
      v
multi-vector Qdrant: {caption_emb, keyframe_emb, transcript_emb}
      |
query:
  dense queries against all three -> RRF merge -> top-k scenes
      |
      v
TimeLens / VideoITG temporal grounding (refine start/end within scene)
      |
      v
VLM synth: query + top scenes + frame previews
      |
      v
answer + (start, end) timestamps + frame thumbs + citations
```

## Estaca

- Segmentação de cenas: TransNetV2 (estado de última geração 2024-26) ou PySceneDetect
- ASR: Whisper-v3-turbo via faster-whisper com sinais de tempo de palavra
- VLM caption + answerer: Gemini 2.5 Pro ou Qwen3-VL-Max ou Molmo 2
- Terração temporal: adaptador treinado com TimeLens-100K ou VideoITG
- Índice: Qdrant com suporte multi-vector (capção / quadro / transcrição)
- UI: Next.js 15 com reproductor de vídeo HTML5 e miniaturas de cenas
- Eval: ActivityNet-QA, NeXT-GQA, conjunto personalizado de 100 perguntas rotulado à mão
- Referência de alucinação: subconjuntos de contagem e tipo de ação com rótulos manuais

```figure
cf-scene-index
```

## Construí-lo

1. **Ingest walker.**Aceite URLs do YouTube ou MP4s locais. Baixa escala para 720p se necessário. Persistir `{video_id, file_path}`- Não .

2. **Scene segmentation.**Execute TransNetV2 ou PySceneDetect para produzir `[{scene_id, start_ms, end_ms, keyframe_path}]`Objetivo 100 horas: 6K-8K cenas.

3. **ASR pass.**Execute Whisper-v3-turbo em áudio; exportação de timestamps de nível de palavras; dividido em fragmentos de transcrição por cena.

4. **VLM captioning.**Por cena, ligue para Gemini 2.5 Pro (ou Qwen3-VL-Max) com a tela de teclado e um modelo de legenda curto.

5. **Multi-vector index.**Coleção de Qdrant com três vetores nomeados.`{video_id, scene_id, start_ms, end_ms, keyframe_url}`- Não .

6. **Query.**A pergunta de linguagem natural dispara três perguntas densas; fundir com fusão de rango recíproca; top-k=5 cenas.

7. **Temporal grounding.**Execute o adaptador de estilo TimeLens na cena superior para refinar a janela (iniciado, fim) dentro da cena.

8. **VLM synth.**Chamem Gemini 2.5 Pro com consulta + clipes de cenas do top 3 (como imagens ou clips curtos) + transcrições.`(video_id, start_ms, end_ms)`- Citações.

9. **Eval.**Execute ActivityNet-QA e NeXT-GQA. Construa um conjunto personalizado de 100 consultas. Relata precisão geral + desagregação por classe (contagem, ação, descritiva).

## Usá-lo

```
$ video-qa ask --url=https://youtube.com/watch?v=X "how many cars pass the intersection in the first minute?"
[scene]    23 scenes detected
[asr]      transcript complete, 4m12s
[index]    69 vectors written (23 scenes x 3)
[query]    top scene: scene 3 [01:32-01:54], confidence 0.84
[ground]   refined window: [00:12-00:58]
[synth]    gemini 2.5 pro, 1.4s
answer:    5 cars pass the intersection between 00:12 and 00:58.
citations: [scene 3: 00:12-00:58]
          [frame preview at 00:14, 00:27, 00:44, 00:51, 00:57]
```

## Envia-o

`outputs/skill-video-qa.md`Uma URL do YouTube ou um vídeo carregado, o pipeline indexa cenas e responde às perguntas com citações marcadas no tempo.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Temporal grounding IoU | Intersection-over-union on held-out grounding set |
| 20 | QA accuracy | NeXT-GQA and custom 100-query |
| 20 | Ingest throughput | Hours of video per dollar spent |
| 20 | UI and citation UX | Timestamp links, thumbnail strip, jump-to-frame |
| 15 | Hallucination rate | Counting and action-type accuracy separately |
| **100** | | |

## Exercícios

1. Troca o Gemini 2.5 Pro por Qwen3-VL-Max no cartão de legendação.

2. Reduzir a incorporação de quadros por cena para um vetor em vez de multi-vetor.

3. Construa um modo "contando estritamente": o sintetizador extrai cada instância contada com um timestamp e o usuário faz clic para verificar.

4. Custo de ingestão de referência: horas de vídeo por dólar em três opções VLM.

5. Adicione transcrição diarizada por alto-falantes: execute a diarização do alto-falante pyannote no áudio e incrusta transcrições por alto-falantes. Demonstre as perguntas "o que Alice disse sobre X?"

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Scene segmentation | "Shot detection" | Cutting video into scenes at shot boundaries |
| Multi-vector index | "Caption + frame + transcript" | Qdrant collection with named vectors per representation |
| Temporal grounding | "When exactly did it happen" | Refining the (start, end) window for a query answer |
| Frame embedding | "Visual representation" | A vector embedding of a keyframe; used for scene-visual similarity |
| RRF fusion | "Reciprocal rank fusion" | Merge strategy across multiple ranked lists; a classic hybrid-retrieval trick |
| Counting hallucination | "Miscount" | Known failure mode of VLMs on "how many X" questions |
| ActivityNet-QA | "Video-QA benchmark" | Long-form video QA accuracy benchmark |

## Mais leitura

- [AI2 Molmo 2](https://allenai.org/blog/molmo2) abertura de pontos de controlo VLM
- [TimeLens (CVPR 2026)](https://github.com/TencentARC/TimeLens) Termo temporal em escala
- [Gemini Video long-context](https://deepmind.google/technologies/gemini) a referência hospedada
- [VideoDB](https://videodb.io) Referência CRUD-for-video API
- [Twelve Labs Marengo + Pegasus](https://www.twelvelabs.io)Referência comercial
- [TransNetV2](https://github.com/soCzech/TransNetV2) Modelo de segmentação de cenas
- [PySceneDetect](https://github.com/Breakthrough/PySceneDetect) alternativa clássica aberta
- [ActivityNet-QA](https://arxiv.org/abs/1906.02467) Valor de referência de avaliação
