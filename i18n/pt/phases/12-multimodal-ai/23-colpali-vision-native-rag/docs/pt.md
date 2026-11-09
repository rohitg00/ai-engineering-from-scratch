# ColPali e RAG do documento nativo da visão

> O RAG tradicional paralisa PDFs em texto, divide em pedaços, incorpora pedaços, armazena vetores. Cada passo perde o sinal: OCR deixa cair os dados do gráfico, o fragmentação rompe as linhas da tabela, os incorporados de texto ignoram os números. ColPali (Faysse et al., Julho 2024) fez a pergunta mais simples: por que extrair texto? Embed a imagem da página diretamente através do PaliGemma, use a interação tardia de estilo ColBERT para recuperação e mantenha todos os layout, figuras, fontes e sinal de formatação que o documento carrega. Referências publicadas: 20-40% melhor precisão de ponta a ponta do que o texto-RAG em documentos ricos em visão. O ColQwen2, o ColSmol e o VisRAG alargaram o padrão. Esta lição lê a tese RAG visual nativa e constrói um pequeno índice ColPali-like.

**Type:** Build
**Languages:** Python (stdlib, multi-vector indexer + MaxSim scorer), TypeScript
**Prerequisites:** Phase 11 (LLM Engineering — RAG basics), Phase 12 · 05 (LLaVA)
**Time:** ~180 minutes

## Objetivos de aprendizagem

- Explique a diferença entre a recuperação de bi-encoder (um vetor por documento) e a recuperação de interação tardia (muitos vetores por documento).
- Descreva a operação MaxSim do ColBERT e como o ColPali a generaliza de tokens de texto para correções de imagem.
- Construa um pequeno índice ColPali: página → inserções de patch → MaxSim sobre inserções de query term → top-k páginas.
- Compare o gerador ColPali + Qwen2.5VL versus texto-RAG + GPT-4 em um caso de uso de faturas / relatórios financeiros.

## O problema

O texto-RAG em PDFs descarta a maior parte do documento. O crescimento de receita do terceiro trimestre de um relatório financeiro é geralmente em um gráfico; as conclusões de um relatório médico são em imagens anotadas; o bloco de assinatura de um contrato legal é um fato de layout, não um fato de texto.

O canal de texto-RAG:

1. PDF → texto através de OCR / pdftotext.
2. Texto → 300-500 pedaços de tokens.
3. Chunk → bi-encoder embutida (um vetor).
4. Pergunta de usuário → inserção → semelhança cosínica → pedaços top-k.
5. Câncer + consulta → Mestrado em Direito.

Cinco passos perdidos, gráficos não capturados, tabelas divididas em pedaços, layout de várias colunas aplanado, anotações de figuras desaparecem.

Corrigir com o ColPali: pular o OCR, incorporar a imagem da página diretamente. Use interação tardia no estilo ColBERT para recuperação para que o modelo possa atender a correções de grãos finos no momento da consulta.

## O conceito

### Colbert (2020)

ColBERT (Khattab & Zaharia, arXiv:2004.12832) é um método de recuperação de texto. Em vez de um vetor por documento, ele produz um vetor por token.

- Os tokens de consulta têm as suas próprias incorporações ($N_q$(Vetores).
- Os tokens de documentos recebem embutidos ($N_d$Vectores, normalmente armazenados em cache).
- Score = soma sobre os tokens de consulta de max sobre os tokens de documento de similaridade cosínica: $\sum_i \max_j \cos(q_i, d_j)$- Não .

Esta é a operação MaxSim. Cada token de consulta "põe" o seu melhor correspondente documento token.

Pros: forte recall, lida com semântica de nível de termos.$N_d$Vectores por documento, armazenamento caro.

### ColPali

ColPali (Faysse et al., arXiv:2407.01449) aplica o padrão ColBERT às imagens.

- Cada página é codificada por PaliGemma (linguagem ViT +) em embalagens de correio: $N_p$Vectores por página.
- Cada consulta de usuário (texto) é codificada em embutidos de query-token: $N_q$Vectores.
- Resultado = $\sum_i \max_j \cos(q_i, p_j)$, ou seja, MaxSim sobre query-text-tokens e página-imagem-parches.
- Retirando as páginas de topo por pontuação total.

No momento da ingestão de documentos: embebebedar cada página com PaliGemma, armazenar todas as incorporações de patch. No momento da consulta: embebedar os tokens de consulta, calcular MaxSim contra todas as incorporações de página armazenadas, retornar páginas top-k.

Pros: end-to-end supera o texto-RAG em 20-40% em documentos visualmente ricos. Cada patch-vector capta o layout e o conteúdo local.

Cons: $N_p$Parches × 4 bytes flutuantes × $D$- dim vectores por página = armazenamento cresce rapidamente.

### ColQwen2 e ColSmol

ColQwen2 (illuin-tech, 2024-2025) troca PaliGemma por Qwen2-VL. Melhor codificador base, melhor recuperação.

O ColSmol é a variante de menor escala para uso local / borda. Um retriever ColSmol com parâmetros ~ 1B é executado em GPU de consumo.

### VisRAG

VisRAG (Yu et al., arXiv:2410.10594) é uma variante diferente: em vez de MaxSim em patches, agrupar cada página em um único vetor com um VLM e, em seguida, recuperar bi-encoder.

A compensação qualidade/custo: ColPali para qualidade, VisRAG para escala.

### M3DocRAG

M3DocRAG (Cho et al., arXiv:2411.04952) estende a recuperação multimodal para o raciocínio multimodal de várias páginas.

### ViDoRe  o índice de referência

O ColPali é um banco de referência para a avaliação visual de recuperação de documentos. As tarefas incluem relatórios financeiros, artigos científicos, documentos administrativos, registros médicos, manuais.

ColPali-v1 marca ~80% nDCG@5 no ViDoRe; texto-RAG nos mesmos documentos marca ~50-60%.

### O gasoduto RAG de ponta a ponta

Para um RAG nativo de visão:

1. Ingest: PDF → imagens de página → codificação PaliGemma → armazenar todos os incorporados de correio.
2. Query: texto de usuário → embutidos de tokens de consulta → MaxSim contra todas as páginas indexadas → páginas top-k.
3. Gerar: imagens de página top-k + consulta → VLM (Qwen2.5-VL ou Claude) → resposta.

Não há OCR em nenhum lugar, figuras, gráficos, fontes, layout tudo fluem para a resposta.

### Matemática de armazenamento

Um relatório financeiro de 50 páginas com 729 patches por página e embutidos em 128 dimensões:

- ColPali: 50 * 729 * 128 * 4 bytes = ~ 18 MB crus, ~ 2,3 MB após 8x PQ.
- Text-RAG: 50 pedaços * 768-dim * 4 bytes = ~ 150 kB.

O ColPali é ~ 120x mais armazenamento por documento bruto. Em escala, 8x OPQ / PQ reduz para ~ 15x, geralmente tolerável.

### Quando o texto-RAG ainda vence

- Documentos de texto puro sem sinal de layout (articles wiki, logs de chat).
- Arquivos de milhões de páginas onde o armazenamento domina o custo.
- Requisitos regulamentares rigorosos que exigem texto extraível de OCR ao lado da recuperação.

Para tudo o mais em 2026  relatórios financeiros, artigos científicos, contratos legais, registros médicos, documentação UX  RAG vision-native ganha.

```figure
mm-maxsim
```

## Usá-lo

`code/main.py`- Não .

- Encoder de patch de brinquedo: mapeia uma "página" (pequena grade de vetores de características) para uma série de inserções de patch.
- Scorer MaxSim: calcula a pontuação de estilo ColBERT entre um conjunto de inserção de token de consulta e um conjunto de patches de página.
- Indica 5 páginas de brinquedos, faz 3 consultas, retorna o top-k com pontuações.

## Envia-o

Esta lição produz`outputs/skill-vision-rag-designer.md`. Tendo em conta um projecto de documento-RAG, escolhe ColPali / ColQwen2 / VisRAG / text-RAG e dimensionar o armazenamento.

## Exercícios

1. Um relatório anual de 200 páginas, com 729 parches por página, emblem de 128 dimensões, flutuantes de 4 bytes.

2. MaxSim é $\sum_i \max_j \cos(q_i, p_j)$O que é que esta soma capta que uma semelhança simples não significa?

3. O ColPali indexa páginas como conjuntos de correções. Que mudanças se indexarmos no nível da palavra (como o ColBERT faz)?

4. Desenhar o pipeline de ponta a ponta para um corpus de 1M de página com um orçamento de latência de 500ms por consulta. Escolha ColQwen2 / VisRAG e justifique.

5. Leia M3DocRAG (arXiv:2411.04952). Descreva o padrão de atenção de várias páginas e como ele difere da recuperação de ColPali de uma única página.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Late interaction | "ColBERT-style" | Retrieval using per-token or per-patch embeddings + MaxSim, not a single doc vector |
| MaxSim | "Max-over-patches" | For each query token, pick the highest-similarity document token; sum across query |
| Bi-encoder | "Single-vector" | One vector per document; faster but loses granularity |
| Multi-vector | "Many-vectors-per-doc" | Store $N_p$ vectors per document / page; storage cost grows but recall improves |
| Patch embedding | "Page feature" | One vector per image patch from a VLM encoder, cached per page |
| ViDoRe | "Vision doc bench" | ColPali's benchmark suite for visual document retrieval |
| PQ quantization | "Product quantization" | Compression that maintains vector similarity while shrinking storage ~8x |

## Mais leitura

- [Faysse et al. — ColPali (arXiv:2407.01449)](https://arxiv.org/abs/2407.01449)
- [Khattab & Zaharia — ColBERT (arXiv:2004.12832)](https://arxiv.org/abs/2004.12832)
- [Yu et al. — VisRAG (arXiv:2410.10594)](https://arxiv.org/abs/2410.10594)
- [Cho et al. — M3DocRAG (arXiv:2411.04952)](https://arxiv.org/abs/2411.04952)
- [illuin-tech/colpali GitHub](https://github.com/illuin-tech/colpali)
