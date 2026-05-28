# ColPali e RAG de Documentos Vision-Native

> RAG tradicional parseia PDFs em texto, divide em chunks, gera embeddings dos chunks, armazena vetores. Cada passo perde sinal: OCR derruba dados de gráficos, chunking quebra linhas de tabela, embeddings de texto ignoram figuras. ColPali (Faysse et al., julho de 2024) fez a pergunta mais simples: por que extrair texto de jeito nenhum? Embute a imagem da página diretamente via PaliGemma, usa late interaction estilo ColBERT pra busca, e mantém todo o sinal de layout, figuras, fontes e formatação que o documento carrega. Benchmarks publicados: 20-40% de acurácia end-to-end melhor que RAG de texto em documentos visualmente ricos. ColQwen2, ColSmol e VisRAG estenderam o padrão. Esta aula lê a tese de RAG vision-native e constrói um indexador pequeno estilo ColPali.

**Tipo:** Construção
**Linguagens:** Python (stdlib, indexador multi-vetor +scorer MaxSim)
**Pré-requisitos:** Fase 11 (Engenharia de LLM — fundamentos de RAG), Fase 12 · 05 (LLaVA)
**Tempo:** ~180 minutos

## Objetivos de Aprendizado

- Explicar a diferença entre busca por bi-encoder (um vetor por documento) e busca por late interaction (muitos vetores por documento).
- Descrever a operação MaxSim do ColBERT e como o ColPali a generaliza de tokens de texto para patches de imagem.
- Construir um indexador pequeno estilo ColPali: página → embeddings de patches → MaxSim sobre embeddings de termos de query → top-k páginas.
- Comparar ColPali + gerador Qwen2.5-VL vs RAG de texto + GPT-4 num caso de uso de notas fiscais / relatórios financeiros.

## O Problemo

RAG de texto em PDFs joga fora a maioria do documento. O crescimento de receita do Q3 de um relatório financeiro geralmente está num gráfico; os achados de um relatório médico estão em imagens anotadas; o bloco de assinatura de um contrato jurídico é um fato de layout, não um fato de texto.

Pipeline de RAG de texto:

1. PDF → texto via OCR / pdftotext.
2. Texto → chunks de 300-500 tokens.
3. Chunk → embedding por bi-encoder (um vetor).
4. Query do usuário → embedding → similaridade cosseno → top-k chunks.
5. Chunks + query → LLM.

Cinco passos com perdas. Gráficos não capturados. Tabelas quebradas entre chunks. Layout multi-coluna achatado. Anotações de figuras desaparecem.

A solução do ColPali: pule OCR, embuta a imagem da página diretamente. Use late interaction estilo ColBERT pra busca assim o modelo pode attend a patches finos no momento da query.

## O Conceito

### ColBERT (2020)

ColBERT (Khattab & Zaharia, arXiv:2004.12832) é um método de busca textual. Em vez de um vetor por documento, produz um vetor por token. No momento da query:

- Tokens de query recebem seus próprios embeddings (N_q vetores).
- Tokens do documento recebem embeddings (N_d vetores, tipicamente em cache).
- Score = soma sobre tokens de query do max sobre tokens do documento da similaridade cosseno: Σ_i max_j cos(q_i, d_j).

Essa é a operação MaxSim. Cada token de query "escolhe" seu token de documento de melhor correspondência. O score final é a soma.

Prós: recall forte, lida com semântica no nível de termo. Contras: N_d vetores por documento, armazenamento caro.

### ColPali

ColPali (Faysse et al., arXiv:2407.01449) aplica o padrão do ColBERT a imagens.

- Cada página é codificada por PaliGemma (ViT + linguagem) em embeddings de patches: N_p vetores por página.
- Cada query do usuário (texto) é codificada em embeddings de tokens de query: N_q vetores.
- Score = Σ_i max_j cos(q_i, p_j), ou seja, MaxSim entre tokens de texto da query e patches de imagem da página.
- Recuperar top-k páginas por score total.

No momento de ingestão do documento: embuta cada página com PaliGemma, armazene todos os embeddings de patches. No momento da query: embuta os tokens da query, compute MaxSim contra todos os embeddings de páginas armazenados, retorne top-k páginas.

Prós: end-to-end supera RAG de texto em 20-40% em documentos visualmente ricos. Cada patch-vetor captura layout e conteúdo local.

Contras: N_p patches × floats de 4 bytes × vetores de dimensão D por página = armazenamento cresce rápido. Mitigado por quantização PQ / OPQ.

### ColQwen2 e ColSmol

ColQwen2 (illuin-tech, 2024-2025) troca PaliGemma por Qwen2-VL. Encoder base melhor, busca melhor.

ColSmol é a variante menor para uso local / edge. Um recuperador ColSmol com ~1B parâmetros roda em GPU de consumidor.

### VisRAG

VisRAG (Yu et al., arXiv:2410.10594) é uma variante diferente: em vez de MaxSim em patches, agrega cada página num vetor único com um VLM e depois faz busca por bi-encoder. Indexação mais rápida + armazenamento menor, recall mais fraco.

O trade-off qualidade-vs-custo: ColPali pra qualidade, VisRAG pra escala.

### M3DocRAG

M3DocRAG (Cho et al., arXiv:2411.04952) estende busca multimodal para raciocínio multi-página multi-documento. Recupera páginas entre documentos, compõe um contexto multi-página pro VLM.

### ViDoRe — o benchmark

Benchmark parceiro do ColPali. Visual Document Retrieval Evaluation. Tarefas incluem relatórios financeiros, artigos científicos, documentos administrativos, registros médicos, manuais. Métrica: nDCG@5.

ColPali-v1 pontua ~80% nDCG@5 no ViDoRe; RAG de texto nos mesmos documentos pontua ~50-60%.

### Pipeline end-to-end de RAG

Para um RAG vision-native:

1. Ingestão: PDF → imagens de páginas → codificação PaliGemma → armazenar todos os embeddings de patches.
2. Query: texto do usuário → embeddings de tokens de query → MaxSim contra todas as páginas indexadas → top-k páginas.
3. Geração: imagens de top-k páginas + query → VLM (Qwen2.5-VL ou Claude) → resposta.

Sem OCR em lugar nenhum. Figuras, gráficos, fontes, layout entram todos na resposta.

### Matemática de armazenamento

Um relatório financeiro de 50 páginas com 729 patches por página e embeddings de 128 dimensões:

- ColPali: 50 * 729 * 128 * 4 bytes = ~18 MB bruto, ~4 MB após PQ.
- RAG de texto: 50 chunks * 768 dim * 4 bytes = ~150 kB.

ColPali é ~30x mais armazenamento por documento. Em escala, OPQ / PQ reduz pra ~5-10x, geralmente tolerável.

### Quando RAG de texto ainda ganha

- Documentos puramente textuais sem sinal de layout (artigos de wiki, logs de chat). RAG de texto é mais simples e mais barato em armazenamento.
- Arquivos de milhões de páginas onde armazenamento domina o custo.
- Requisitos regulatórios estritos exigindo texto OCR extraível junto com a busca.

Para todo o resto em 2026 — relatórios financeiros, artigos científicos, contratos jurídicos, registros médicos, documentação de UX — RAG vision-native ganha.

## Use

`code/main.py`:

- Codificador de patches de exemplo: mapeia uma "página" (grade pequena de vetores de feature) para um array de embeddings de patches.
- Scorer MaxSim: computa o score estilo ColBERT entre um conjunto de embeddings de tokens de query e um conjunto de patches de página.
- Indexa 5 páginas de exemplo, roda 3 queries, retorna top-k com scores.

## Entregue

Esta aula produz `outputs/skill-vision-rag-designer.md`. Dado um projeto de RAG de documentos, escolhe ColPali / ColQwen2 / VisRAG / RAG de texto e dimensiona o armazenamento.

## Exercícios

1. Um relatório anual de 200 páginas com 729 patches por página, embeddings de 128 dim, floats de 4 bytes. Compute armazenamento bruto e comprimido por PQ (8x).

2. MaxSim é Σ_i max_j cos(q_i, p_j). O que essa soma captura que uma simples similaridade média não captura?

3. ColPali indexa páginas como conjuntos de patches. O que muda se indexarmos no nível de palavra (como o ColBERT faz)? Trade-offs?

4. Projete o pipeline end-to-end para um corpus de 1M de páginas com orçamento de latência de 500ms por query. Escolha ColQwen2 / VisRAG e justifique.

5. Leia M3DocRAG (arXiv:2411.04952). Descreva o padrão de attention multi-página e como difere da busca single-page do ColPali.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|------------------------|--------------------------|
| Late interaction | "Estilo ColBERT" | Busca usando embeddings por token ou por patch + MaxSim, não um único vetor do documento |
| MaxSim | "Max-sobre-patches" | Para cada token de query, pegar o token de documento de maior similaridade; somar entre queries |
| Bi-encoder | "Vetor único" | Um vetor por documento; mais rápido mas perde granularidade |
| Multi-vetor | "Muitos-vetores-por-doc" | Armazenar N_p vetores por documento / página; custo de armazenamento cresce mas recall melhora |
| Embedding de patch | "Feature de página" | Um vetor por patch de imagem de um encoder VLM, em cache por página |
| ViDoRe | "Benchmark de documentos visuais" | Suíte de benchmarks do ColPali para busca de documentos visuais |
| Quantização PQ | "Product quantization" | Compressão que mantém similaridade entre vetores enquanto reduz armazenamento ~8x |

## Leitura Adicional

- [Faysse et al. — ColPali (arXiv:2407.01449)](https://arxiv.org/abs/2407.01449)
- [Khattab & Zaharia — ColBERT (arXiv:2004.12832)](https://arxiv.org/abs/2004.12832)
- [Yu et al. — VisRAG (arXiv:2410.10594)](https://arxiv.org/abs/2410.10594)
- [Cho et al. — M3DocRAG (arXiv:2411.04952)](https://arxiv.org/abs/2411.04952)
- [illuin-tech/colpali GitHub](https://github.com/illuin-tech/colpali)
