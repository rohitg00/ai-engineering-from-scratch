# Recuperação multimodal de RAG e Cross-Modal

> O documento RAG é uma fatia. A RAG multimodal de produção vai mais amplo  a recuperação de texto, imagens, áudio e vídeo para fluxos de trabalho como planejamento de viagens ("encontrar-me um brunch vegano tranquilo com luz natural"), triagem médica ("o que a lesão corresponde a esta foto + essas notas"), comércio eletrônico ("vestimentos semelhantes a esta selfie, no meu tamanho"), e serviço de campo ("diagnóstico este som do motor mais foto da parte"). Três pesquisas de 2025  Abootorabi et al., Mei et al., Zhao et al.  codificou os subproblemas: recuperação transmodal, fusão de recuperação, fixação da geração, avaliação multimodal. Esta lição lê as pesquisas e desenha um pipeline de produção.

**Type:** Build
**Languages:** Python (stdlib, cross-modal retriever with fusion + grounded generator), TypeScript
**Prerequisites:** Phase 12 · 23 (ColPali), Phase 11 (RAG basics)
**Time:** ~180 minutes

## Objetivos de aprendizagem

- Desenho de recuperação transmodal: texto → imagem, imagem → texto, áudio → vídeo, etc.
- Comparar três estratégias de fusão: fusão de pontuação, fusão baseada na atenção, fusão MoE.
- Explique a base de geração: como é que "citar as suas fontes" se as fontes são uma mistura de modalidades.
- Cite as três pesquisas canônicas multimodal do RAG de 2025 e a sua taxonomia subproblemática.

## O problema

O RAG de modalidade única é um padrão resolvido: inserir consulta, inserir pedaços, recuperar, coisas em LLM. O RAG multimodal requer:

1. Múltiples cabeças de recuperação (cada modalidade precisa de inserções num espaço compatível).
2. A fusão dos resultados de recuperação em diferentes modalidades.
3. A geração de terra que cita fontes em todas as modalidades.
4. Metricas de avaliação que cobrem o sinal transmodal.

As pesquisas de 2025 chegam todas à mesma taxonomia.

## O conceito

### Recuperação transmodal

Retirar documentos da modalidade B em resposta a uma consulta da modalidade A. Três padrões:

1. Espaço de inserção compartilhado. CLIP e CLAP produzem inserções de texto + imagem / texto + áudio em um espaço compartilhado. A semelhança de cosina entre modalidades funciona diretamente. Limitado a pares treinados CLIP.

2. Encoder de per-modalidade + tradução. Encoder de texto + encoder de imagem + um pequeno módulo de tradução mapeando entre espaços. Sen2Sen por Gupta et al. e outros projetos de 2024.

3. O VLM como codificador. Use os estados ocultos de um VLM como a representação de recuperação. Qualquer modalidade que o VLM suporta funciona.

Opção: CLIP / SigLIP 2 para texto+imagem; CLAP para texto+áudio; VLM-estados ocultos para cross-modal em qualidade de fronteira.

### Estratégias de fusão

Você recuperou 10 resultados: 5 imagens, 3 passagens de texto, 2 áudio clips. Como você merge?

Fusão de pontuação (mais barata). Cada modalidade tem seu próprio retriever, cada um retorna pontuações. Normalize pontuações dentro da modalidade e depois soma.

Fusão baseada na atenção, concatenar todos os itens recuperados, deixar uma pequena rede de atenção pesá-los.

Fusão MoE. Gating de rotas de rede para especialistas específicos de modalidade. Diferentes tipos de consulta percorrem de forma diferente  uma pergunta visual pesa imagens mais altas.

Produzção padrão: pontuação de fusão com um leve viés em direção à modalidade dominante da consulta. Atualização para MoE se A / B mostra vitórias claras em seu domínio.

### Aterrização de geração

A MLL deve indicar qual item recuperado motivou cada reivindicação.

- Fonte de texto: citação padrão `[1]`- Não .
- Fonte de imagem: `[img 3]`com uma legenda curta.
- Áudio: `[audio 2 at 0:34]`- Não .

Treinar o gerador com dados de base: cada afirmação no alvo de treinamento é marcada com o índice de origem.

### Os inquéritos de 2025

Abootorabi et al. (arXiv:2502.08826, "Ask in Any Modality"): taxonomia para RAG multimodal. Abrange recuperação, fusão, geração. Cobertura mais ampla.

Mei et al. (arXiv:2504.08748, "A Survey of Multimodal RAG"): concentra-se em benchmarks de sub-tarefa e modos de falha. Útil para o projeto de avaliação.

Zhao et al. (arXiv:2503.18016): pesquisa focada na visão.

A leitura de todos os três dá-lhe o estado da arte à primavera de 2025.

### MuRAG  o documento de fundação

MuRAG (Chen et al., 2022) foi o primeiro RAG multimodal. Retirou imagem + texto de um KB multimodal, gerou respostas. Mostrou viabilidade antes da onda VLM. Sistemas modernos (REACT, VisRAG, M3DocRAG) construíram sobre isso.

### Um exemplo de planeador de viagens de produção

Pergunta: "Encontre-me um almoço vegano tranquilo com luz natural".

- O canal de condução:

1. Descompõe a consulta. "quiet" → palavra-chave de áudio/revisão; "vegan brunch" → item do menu; "luz natural" → recurso de imagem.
2. Retirada por modalidade:
   - Recuperação de texto em comentários: "brunch vegetariano, ambiente tranquilo".
   - Retorno de imagem em fotos de restaurantes: "luz natural, ar".
   - Recuperação de áudio em clips de som ambiente: "baixo decibel, sem música".
3. Cada restaurante tem uma pontuação composta.
4. Restaurantes Top-k → gerador VLM com todas as evidências → resposta com citações.

Cada modalidade adiciona um sinal que só o texto perde.

### Agentes de RAG multimodal

Multi-hop: se a primeira recuperação não retorna respostas de alta confiança, o LLM reformula e recupera novamente.

- Retrieve top-10 inicial → LLM pede "muito barulhento, filtro para <40 dB" → retrieve.
- Retrieve imagens → LLM vê que um tem um menu → retrieve o texto do menu → resposta.

Adiciona complexidade, mas lida com consultas que a recuperação de um só tiro não pode.

### Avaliação

A avaliação transmodal ainda é imatura.

- Recall@k por modalidade.
- Precuração top-k combinada.
- A satisfação de ponta a ponta, julgada pelo homem.
- Função específica (reservas completas, compras feitas).

Não existe uma referência padrão que abranja todas as modalidades.

```figure
contrastive-matrix
```

## Usá-lo

`code/main.py`- Não .

- Três retrievers falsos (texto, imagem, áudio) operando em um corpo compartilhado de restaurantes.
- Fusão de pontuação que combina pontuações de modalidade com pesos configuráveis.
- Um botão de gerador que emite uma resposta final com citações.
- Um simples ciclo agente que reformula a consulta se a confiança for baixa.

## Envia-o

Esta lição produz`outputs/skill-multimodal-rag-designer.md`- Uma especificação de produto com um fluxo de consulta multimodal, desenhos de retrievers, fusão, gerador e avaliação.

## Exercícios

1. Propõe um RAG multimodal de triagem médica: consulta = foto de lesão + sintomas de texto. Que modalidades extrair de que KB?

2. A fusão de pontuação é uma soma ponderada simples.

3. Leia a taxonomia de Abootorabi et al. (Secção 3). Quais são os três subproblemas canônicos e como se relacionam com o produto escolhido?

4. Desenhar uma especificação de avaliação para um RAG multimodal de planejamento de viagens. Que métricas cobrem a memória de imagem, a memória de áudio e a corretão composta?

5. O RAG multi-hop agencial tem um imposto de latência por viagem de ida e volta. Em que dificuldade de consulta o ganho de precisão justifica a latência?

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Cross-modal retrieval | "Query one modality, retrieve another" | Text query retrieves images; image query retrieves text; requires a shared space or translator |
| Score fusion | "Combine scores" | Weighted sum of per-modality retrieval scores; simplest fusion |
| MoE fusion | "Modality-routed experts" | Gating network picks which modality's scores to trust per query |
| Grounded generation | "Cite your sources" | Each claim in the answer tagged with the source index |
| MuRAG | "First multimodal RAG" | 2022 paper that established the multimodal RAG pattern |
| Agentic multi-hop | "Reformulate and retry" | LLM re-queries retrievers when first-pass confidence is low |

## Mais leitura

- [Abootorabi et al. — Ask in Any Modality (arXiv:2502.08826)](https://arxiv.org/abs/2502.08826)
- [Mei et al. — A Survey of Multimodal RAG (arXiv:2504.08748)](https://arxiv.org/abs/2504.08748)
- [Zhao et al. — Vision RAG Survey (arXiv:2503.18016)](https://arxiv.org/abs/2503.18016)
- [Chen et al. — MuRAG (arXiv:2210.02928)](https://arxiv.org/abs/2210.02928)
- [Liu et al. — REACT (arXiv:2301.10382)](https://arxiv.org/abs/2301.10382)
