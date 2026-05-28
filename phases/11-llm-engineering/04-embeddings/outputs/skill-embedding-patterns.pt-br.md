---
name: skill-embedding-patterns
description: Padrões de produção para incorporações, pesquisa vetorial e similaridade
version: 1.0.0
phase: 11
lesson: 4
tags: [embeddings, vectors, similarity, search, chunking, quantization]
---

# Padrões de incorporação

Todo fluxo de trabalho de incorporação segue este contrato:

```
text -> embed(text) -> vector (float array)
similarity(vector_a, vector_b) -> score (float)
```

O modelo de incorporação e a métrica de similaridade são as duas únicas decisões que importam. Todo o resto é encanamento.

## Quando usar incorporações

- Pesquisa semântica em documentos (encontre significado, não palavras-chave)
- Agrupamento de itens semelhantes (tickets de suporte, análises de produtos, relatórios de bugs)
- Classificação por vizinhos mais próximos (rotular novos itens por semelhança com exemplos rotulados)
- Sistemas de recomendação (encontre itens semelhantes ao que o usuário gostou)
- Desduplicação (encontre conteúdo quase duplicado usando limite de similaridade)

## Quando NÃO usar embeddings

- Correspondência exata de palavras-chave (use pesquisa de texto completo)
- Consultas estruturadas (use SQL, filtros)
- Pequenos conjuntos de dados onde a rotulagem manual é mais rápida (<100 itens)
- Tarefas onde a explicabilidade é mais importante do que a precisão (os embeddings são opacos)

## Seleção de modelo

Escolha com base em suas restrições:

- **Precisa de uma API, melhor valor**: OpenAI text-embedding-3-small (1536d, US$ 0,02/1 milhão de tokens)
- **Precisa de precisão máxima**: Voyage-3 (1024d, tokens de US$ 0,06/1 milhão, MTEB mais alto)
- **Precisa de local/privado**: BGE-M3 (1024d, gratuito, multilíngue, GPU recomendado)
- **Precisa de prototipagem local rápida**: all-MiniLM-L6-v2 (384d, gratuito, roda em CPU)
- **Precisa de multilíngue**: Cohere embed-v3 (1024d) ou BGE-M3 (ambos multilíngues fortes)

Regra: nunca misture modelos de incorporação entre indexação e consulta. Vetores de diferentes modelos vivem em espaços incompatíveis.

## Regras de fragmentação

1. Almeje 256-512 tokens por bloco com sobreposição de 50 tokens
2. Nunca divida uma frase no meio se puder evitá-lo
3. Incluir metadados (arquivo de origem, título da seção, posição) em cada bloco
4. Para documentos estruturados (Markdown, HTML), divida primeiro nos limites do título
5. Teste a qualidade do bloco procurando respostas conhecidas e verificando a recuperação

## Seleção de métricas de similaridade

- **Semelhança de cosseno**: escolha padrão, lida com texto de comprimento variável, normalizado
- **Produto escalar**: use quando os vetores já estão normalizados por unidade (os modelos OpenAI são), um pouco mais rápido
- **Distância euclidiana**: use para agrupamento, quando a posição absoluta é importante

Todos os três fornecem a mesma classificação quando os vetores são normalizados. A escolha só importa para vetores não normalizados.

## Otimização de armazenamento

Três níveis de compressão, empilháveis:

1. **Truncamento Matryoshka**: reduzir dimensões (1536 -> 256 = economia de 6x, perda de precisão de 3-5%)
2. **Quantização Float16**: reduza pela metade o armazenamento por dimensão (economia de 2x, perda de precisão <1%)
3. **Quantização binária**: 1 bit por dimensão (economia de 32x, perda de precisão de 5 a 10%, uso com nova pontuação)

Padrão de produção: pesquisa binária em corpus completo, rescore top-1000 com vetores float32.

## Recuperar e reclassificar

Pipeline de dois estágios para melhor precisão:

1. O bi-codificador recupera os 100 principais candidatos (rápido, usa embeddings pré-computados)
2. O codificador cruzado é reclassificado para os 10 primeiros (lento, processa cada par consulta-documento)

Isso supera a recuperação de estágio único em 10-15% em métricas de precisão. Use quando a precisão for mais importante do que a latência.

## Erros comuns

- Usando diferentes modelos de incorporação para indexação e consulta
- Incorporação de documentos inteiros em vez de pedaços (a incorporação torna-se uma média de tudo)
- Não normalizar vetores antes da similaridade de cossenos (a maioria dos modelos pré-normaliza, mas verifica)
- Ignorar a sobreposição de pedaços (frases divididas nos limites perdem contexto)
- Armazenando apenas vetores sem o texto original (você precisa de ambos para recuperação)
- Não reincorporar quando o modelo muda (vetores antigos são incompatíveis)
- Escolher dimensões com base apenas na precisão (armazenamento e escala de latência linearmente com dimensões)

## Depurando incorporações

Se os resultados da pesquisa forem ruins:

1. Verifique se a incorporação da consulta é diferente de zero (a entrada vazia ou com espaço em branco produz vetores zero)
2. Verifique manualmente a pontuação de similaridade de um documento relevante
3. Tente reformular a consulta para corresponder ao vocabulário do documento
4. Inspecione os limites dos blocos para garantir que o conteúdo relevante não seja dividido entre os blocos
5. Compare os principais resultados entre métricas (cosseno, ponto, euclidiano) para detectar problemas de normalização
6. Teste com uma consulta de correspondência trivial (copie uma frase de um documento) para confirmar se o pipeline funciona

## Parâmetros de produção

- Tamanho do pedaço: 256-512 tokens
- Sobreposição de pedaços: 50 tokens (10-20% do tamanho do pedaço)
- Recuperação Top-k: 5-10 para uso direto, 50-100 para reclassificação
- Limite de similaridade: 0,7+ para cosseno (abaixo disso, os resultados geralmente são irrelevantes)
- Incorporação em lote: processe de 100 a 500 textos por chamada de API para obter rendimento
- Reconstrução de índice: reincorpore quando o modelo for alterado ou os documentos forem atualizados significativamente