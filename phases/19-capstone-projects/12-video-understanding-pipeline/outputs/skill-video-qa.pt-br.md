---
name: video-qa
description: Crie um pipeline de compreensão de vídeo com segmentação de cena, indexação multivetorial, fundamentação temporal e citações com carimbo de data/hora.
version: 1.0.0
phase: 19
lesson: 12
tags: [capstone, video, multimodal, gemini, qwen-vl, molmo, transnet, qdrant]
---

Dadas 100 horas de vídeo, crie um pipeline de ingestão e um sistema de consulta que responda a perguntas em linguagem natural com carimbos de data/hora (início, fim) e visualizações de quadros.

Plano de construção:

1. Ingerir vídeos (URLs do YouTube ou MP4); reduza para 720p, se necessário.
2. Segmentação de cena com TransNetV2 ou PySceneDetect; emitir `[{scene_id, start_ms, end_ms, keyframe_path}]`.
3. ASR com Whisper-v3-turbo (sussurro mais rápido) produzindo carimbos de data/hora em nível de palavra; fatia por cena.
4. Legendagem VLM com Gemini 2.5 Pro ou Qwen3-VL-Max ou Molmo 2; emitir legenda + incorporação de quadro.
5. Índice multivetorial Qdrant com três vetores nomeados por cena (caption_emb, frame_emb, transcript_emb) e carga útil {video_id, scene_id, start_ms, end_ms, keyframe_url}.
6. Consulta: três consultas densas paralelas; fusão recíproca de classificação para mesclar; top-k = 5 cenas.
7. O aterramento temporal (adaptador TimeLens ou VideoITG) refina (início, fim) na cena superior.
8. Síntese VLM (Gemini 2.5 Pro) com consulta + 3 principais clipes de cena + transcrição; requerem citações `(video_id, start_ms, end_ms)`.
9. Avaliação em ActivityNet-QA, NeXT-GQA, além de um conjunto personalizado rotulado manualmente com 100 consultas. Precisão do relatório geral e por classe de pergunta (descritiva, contagem, tipo de ação).

Rubrica de avaliação:

| Peso | Critério | Medição |
|:-:|---|---|
| 25 | IoU de aterramento temporal | IoU em conjunto de aterramento retido |
| 20 | Precisão do controle de qualidade | NeXT-GQA e conjunto personalizado de 100 consultas |
| 20 | Taxa de transferência de ingestão | Horas de vídeo indexadas por dólar |
| 20 | UI e citação UX | Links de carimbo de data/hora, faixa de miniaturas, salto para quadro |
| 15 | Taxa de alucinação | Precisão da contagem e do tipo de ação comunicadas separadamente |

Rejeições difíceis:

- Pipelines que agrupam um único vetor por cena. Multivetor é necessário para que as distinções de classe sejam exibidas.
- Respostas sem citações (início, fim).
- Relatar uma precisão geral sem detalhamento do subconjunto de contagem/ação.
- Síntese VLM que não recebe quadros de cena diretamente (entradas somente de texto perdem o fundamento visual).

Regras de recusa:

- Recuse-se a veicular vídeos com licença de origem pouco clara; exigem uma tag de licença em cada video_id.
- Recuse-se a reivindicar resposta em “tempo real” em taxas de ingestão acima da taxa de transferência medida.
- Recuse-se a ocultar o número da alucinação de contagem/ação dentro de um número de precisão geral.

Saída: um repositório contendo a segmentação de cena + ASR + pipeline de legenda, a coleção Qdrant multivetorial, o adaptador de aterramento temporal, o visualizador Next.js 15 com links diretos de carimbo de data / hora, os resultados de avaliação de três benchmarks (ActivityNet-QA, NeXT-GQA, personalizado) e um artigo nomeando as três classes de falha de contagem ou tipo de ação que você observou e a alteração de recuperação ou síntese que reduziu cada uma.