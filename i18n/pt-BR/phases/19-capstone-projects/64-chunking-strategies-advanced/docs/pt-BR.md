# Estratégias de desmantelamento, comparadas

> O Chunking decide o que o seu retriever pode fazer, e não há um modelo de inserção, nenhum re-ranqueador, nenhum LLM pode reparar os danos.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 11 lessons 04 (embeddings), 06 (RAG), 07 (advanced RAG); Phase 19 Track B foundations (lessons 20-29)
**Time:** ~90 minutes

## Objetivos de aprendizagem
- Implementar cinco estratégias de fragmentação a partir do zero: janela fixa, frase, divisão recursiva, agrupamento semântico e cabeçalhos de marcada estrutural.
- Meter recall@k num corpus de elementos com intervalos de resposta de marcação de ouro e explicar por que uma estratégia vence a prosa e uma estratégia diferente vence os documentos técnicos.
- Leia uma distribuição de comprimento de pedaços e reconheça os modos de falha que cada estratégia injeta: frases órfãs, cortes de símbolo médio, pedaços apenas em cabeçalhos, deriva semântica.
- Escolha um padrão para um novo corpus sem executar o índice de referência, inspecionando três propriedades: tipo de documento, comprimento médio de parágrafo e se o formato tem estrutura explícita.

## O problema

Cada linha de RAG começa cortando documentos de origem em pedaços pequenos o suficiente para que um modelo de incorporação se encaixe neles e grandes o suficiente para que cada peça carregue uma ideia autocontida.

Uma consulta que pergunte "como é o limite de interrupção do orçamento" só pode ser bem sucedida se o limite de interrupção for alcançável. Se o divisor de janela fixa cortar o valor de limiar do contexto circundante, o incorporado se muda para um cluster diferente, a pontuação BM25 cai, os re-ranqueadores veem ruído e a resposta gerada pelo LLM é errada. O artigo de 2024 "LongRAG: Enhancing Retrieval-Augmented Generation with Long-Context LLMs" mediu um swing absoluto de 35% na recuperação de recall puramente a partir da escolha de fragmentos. O trabalho de acompanhamento em 2025 sobre cabeçalhos contextuais reduziu a lacuna, mas não a fechou.

Esta lição constrói cinco estratégias lado a lado, as compara com um corpus de equipamentos com intervalos de resposta com rótulos de ouro, e permite-lhe ler os números de recall por si mesmo.

## O conceito

```mermaid
flowchart LR
  Doc[Source Document] --> S1[Fixed Window]
  Doc --> S2[Sentence]
  Doc --> S3[Recursive Split]
  Doc --> S4[Semantic Cluster]
  Doc --> S5[Structural Markdown]
  S1 --> Chunks1[Chunks]
  S2 --> Chunks2[Chunks]
  S3 --> Chunks3[Chunks]
  S4 --> Chunks4[Chunks]
  S5 --> Chunks5[Chunks]
  Chunks1 --> Index[Embedding Index]
  Chunks2 --> Index
  Chunks3 --> Index
  Chunks4 --> Index
  Chunks5 --> Index
  Index --> Eval[Recall@k vs Gold Spans]
```

### Janela fixa

A linha de base da força bruta. Corte todos os caracteres N. Opcionalmente se sobrepõem para que uma frase cortada na posição N apareça inteira dentro do pedaço que começa na posição N - se sobrepõem. Rápido, determinista, terrível nas fronteiras. Use-o como um controle, não como padrão.

### Sentença

Divida os limites das frases com um regex ou uma máquina de estado simples. Encha uma ou mais frases em um pedaço até um orçamento de caracteres alvo. Pare de cortar a metade da palavra. Ainda corta a metade do parágrafo e a metade da seção. O padrão em muitos primeiros canais de RAG e uma escolha razoável para a prosa sem outra estrutura.

### Divisão recorrente

A estratégia de hierarquia popularizada pelas bibliotecas da era de 2023 . Tente dividir no separador mais forte primeiro (linha nova dupla, parágrafo), cair de volta para o próximo (linha nova única), depois para frases, depois para caracteres. A recorrência termina quando o pedaço se encaixa no orçamento.

### Clustering semântico

Embed cada frase. Cluster frases contíguas que compartilham um tema centróide. Corte sempre que a semelhança corrente com o centroide cai abaixo de um limiar. Os limites refletem significado, não caracteres. Mais lento de construir e dependente do modelo de embebimento, mas resistente contra documentos que mudam de tópicos dentro de um parágrafo.

### Títulos de marcas estruturais

Para documentos que possuem estrutura explícita (marcação, texto reestruturado, seções numeradas no estilo RFC), corte nos limites do título. Cada peça se torna o título mais tudo abaixo dele até o próximo título no mesmo ou nível superior. Pequenas peças por tópico, mas só disponíveis quando o corpus está bem formado.

### Como recall@k mede a escolha de limites

Uma consulta com rótulo ouro contém as despezas exatas de caracteres do intervalo de respostas dentro do documento fonte. Depois de pedalar, perguntam: algum dos pedaços de cima que o retriever devolveu se sobrepõem ao espaço de ouro? Se sim, recall@k para essa consulta é 1. Se não, é 0. Mediana ao longo do conjunto de consultas. Faça a mesma avaliação para cada estratégia e o spread mostra-lhe qual política de fronteira sobrevive ao corpus que você tem.

```figure
ci-chunk-boundaries
```

## Construí-lo

`code/main.py`Implementos:

- `fixed_window(text, size, overlap)`- A linha de base.
- `sentence_chunks(text, target)`- Um simples packer de frases.
- `recursive_split(text, separators, target)`- recursão hierárquica.
- `semantic_chunks(text, similarity_threshold)`- agrupamento baseado em centróides em cima de uma simulação determinista de inserção.
- `structural_markdown(text)`- Divisor de cabeçalhos.
- `mock_embed(text, dim)`- um hash baseado em embutidos para o loop correr offline.
- `DenseIndex`- a mesma forma usada na aula de recuperação híbrida da pista B da fase 19.
- `eval_recall(strategy, corpus, queries, k)`- o ciclo de comparação.
- A.`main()`que executa todas as estratégias no corpus de fixação e imprime uma tabela recall@k.

- É o que é ?

```bash
python3 code/main.py
npx tsx code/main.ts
```

A saída é uma pequena tabela com uma linha por estratégia e uma coluna por k. A sentença perde na fixação estruturada. A marcação estrutural vence na fixação de marcada. O recursivo mantém o seu próprio na fixação mista porque a recursião se adapta. O agrupamento semântico vence na fixação de prosa onde não há pistas estruturais úteis.

## Modos de falha a mesa não se esconderá

**Orphan sentences.**O encomenda de frases produz pedaços que perdem a frase do tópico.

**Mid-symbol cuts.**O código interno da janela fixa ou YAML divide um identificador em duas metades.

**Header-only chunks.**A marcadação estrutural emite um pedaço que não contém nada além de`## Title`Filtra-as ou anexe o primeiro parágrafo do próximo pedaço.

**Semantic drift.**Clustering semântico subcuts quando o corpo é uniformemente sobre o tópico. Um pedaço de 5000 caracteres empacotar muitas respostas específicas em um incrustamento difuso. Combine semântica com um chapéu de caracteres duros.

**Stale embeddings.**Clustering semântico usa um modelo de incorporação. Se você mudar o modelo, você também muda os pedaços. Pin o modelo de pedaço separadamente do modelo de recuperação ou reconstruir o índice juntos.

## Escolher um padrão sem executar o índice de referência

Três propriedades decidem o chunker padrão para um novo corpus.

| Property | Value | Default |
|----------|-------|---------|
| Document type | Prose with no structure | Recursive split, target 800 |
| Document type | Markdown / RFC / API docs | Structural markdown |
| Document type | Code | AST-aware (out of scope; see Phase 19 lesson 02) |
| Paragraph length | Long, single topic | Sentence, target 500 |
| Paragraph length | Short, mixed topics | Semantic, threshold 0.6 |

Quando estiver em dúvida, escolha a divisão recursiva. É a base de estratégia única mais forte.

## Usá-lo

Padrões de produção:

- Execute a avaliação antes de enviar um novo pipeline; não confie na estratégia que a sua biblioteca utiliza por defeito.
- Re-exerça a avaliação sempre que mudar o modelo de incorporação ou o mix de corpus; o vencedor é corpus-dependente.
- Permaneça o nome da estratégia nos metadados de cada pedaço para que possa atribuir regressões mais tarde.

## Envia-o

O sistema RAG de ponta a ponta da pista F na lição 69 usa o chunker selecionado aqui como sua primeira etapa.`eval_recall`Escolha a estratégia que vencer no seu corpo e dá-lhe uma resposta.

## Exercícios

1. Adicionar uma sexta estratégia: token-window usando `tiktoken`Comparar com a janela fixa no mesmo dispositivo.
2. Injecte uma fração de 30% de blocos de código na prosa, reencontre a tabela, explique porque todas as estratégias, exceto as marcadas estruturais, perdem a memória.
3. Substitua a incorporação determinista pela da empresa fornecedora real do seu projeto. Messa o delta de recall de agrupamento semântico. Relata se a diferença entre as estratégias aumenta ou diminui.
4. Adicionar um`summary`campo por peça: uma descrição centróide de uma frase. Reexercar a avaliação com o resumo anexado ao corpo da peça. Medir o levantamento de recall.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Recall@k | "Did we get the right chunk?" | Fraction of queries where any of the top-k chunks overlaps the gold answer span |
| Chunk overlap | "Sliding window" | Re-include the last N characters of the previous chunk in the next chunk |
| Structural splitter | "Header-aware chunks" | Cut at H1/H2/H3 boundaries; the heading text is part of the chunk |
| Semantic chunker | "Topic-aware chunks" | Embed sentences, cluster by centroid similarity, cut on drift |
| Centroid drift | "Topic shift" | Cosine similarity between the running mean and the next sentence drops past a threshold |

## Mais leitura

- [LongRAG: Enhancing Retrieval-Augmented Generation with Long-context LLMs (arXiv 2406.15319)](https://arxiv.org/abs/2406.15319)
- [Anthropic, Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval)
- [LlamaIndex, Chunking strategies for production RAG](https://docs.llamaindex.ai/en/stable/optimizing/production_rag/)
- Fase 11 lição 06 - Fundamentos do RAG
- Fase 11 lição 07 - RAG avançado
- Fase 19 lição 65 - recuperação híbrida que classifica os pedaços produzidos aqui
- Fase 19 lição 68 - o valor de avaliação que marca a escolha de estratégia na produção
