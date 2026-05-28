# Capstone 04 — QA Multimodal de Documentos (Visão-Primeiro em PDFs, Tabelas, Gráficos)

> A fronteira de QA de documentos em 2026 se afastou de OCR-depois-texto e foi em direção a interação tardia visão-primeiro. ColPali, ColQwen2.5 e ColQwen3-omni tratam cada página de PDF como uma imagem, fazem embedding com interação tardia multi-vetor e deixam a consulta attend diretamente nos patches. Em 10-Ks financeiros, papers científicos e anotações manuscritas, esse padrão supera OCR-depois-texto por margens significativas. Construa a pipeline ponta a ponta em 10k páginas e publique a comparação lado a lado com OCR-depois-texto.

**Tipo:** Capstone
**Linguagens:** Python (pipeline), TypeScript (UI do visualizador)
**Pré-requisitos:** Fase 4 (visão computacional), Fase 5 (NLP), Fase 7 (transformers), Fase 11 (engenharia de LLM), Fase 12 (multimodal), Fase 17 (infraestrutura)
**Fases exercitadas:** P4 · P5 · P7 · P11 · P12 · P17
**Tempo:** 30 horas

## Problema

Empresas têm PDFs que pipelines de OCR destroem: 10-Ks escaneados com tabelas rotacionadas, papers científicos densos com equações, gráficos que só fazem sentido como imagens, anotações manuscritas. Tratar esses como texto-primeiro significa perder metade do sinal. A resposta de 2026 é recuperação multi-vetor de interação tardia em imagens de página brutas. ColPali (Illuin Tech) introduziu; ColQwen2.5-v0.2 e ColQwen3-omni aumentaram a acurácia. No ViDoRe v3, recuperação visão-primeiro pontua acima de OCR-depois-texto por margens significativas — e a diferença aumenta em gráficos, tabelas e manuscritos.

O trade-off é armazenamento e latência. Um embedding ColQwen tem ~2048 vetores de patch por página, não um único vetor 1024-dim. Armazenamento bruto estoura. DocPruner (2026) traz 50% de poda sem perda mensurável de acurácia. Você vai indexar 10k páginas, medir nDCG@5 do ViDoRe v3, servir respostas em menos de 2s e comparar diretamente contra uma baseline OCR-depois-texto.

## Conceito

Interação tardia significa que cada token de consulta pontua contra cada token de patch, e a pontuação máxima por token de consulta é somada. Você ganha correspondência de granularidade fina sem precisar de um único vetor pooled. Um índice multi-vetor (Vespa, Qdrant multi-vetor ou AstraDB) armazena os embeddings por patch e roda MaxSim no momento da recuperação.

O respondedor é um modelo de visão-linguagem que pega a consulta mais as top-k páginas recuperadas como imagens e escreve uma resposta com regiões de evidência (bounding boxes ou referências de página). Qwen3-VL-30B, Gemini 2.5 Pro e InternVL3 são as escolhas de fronteira de 2026. Para equações e notação científica, um reserva OCR (Nougat, dots.ocr) é acoplado como canal de texto opcional.

Avaliação é uma matriz bidimensional. Um eixo: tipo de conteúdo (parágrafos de texto plano, tabelas densas, gráficos de barras/linhas, notas manuscritas, equações). Outro eixo: abordagem de recuperação (visão-primeiro interação tardia vs OCR-depois-texto vs híbrido). Cada célula recebe nDCG@5 e acurácia da resposta. O relatório é a entrega.

## Arquitetura

```
PDFs -> renderizador de página (PyMuPDF, 180 DPI)
           |
           v
  ColQwen2.5-v0.2 embed (multi-vetor por página, ~2048 patches)
           |
           +------> DocPruner 50% compressão
           |
           v
   índice multi-vetor (Vespa ou Qdrant multi-vetor)
           |
consulta ----+----> recuperar top-k páginas (MaxSim)
           |
           v
  respondedor VLM: Qwen3-VL-30B | Gemini 2.5 Pro | InternVL3
    entradas: consulta + imagens top-k páginas + texto OCR opcional
           |
           v
  resposta com números de página citados + regiões de evidência
           |
           v
  visualizador Streamlit / Next.js: caixas destacadas na página fonte
```

## Stack

- Renderização de página: PyMuPDF (fitz) a 180 DPI, normalizado retrato
- Modelo de interação tardia: ColQwen2.5-v0.2 ou ColQwen3-omni (time vidore no Hugging Face)
- Índice: Vespa com campo multi-vetor, ou Qdrant multi-vetor, ou AstraDB com MaxSim
- Poda: política DocPruner 2026 (manter patches de alta variância, 50% compressão com < 0.5% perda de acurácia)
- Fallback OCR (equações / tabelas densas): dots.ocr ou Nougat
- Respondedor VLM: Qwen3-VL-30B auto-hospedado ou Gemini 2.5 Pro hospedado; InternVL3 como fallback
- Avaliação: benchmark ViDoRe v3, M3DocVQA para raciocínio multi-página
- UI do visualizador: Next.js 15 com overlay de canvas para regiões de evidência

## Construa

1. **Ingestão.** Percorra um corpus de 10k páginas de PDF em 10-Ks, papers científicos e documentos escaneados. Renderize cada página para um PNG 1536x2048. Persista `{doc_id, page_num, image_path}`.

2. **Embedding.** Rode ColQwen2.5-v0.2 em cada imagem de página. Forma de saída: ~2048 patch embeddings de dim 128. Aplique DocPruner para manter a metade de maior sinal. Escreva no campo multi-vetor do Vespa ou multi-vetor do Qdrant.

3. **Query.** Para cada consulta recebida, faça embedding com a torre de consulta (embeddings no nível de token). Rode MaxSim contra o índice: para cada token de consulta, pegue o produto escalar máximo sobre os embeddings de patch da página, some. Retorne top-k páginas.

4. **Sintetização.** Chame Qwen3-VL-30B com a consulta e as top-5 imagens de páginas. Prompt: "Responda usando apenas as páginas fornecidas. Cite cada afirmação por (doc_id, página) e nomeie a região (figura, tabela, parágrafo)."

5. **Regiões de evidência.** Pós-processe a resposta para extrair regiões citadas. Se o VLM emitir bounding boxes (Qwen3-VL emite), renderize-as como overlays no visualizador.

6. **Fallback OCR.** Para páginas identificadas como densas em equações (heurística na variância da imagem), rode Nougat ou dots.ocr e passe o texto OCR como canal extra ao lado da imagem.

7. **Avaliação.** Rode ViDoRe v3 (nDCG@5 de recuperação) e M3DocVQA (acurácia de QA multi-página). Também rode a pipeline OCR-depois-texto no mesmo corpus com o mesmo sintetizador. Produza uma matriz tipo-conteúdo × abordagem.

8. **UI.** Protótipo com Streamlit primeiro; visualizador de produção Next.js 15 com overlay de região de evidência página a página.

## Use

```
$ doc-qa ask "qual foi a variação da margem operacional do segmento EMEA em 2024?"
[recuperar]   top-5 páginas em 320ms (ColQwen2.5, MaxSim, Vespa)
[sintetizar]  qwen3-vl-30b, 1.4s, citado (form-10k-2024, p. 88) + (..., p. 92)
resposta:
  A margem operacional da EMEA passou de 18.2% para 16.8%, queda de 140pb.
  citado: 10-K-2024.pdf p.88 (Tabela 4, Margem Operacional por Segmento)
         10-K-2024.pdf p.92 (MD&A, Desempenho Operacional)
[visualizador] abrir com bounding boxes destacados na Tabela 4 da p.88
```

## Entregue

`outputs/skill-doc-qa.md` descreve a entrega: um sistema de QA multimodal visão-primeiro de documentos calibrado em um corpus eespecificaçãoífico e avaliado contra uma baseline OCR-depois-texto no ViDoRe v3.

| Peso | Critério | Como é medido |
|:-:|---|---|
| 25 | ViDoRe v3 / M3DocVQA acurácia | Números do benchmark vs baseline OCR-texto e ranking publicado |
| 20 | Ancoragem de região de evidência | Fração de regiões citadas que realmente contêm o trecho de resposta |
| 20 | Engenharia de armazenamento e latência | Razão de compressão do DocPruner, p95 do índice, p95 da resposta |
| 20 | Raciocínio multi-página | Acurácia em um conjunto de 100 questões multi-página rotulado manualmente |
| 15 | UX de inspeção de fonte | Clareza do visualizador, fidelidade do overlay, ferramentas de comparação lado a lado |
| **100** | | |

## Exercícios

1. Meça ColQwen2.5-v0.2 vs ColQwen3-omni no mesmo corpus. Quais páginas um acerta e o outro erra? Adicione uma tag "classe de conteúdo" ao índice para rotear por tipo.

2. Pode embeddings agressivamente (75%, 90%). Encontre o cliff de compressão: o ponto onde nDCG@5 do ViDoRe cai abaixo da baseline OCR.

3. Construa um híbrido: rode OCR-depois-texto e ColQwen em paralelo, fusione com RRF, re-rankeie com um cross-encoder. O híbrido supera qualquer um sozinho? Onde ele mais ajuda?

4. Troque Qwen3-VL-30B por um VLM menor (Qwen2.5-VL-7B). Meça a curva acurácia-por-dollar.

5. Adicione suporte a notas manuscritas. Renderize o corpus manuscrito, faça embed com ColQwen, meça a recuperação. Compare com uma pipeline de OCR de manuscritos.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|------|------------------------|------------------------|
| Interação tardia | "Recuperação estilo ColPali" | Tokens de consulta pontuam contra patches de página independentemente; MaxSim agrega |
| Multi-vetor | "Embedding por patch" | Cada documento tem muitos vetores, não um único vetor pooled |
| MaxSim | "Pontuação de interação tardia" | Para cada token de consulta, pegue similaridade máxima sobre vetores do documento; some |
| DocPruner | "Compressão de patch" | Poda de 2026 que mantém 50% dos patches com perda de acurácia desprezível |
| ViDoRe v3 | "Benchmark de recuperação de documentos" | Padrão de 2026 para medir recuperação de documentos visuais |
| Região de evidência | "Bounding box citado" | Uma bbox na página fonte que localiza o trecho de resposta |
| Fallback OCR | "Canal de equações" | Pipeline de texto usada junto com visão para páginas pesadas em equações ou tabelas |

## Leitura Complementar

- [Repositório ColPali (Illuin Tech)](https://github.com/illuin-tech/colpali) — referência de recuperação de documentos com interação tardia
- [Paper ColPali (arXiv:2407.01449)](https://arxiv.org/abs/2407.01449) — paper do método fundamental
- [Família ColQwen no Hugging Face](https://huggingface.co/vidore) — checkpoints prontos para produção
- [M3DocRAG (Adobe)](https://arxiv.org/abs/2411.04952) — baseline multimodal RAG multi-página
- [Tutorial multi-vetor do Vespa](https://docs.vespa.ai/en/colpali.html) — stack de serving de referência
- [Suporte multi-vetor do Qdrant](https://qdrant.tech/documentation/concepts/vectors/#multivectors) — índice alternativo
- [Multi-vetor do AstraDB](https://docs.datastax.com/en/astra-db-serverless/databases/vector-search.html) — índice gerenciado alternativo
- [Nougat OCR](https://github.com/facebookresearch/nougat) — reserva OCR capaz de equações
