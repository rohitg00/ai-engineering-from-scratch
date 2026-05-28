# Capstone 12 — Pipeline de Compreensão de Vídeo (Cenas, QA, Busca)

> Twelve Labs tornou Marengo + Pegasus um produto. VideoDB lançou a API CRUD-for-video. Molmo 2 da AI2 publicou checkpoints VLM abertos. Gemini de longo contexto lida com horas de vídeo nativamente. TimeLens-100K definiu grounding temporal em escala. A pipeline de 2026 está definida: segmentação de cenas, legenda + embedding por cena, alinhamento de transcrição, índice multi-vetor e uma consulta que responde com timestamps (início, fim) mais previews de quadros. O capstone é ingerir 100 horas, atingir benchmarks públicos e medir alucinação em questões de contagem e ação.

**Tipo:** Capstone
**Linguagens:** Python (pipeline), TypeScript (UI)
**Pré-requisitos:** Fase 4 (CV), Fase 6 (fala), Fase 7 (transformers), Fase 11 (engenharia de LLM), Fase 12 (multimodal), Fase 17 (infraestrutura)
**Fases exercitadas:** P4 · P6 · P7 · P11 · P12 · P17
**Tempo:** 30 horas

## Problema

QA de vídeo longo é o problema multimodal mais consumidor de largura de banda em escala de 2026. Gemini 2.5 Pro pode ler um vídeo de 2 horas nativamente, mas ingerir 100 horas de vídeo em um corpus pesquisável ainda requer um índice em nível de cena. A forma de produção combina segmentação de cenas (TransNetV2 ou PySceneDetect), legendas por cena com um VLM (Gemini 2.5, Qwen3-VL-Max ou Molmo 2), alinhamento de transcrição (Whisper-v3-turbo com timestamps por palavra) e um índice multi-vetor que armazena legenda, embedding de quadro e transcrição lado a lado. A pipeline de consulta responde com timestamps (início, fim) mais previews de quadros.

Benchmarks são públicos (ActivityNet-QA, NeXT-GQA) mais seu próprio conjunto personalizado de 100 queries. Alucinação em questões de contagem e tipo de ação é a classe de falha notoriamente difícil; o capstone mede explicitamente.

## Conceito

Três pipelines rodam em paralelo na ingestão. **Segmentação de cenas** corta o vídeo em cenas. **Legendas VLM** geram uma legenda por cena e um embedding de quadro de um keyframe. **Alinhamento ASR** produz timestamps por palavra. Os três streams são unidos por (scene_id, faixa de tempo). Cada cena ganha três tipos de vetor num índice multi-vetor (Qdrant): embedding de legenda, embedding de keyframe, embedding de transcrição.

No momento da consulta, a pergunta em linguagem natural dispara contra todos os três vetores; resultados são mesclados com RRF; um adaptador de grounding temporal (estilo TimeLens) refina a janela (início, fim) dentro da cena principal. O sintetizador VLM (Gemini 2.5 Pro ou Qwen3-VL-Max) pega consulta + cenas principais + quadros recortados e responde com timestamps citados e um preview de quadro.

A medição de alucinação importa. Questões de contagem ("quantas pessoas entram na sala?") e de tipo de ação ("o chef despeja antes de mexer?") são notoriamente não-confiáveis. Relate acurácia separadamente de questões descritivas.

## Arquitetura

```
arquivo de vídeo / URL
      |
      v
PySceneDetect / TransNetV2  (segmentação de cenas)
      |
      +--- keyframe por cena --- legenda VLM + embedding de quadro
      |                            (Gemini 2.5 Pro / Qwen3-VL-Max / Molmo 2)
      |
      +--- canal de áudio --- ASR Whisper-v3-turbo + timestamps por palavra
      |
      v
Qdrant multi-vetor: {caption_emb, keyframe_emb, transcript_emb}
      |
consulta:
  consultas densas contra os três -> fusão RRF -> top-k cenas
      |
      v
grounding temporal TimeLens / VideoITG (refinar início/fim dentro da cena)
      |
      v
síntese VLM: consulta + cenas principais + previews de quadro
      |
      v
resposta + timestamps (início, fim) + miniaturas de quadro + citações
```

## Stack

- Segmentação de cenas: TransNetV2 (estado da arte 2024-26) ou PySceneDetect
- ASR: Whisper-v3-turbo via faster-whisper com timestamps por palavra
- Legendador + respondedor VLM: Gemini 2.5 Pro ou Qwen3-VL-Max ou Molmo 2
- Grounding temporal: adaptador treinado no TimeLens-100K ou VideoITG
- Índice: Qdrant com suporte multi-vetor (legenda / quadro / transcrição)
- UI: Next.js 15 com player HTML5 e miniaturas de cena
- Avaliação: ActivityNet-QA, NeXT-GQA, conjunto personalizado de 100 questões rotuladas manualmente
- Benchmark de alucinação: subconjuntos de contagem e tipo de ação com rótulos manuais

## Construa

1. **Walker de ingestão.** Aceite URLs do YouTube ou MP4s locais. Reduza para 720p se necessário. Persista `{video_id, file_path}`.

2. **Segmentação de cenas.** Rode TransNetV2 ou PySceneDetect para produzir `[{scene_id, start_ms, end_ms, keyframe_path}]`. Meta 100 horas: ~6k-8k cenas.

3. **Passada de ASR.** Rode Whisper-v3-turbo no áudio; exporte timestamps por palavra; divida em fatias de transcrição por cena.

4. **Legendas VLM.** Para cada cena, chame Gemini 2.5 Pro (ou Qwen3-VL-Max) com o keyframe e um template curto de legenda. Produza legenda + embedding de quadro.

5. **Índice multi-vetor.** Coleção Qdrant com três vetores nomeados. Payload: `{video_id, scene_id, start_ms, end_ms, keyframe_url}`.

6. **Query.** Pergunta em linguagem natural dispara três consultas densas; fusão com reciprocal rank fusion; top-k=5 cenas.

7. **Grounding temporal.** Rode adaptador estilo TimeLens na cena principal para refinar a janela (início, fim) dentro da cena.

8. **Síntese VLM.** Chame Gemini 2.5 Pro com consulta + clips de top-3 cenas (como imagens ou clips curtos) + transcrições. Exija citações `(video_id, start_ms, end_ms)`.

9. **Avaliação.** Rode ActivityNet-QA e NeXT-GQA. Construa um conjunto personalizado de 100 queries. Relate acurácia geral + breakdown por classe (contagem, ação, descritiva).

## Use

```
$ video-qa ask --url=https://youtube.com/watch?v=X "quantos carros passam na esquina no primeiro minuto?"
[cena]      23 cenas detectadas
[asr]       transcrição completa, 4m12s
[índice]    69 vetores escritos (23 cenas x 3)
[consulta]     cena principal: cena 3 [01:32-01:54], confiança 0.84
[ground]    janela refinada: [00:12-00:58]
[sintetizar] gemini 2.5 pro, 1.4s
resposta:   5 carros passam pela esquina entre 00:12 e 00:58.
citações:   [cena 3: 00:12-00:58]
            [preview de quadro em 00:14, 00:27, 00:44, 00:51, 00:57]
```

## Entregue

`outputs/skill-video-qa.md` é a entrega. Dada uma URL do YouTube ou vídeo carregado, a pipeline indexa cenas e responde a perguntas com citações com timestamp.

| Peso | Critério | Como é medido |
|:-:|---|---|
| 25 | IoU de grounding temporal | Intersection-over-union em conjunto de grounding retido |
| 20 | Acurácia de QA | NeXT-GQA e conjunto personalizado de 100 queries |
| 20 | Throughput de ingestão | Horas de vídeo por dólar gasto |
| 20 | UI e UX de citações | Links de timestamp, faixa de miniaturas, salto para quadro |
| 15 | Taxa de alucinação | Acurácia de contagem e tipo de ação separadamente |
| **100** | | |

## Exercícios

1. Troque Gemini 2.5 Pro por Qwen3-VL-Max na passada de legendas. Relate delta de qualidade das legendas em uma amostra de 50 cenas avaliadas por humanos.

2. Reduza o embedding de quadro por cena para um único vetor pooled em vez de multi-vetor. Meça a regressão na recuperação.

3. Construa um modo "contagem estrita": o sintetizador extrai cada instância contada com um timestamp e o usuário clica para verificar. Meça se a verificação pelo usuário reduz alucinação.

4. Teste o custo de ingestão: horas-de-vídeo-por-dollar em três escolhas de VLM. Escolha o ponto ideal.

5. Adicione transcrição com diarização de falantes: rode diarização de falantes pyannote no áudio e faça embedding de transcrições por falante. Demonstre queries "o que Alice disse sobre X?"

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|------|------------------------|------------------------|
| Segmentação de cenas | "Detecção de shot" | Cortar vídeo em cenas nas fronteiras de shot |
| Índice multi-vetor | "Legenda + quadro + transcrição" | Coleção Qdrant com vetores nomeados por representação |
| Grounding temporal | "Quando exatamente aconteceu" | Refinar a janela (início, fim) para a resposta de uma consulta |
| Embedding de quadro | "Representação visual" | Vetor embedding de um keyframe; usado para similaridade visual de cena |
| Fusão RRF | "Reciprocal rank fusion" | Estratégia de fusão entre múltiplas listas ranqueadas; truque clássico de recuperação híbrida |
| Alucinação de contagem | "Erro de contagem" | Modo de falha conhecido de VLMs em questões "quantos X" |
| ActivityNet-QA | "Benchmark de vídeo-QA" | Benchmark de acurácia de QA de vídeo longo |

## Leitura Complementar

- [Molmo 2 da AI2](https://allenai.org/blog/molmo2) — checkpoints VLM abertos
- [TimeLens (CVPR 2026)](https://github.com/TencentARC/TimeLens) — grounding temporal em escala
- [Gemini Video longo-contexto](https://deepmind.google/technologies/gemini) — referência hospedada
- [VideoDB](https://videodb.io) — referência da API CRUD-for-video
- [Twelve Labs Marengo + Pegasus](https://www.twelvelabs.io) — referência comercial
- [TransNetV2](https://github.com/soCzech/TransNetV2) — modelo de segmentação de cenas
- [PySceneDetect](https://github.com/Breakthrough/PySceneDetect) — alternativa aberta clássica
- [ActivityNet-QA](https://arxiv.org/abs/1906.02467) — benchmark de avaliação de referência
