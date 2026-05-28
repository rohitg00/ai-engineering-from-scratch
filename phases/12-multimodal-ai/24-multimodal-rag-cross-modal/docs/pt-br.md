# RAG Multimodal e Busca Cross-Modal

> RAG de documentos vision-native é um recorte. RAG multimodal em produção vai mais amplo — buscar entre texto, imagens, áudio e vídeo para workflows como planejamento de viagem ("ache um brunch vegano silencioso com luz natural"), triagem médica ("que lesão combina com essa foto + essas anotações"), e-commerce ("looks parecidos com esse selfie, no meu tamanho"), e manutenção de campo ("diagnosticar esse som de motor mais foto da peça"). Três surveys de 2025 — Abootorabi et al., Mei et al., Zhao et al. — codificaram os subproblemas: busca cross-modal, fusão de busca, fundamentação de geração, avaliação multimodal. Esta aula lê os surveys e projeta um pipeline de produção.

**Tipo:** Construção
**Linguagens:** Python (stdlib, recuperador cross-modal com fusão + gerador fundamentado)
**Pré-requisitos:** Fase 12 · 23 (ColPali), Fase 11 (fundamentos de RAG)
**Tempo:** ~180 minutos

## Objetivos de Aprendizado

- Projetar busca cross-modal: texto → imagem, imagem → texto, áudio → vídeo, etc.
- Comparar três estratégias de fusão: fusão por score, fusão baseada em attention, fusão MoE.
- Explicar fundamentação de geração: como "cite suas fontes" funciona quando as fontes são uma mistura de modalidades.
- Nomear os três surveys canônicos de RAG multimodal de 2025 e sua taxonomia de subproblemas.

## O Problema

RAG de modalidade única é um padrão resolvido: embute query, embute chunks, recupera, joga no LLM. RAG multimodal exige:

1. Múltiplas cabeças de busca (cada modalidade precisa de embeddings num espaço compatível).
2. Fusão de resultados de busca entre modalidades.
3. Fundamentação de geração que cite fontes entre modalidades.
4. Métricas de avaliação que cubram sinal cross-modal.

Os surveys de 2025 todos chegam na mesma taxonomia.

## O Conceito

### Busca cross-modal

Recuperar documentos de modalidade B dada uma query de modalidade A. Três padrões:

1. Espaço de embedding compartilhado. CLIP e CLAP produzem embeddings de texto + imagem / texto + áudio num espaço compartilhado. Similaridade cosseno entre modalidades funciona diretamente. Limitado a pares treinados com CLIP.

2. Encoder por modalidade + tradução. Encoder de texto + encoder de imagem + um módulo pequeno de tradução mapeando entre espaços. Sen2Sen de Gupta et al. e outros designs de 2024. Flexível mas adiciona complexidade.

3. VLM como encoder. Usar os hidden states de um VLM como representação de busca. Qualquer modalidade que o VLM suporte funciona. Maior qualidade, mais caro.

Escolha: CLIP / SigLIP 2 pra texto+imagem; CLAP pra texto+áudio; hidden states de VLM pra cross-modal na qualidade de fronteira.

### Estratégias de fusão

Você recuperou 10 resultados: 5 imagens, 3 trechos de texto, 2 clipes de áudio. Como combinar?

Fusão por score (a mais barata). Cada modalidade tem seu próprio recuperador, cada retorna scores. Normalizar scores dentro da modalidade e somar. Simples, geralmente funciona.

Fusão baseada em attention. Concatena todos os itens recuperados, deixa uma rede pequena de attention ponderar. Precisa de treinamento.

Fusão MoE. Rede de gating roteia para experts específicos por modalidade. Diferentes tipos de query roteiam diferente — uma questão visual pondera imagens mais.

Padrão em produção: fusão com score com leve viés para a modalidade dominante da query. Atualize para MoE se A/B mostrar ganhos claros no seu domínio.

### Fundamentação de geração

O LLM deve citar qual item recuperado sustentou cada afirmação. Para multimodal:

- Fonte textual: citação padrão `[1]`.
- Fonte visual: `[img 3]` com uma legenda curta.
- Áudio: `[audio 2 em 0:34]`.

Treine o gerador com dados de fundamentação-aware: cada afirmação no alvo de treinamento é marcada com o índice da fonte. Em inferência, o modelo emite citações naturalmente.

### Os surveys de 2025

Abootorabi et al. (arXiv:2502.08826, "Ask in Any Modality"): taxonomia pra RAG multimodal. Cobre busca, fusão, geração. Cobertura mais ampla.

Mei et al. (arXiv:2504.08748, "A Survey of Multimodal RAG"): foca em benchmarks de subtarefas e modos de falha. Útil pra design de avaliação.

Zhao et al. (arXiv:2503.18016): survey focado em visão. Forte no trabalho da família ColPali.

Ler os três dá o estado da arte até a primavera de 2025. A maioria dos subproblemas ainda está aberta.

### MuRAG — o artigo fundacional

MuRAG (Chen et al., 2022) foi o primeiro RAG multimodal. Recuperou imagem + texto de uma KB multimodal, gerou respostas. Mostrou viabilidade antes da onda de VLMs. Sistemas modernos (REACT, VisRAG, M3DocRAG) se baseiam nele.

### Exemplo de planejador de viagem em produção

Query: "ache um brunch vegano silencioso com luz natural."

Pipeline:

1. Decompor query. "silencioso" → palavra-chave de áudio/review; "brunch vegano" → item de cardápio; "luz natural" → feature de imagem.
2. Buscar por modalidade:
   - Busca textual em reviews: "brunch vegano, ambiente silencioso."
   - Busca visual em fotos de restaurante: "luz natural, arejado."
   - Busca de áudio em clipes de som ambiente: "baixo decibel, sem música."
3. Fusão de scores. Cada restaurante tem um score composto.
4. Top-k restaurantes → gerador VLM com toda evidência → resposta com citações.

Isso vai muito além de RAG de texto. Cada modalidade adiciona sinal que o texto sozinho perde.

### RAG multimodal agentic

Multi-hop: se a primeira busca não retorna respostas de alta confiança, o LLM reformula e busca de novo. Padrões de RAG agentic da Fase 14 se aplicam aqui. Exemplos:

- Recuperar top-10 inicial → LLM pede "muito barulhento, filtrar <40 dB" → buscar de novo.
- Recuperar imagens → LLM vê que uma tem cardápio → recuperar o texto do cardápio → responder.

Adiciona complexidade mas lida com queries que busca single-shot não consegue.

### Avaliação

Avaliação cross-modal ainda é imatura. Substitutos comuns:

- Recall@k por modalidade.
- Acurácia do top-k fundido.
- Satisfação end-to-end avaliada por humanos.
- Específica de tarefa (reservas completadas, compras realizadas).

Nenhum benchmark padrão cobre todas as modalidades. A maioria dos artigos avalia em tarefas específicas de domínio.

## Use

`code/main.py`:

- Três recuperadores simulados (texto, imagem, áudio) operando num corpus compartilhado de restaurantes.
- Fusão por score que combina scores de modalidade com pesos configuráveis.
- Um stub de gerador que emite resposta final com citações.
- Um loop agentic simples que reformula a query se a confiança for baixa.

## Entregue

Esta aula produz `outputs/skill-multimodal-rag-designer.md`. Dada uma spec de produto com fluxo de query multimodal, projeta recuperadores, fusão, gerador e avaliação.

## Exercícios

1. Proponha um RAG multimodal de triagem médica: query = foto da lesão + sintomas textuais. De quais KBs busca quais modalidades?

2. Fusão por score é uma soma ponderada simples. Que modo de falha ela tem que fusão MoE evita?

3. Leia a taxonomia de Abootorabi et al. (Seção 3). Quais são os três subproblemas canônicos e como mapeiam pro seu produto escolhido?

4. Projete uma spec de avaliação para um RAG multimodal de planejador de viagem. Que métricas cobrem recall de imagem, recall de áudio, e correção composta?

5. RAG agentic multi-hop tem um imposto de latência por round-trip. Em que dificuldade de query o ganho de acurácia justifica a latência?

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|------------------------|--------------------------|
| Busca cross-modal | "Query uma modalidade, recuperar outra" | Query textual recupera imagens; query visual recupera texto; exige espaço compartilhado ou tradutor |
| Fusão por score | "Combinar scores" | Soma ponderada dos scores de busca por modalidade; fusão mais simples |
| Fusão MoE | "Experts roteados por modalidade" | Rede de gating escolhe quais scores de modalidade confiar por query |
| Geração fundamentada | "Cite suas fontes" | Cada afirmação na resposta marcada com o índice da fonte |
| MuRAG | "Primeiro RAG multimodal" | Artigo de 2022 que estabeleceu o padrão de RAG multimodal |
| Multi-hop agentic | "Reformular e tentar de novo" | LLM refaz queries aos recuperadores quando confiança da primeira passagem é baixa |

## Leitura Adicional

- [Abootorabi et al. — Ask in Any Modality (arXiv:2502.08826)](https://arxiv.org/abs/2502.08826)
- [Mei et al. — A Survey of Multimodal RAG (arXiv:2504.08748)](https://arxiv.org/abs/2504.08748)
- [Zhao et al. — Vision RAG Survey (arXiv:2503.18016)](https://arxiv.org/abs/2503.18016)
- [Chen et al. — MuRAG (arXiv:2210.02928)](https://arxiv.org/abs/2210.02928)
- [Liu et al. — REACT (arXiv:2301.10382)](https://arxiv.org/abs/2301.10382)
