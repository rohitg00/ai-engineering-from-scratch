# Capstone 04  Documentos multimodal QA (Visão-Primeira PDF, Tablas, Gráficos)

> A fronteira de 2026 entre documento e QA afastou-se da OCR-depois-texto e foi para a interação tardia de visão. ColPali, ColQwen2.5 e ColQwen3-omni tratam cada página PDF como uma imagem, incorporam-na com interação tardia multi-vector, e deixam a consulta atender diretamente aos patches. Em 10Ks financeiros, artigos científicos e notas manuscritas este padrão supera o OCR primeiro por uma grande margem. Construir o pipeline de ponta a ponta em 10 mil páginas e publicar lado a lado contra OCR-then-text.

**Type:** Capstone
**Languages:** Python (pipeline), TypeScript (viewer UI, retrieval scaffold)
**Prerequisites:** Phase 4 (computer vision), Phase 5 (NLP), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 17 (infrastructure)
**Phases exercised:**P4 · P5 · P7 · P11 · P12 · P17
**Time:** 30 hours

## Problemas

As empresas sentam-se em PDFs que os canais de OCR desgastavam: 10K scanned com tabelas rotativas, artigos científicos densos com equações, gráficos que só fazem sentido como imagens, anotações manuscritas. Tratar isto como um primeiro texto significa perder metade do sinal. A resposta para 2026 é a recuperação multi-vectorial de interação tardia em imagens de páginas brutas. A ColPali (Illuin Tech) introduziu-o; a ColQwen2.5-v0.2 e a ColQwen3-omni impulsionaram a precisão. No ViDoRe v3, a visão-primeira recuperação pontua acima do OCR-depois-texto por margens significativas  e a lacuna se amplia em gráficos, tabelas e escrita à mão.

O trade-off é armazenamento e latência. Uma incorporação ColQwen é ~2048 vetores de parche por página, não um único vetor de 1024-dim. Balões de armazenamento bruto. DocPruner (2026) traz 50% de poda sem perda de precisão mensurável. Você irá indexar 10k páginas, medir ViDoRe v3 nDCG@5, servir respostas em menos de 2 segundos e comparar diretamente com uma linha de base OCR-then-text.

## Conceptos

Interação tardia significa que cada token de consulta marca em relação a cada token de patch, e a pontuação máxima por token de consulta é somada. Você obtém uma correspondência de grãos finos sem precisar de um único vetor em conjunto. Um índice multi-vetor (Vespa, Qdrant multi-vector ou AstraDB) armazena as incorporações por patch e executa MaxSim no momento da recuperação.

O respondedor é um modelo de linguagem de visão que toma a consulta mais as páginas recuperadas no topo de k como imagens e escreve uma resposta com regiões de evidência (caixas de confinamento ou referências de página). Qwen3-VL-30B, Gemini 2.5 Pro e InternVL3 são as escolhas de fronteira de 2026. Para equações e notação científica, um fallback OCR (Nougat, dots.ocr) é inserido como um canal de texto opcional.

A avaliação é uma matriz bidimensional. Um eixo: tipo de conteúdo ( parágrafos de texto plano, tabelas densas, gráficos de barras/linhas, notas manuscritas, equações). Outro eixo: abordagem de recuperação (visão-primeira interação tardia vs OCR-depois-texto vs híbrido). Cada célula obtém nDCG@5 e resposta precisão.

## Arquitetura

```
PDFs -> page renderer (PyMuPDF, 180 DPI)
           |
           v
  ColQwen2.5-v0.2 embed (multi-vector per page, ~2048 patches)
           |
           +------> DocPruner 50% compression
           |
           v
   multi-vector index (Vespa or Qdrant multi-vector)
           |
query ----+----> retrieve top-k pages (MaxSim)
           |
           v
  VLM answerer: Qwen3-VL-30B | Gemini 2.5 Pro | InternVL3
    inputs: query + top-k page images + optional OCR text
           |
           v
  answer with cited page numbers + evidence regions
           |
           v
  Streamlit / Next.js viewer: highlighted boxes on source page
```

## Estaca

- Rendering de página: PyMuPDF (fitz) a 180 DPI, normalizado por retrato
- Modelo de interação tardia: ColQwen2.5-v0.2 ou ColQwen3-omni (equipe vidore em Hugging Face)
- Índice: Vespa com campo multi-vector, ou multi-vector Qdrant, ou AstraDB com MaxSim
- Trituramento: Política DocPruner 2026 (manter parches de alta variação, compressão de 50% em perda de precisão < 0,5%)
- OCR fallback (equações / tabelas densas): dots.ocr ou Nougat
- Responsador VLM: Qwen3-VL-30B auto-host ou Gemini 2.5 Pro hospedado; InternVL3 como fallback
- Avaliação: referência ViDoRe v3, M3DocVQA para raciocínio de várias páginas
- Interfaça de visualização: Next.js 15 com capa de tela para regiões de evidências

```figure
ce-late-interaction
```

## Construí-lo

1. **Ingest.**Passe um corpo de 10 mil páginas PDF em 10 mil, trabalhos científicos e documentos digitalizados.`{doc_id, page_num, image_path}`- Não .

2. **Embed.**Execute ColQwen2.5-v0.2 em cada imagem de página. Forma de saída ~2048 inserções de parche de dim 128. Aplique DocPruner para manter a metade de sinal mais alta. Escreva para campo multi-vector Vespa ou multi-vector Qdrant.

3. **Query.**Para cada consulta recebida, embebebedar com a torre de consulta (embedings de nível de tokens). Execute MaxSim contra o índice: para cada token de consulta, pegue o produto máximo de ponto sobre as embebedagens de correção de página, soma. Retorna as páginas top-k.

4. **Synthesize.**Ligue para Qwen3-VL-30B com a consulta e as imagens de 5 páginas superiores. Prompt: "Responde usando apenas as páginas fornecidas. Cite cada reivindicação por (doc_id, página) e nome a região (figura, tabela, parágrafo). "

5. **Evidence regions.**Após processar a resposta para extrair as regiões citadas. Se o VLM emitir caixas de limite (Qwen3-VL faz), traduz-as como superposições no visualizador.

6. **OCR fallback.**Para páginas identificadas como densas em equações (heurística sobre variância de imagem), execute Nougat ou dots.ocr e passe o texto OCR como um canal extra ao lado da imagem.

7. **Eval.**Execute ViDoRe v3 (retorno nDCG@5) e M3DocVQA (acurateza de QA de várias páginas). Também execute OCR-then-text pipeline no mesmo corpus com o mesmo sintetizador. Produza uma matriz de tipo de conteúdo × abordagem.

8. **UI.**O protótipo de streaming primeiro; Next.js 15 visualizador de produção com capa de evidência por página.

## Usá-lo

```
$ doc-qa ask "what was the 2024 operating margin change for segment EMEA?"
[retrieve]   top-5 pages in 320ms (ColQwen2.5, MaxSim, Vespa)
[synth]      qwen3-vl-30b, 1.4s, cited (form-10k-2024, p. 88) + (..., p. 92)
answer:
  EMEA operating margin moved from 18.2% to 16.8%, a 140bp decline.
  cited: 10-K-2024.pdf p.88 (Table 4, Segment Operating Margin)
         10-K-2024.pdf p.92 (MD&A, Operating Performance)
[viewer]     open with highlighted bounding boxes overlaid on p.88 Table 4
```

## Envia-o

`outputs/skill-doc-qa.md`descreve o produto fornecido: um sistema de avaliação de qualidade de documentos multimodal de primeira visão, sintonizado com um corpus específico e avaliado em relação a uma linha de base OCR-then-text no ViDoRe v3.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | ViDoRe v3 / M3DocVQA accuracy | Benchmark numbers vs OCR-text baseline and published leaderboard |
| 20 | Evidence-region grounding | Fraction of cited regions that actually contain the answer span |
| 20 | Storage and latency engineering | DocPruner compression ratio, index p95, answer p95 |
| 20 | Multi-page reasoning | Accuracy on a hand-labeled 100-question multi-page set |
| 15 | Source-inspection UX | Viewer clarity, overlay fidelity, side-by-side comparison tools |
| **100** | | |

## Exercícios

1. Messa ColQwen2.5-v0.2 vs ColQwen3-omni no mesmo corpus. Que páginas um fica certo e o outro falta? Adicione uma etiqueta de "classe de conteúdo" ao índice para encaminhar por tipo.

2. Encontre o penhasco de compressão: o ponto onde o ViDoRe nDCG@5 cai abaixo da linha de base OCR.

3. Construir um híbrido: executar OCR-then-text e ColQwen em paralelo, fundir com RRF, re-ranquear com um cross-encoder.

4. Troque Qwen3-VL-30B por um VLM menor (Qwen2.5-VL-7B).

5. Adicione suporte de notas manuscritas. Retorna o corpus de escrita, embaixe com ColQwen, mede a recuperação. Comparar com um pipeline de OCR manuscrito.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Late interaction | "ColPali-style retrieval" | Query tokens score against page patches independently; MaxSim aggregates |
| Multi-vector | "Per-patch embedding" | Each document has many vectors, not one pooled vector |
| MaxSim | "Late-interaction scoring" | For every query token, take max similarity over document vectors; sum |
| DocPruner | "Patch compression" | 2026 pruning that keeps 50% of patches with negligible accuracy loss |
| ViDoRe v3 | "Document-retrieval benchmark" | The 2026 standard for measuring visual-document retrieval |
| Evidence region | "Cited bounding box" | A bbox on the source page that localizes the answer span |
| OCR fallback | "Equation channel" | Text pipeline used alongside vision for equation- or table-heavy pages |

## Mais leitura

- [ColPali (Illuin Tech) repository](https://github.com/illuin-tech/colpali) Recuperação de documentos de referência de interação tardia
- [ColPali paper (arXiv:2407.01449)](https://arxiv.org/abs/2407.01449) o documento de método fundamental
- [ColQwen family on Hugging Face](https://huggingface.co/vidore) Pontos de controlo prontos para produção
- [M3DocRAG (Adobe)](https://arxiv.org/abs/2411.04952) Linha de base do RAG multimodal de várias páginas
- [Vespa multi-vector tutorial](https://docs.vespa.ai/en/colpali.html) Estaca de serviço de referência
- [Qdrant multi-vector support](https://qdrant.tech/documentation/concepts/vectors/#multivectors)Indice alternativo
- [AstraDB multi-vector](https://docs.datastax.com/en/astra-db-serverless/databases/vector-search.html) índice administrado alternativo
- [Nougat OCR](https://github.com/facebookresearch/nougat) Redução de RCO com capacidade de equação
