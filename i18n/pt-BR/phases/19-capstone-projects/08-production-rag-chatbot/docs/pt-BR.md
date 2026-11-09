# Capstone 08  Chatbot RAG de produção para um vertical regulado

> Harvey, Glean, Mendable e LlamaCloud todos têm a mesma forma de produção em 2026. Ingestão com docling ou Unstructured e ColPali para visuais. Busca híbrida. Re-ranquear com Bge-Renanque-V2-gemma. Sintetize com Claude Sonnet 4.7 usando cache rápido com taxa de visualização de 60-80%. Guarda com Guarda Llama 4 e Guarda NeMo. Cuidado com o Langfuse e o Phoenix. Grau com o RAGAS num conjunto de 200 perguntas. Construir um em um domínio regulado (legal, clínico, seguro), e a pedra final está passando o conjunto de ouro, a equipe vermelha, e o painel de deriva.

**Type:** Capstone
**Languages:** Python (pipeline + API), TypeScript (chat UI, pipeline scaffold)
**Prerequisites:** Phase 5 (NLP), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:**P5 · P7 · P11 · P12 · P17 · P18
**Time:** 30 hours

## Problemas

O RAG de domínio regulamentado (contratos legais, protocolos de ensaios clínicos, apólices de seguro) é a forma de produção mais enviada de 2026, porque o ROI é óbvio e as apostas são concretas. Harvey (Allen & Overy) construiu-o para ser legal. O que é louvável é o sabor de um desenvolvedor. O Glean cobre a busca empresarial. O padrão é: ingerir alta fidelidade, recuperar híbrido com re-ranqueamento, sintetizar com aplicação de citações e cache rápida, proteger com várias camadas de segurança e monitorar a deriva continuamente.

As partes difíceis não são o modelo. São a conformidade com a jurisdição (HIPAA, GDPR, SOC2), a auditoria a nível de citação, o controle de custos (o caching rápido compra um desconto de 60-90% quando a taxa de impacto é alta), a detecção de alucinações através da fidelidade RAGAS e a detecção de deriva quando os documentos de origem são atualizados sem o índice acompanhar. Esta pedra fundamental pede-lhe que o envia em um conjunto de 200 perguntas de ouro com uma suite de equipa vermelha ao lado.

## Conceptos

O oleoduto tem dois lados.**Ingestion**O ColPali lida com documentos estruturados; os blocos recebem resumos, tags e etiquetas de acesso baseadas em funções. Os vetores passam para pgvector + pgvector scale (menos de 50M vetores) ou Qdrant Cloud; o BM25 escasso corre ao lado. **Conversation**LangGraph lida com a memória e a multi-turn; cada consulta executa recuperação híbrida, re-ranks com bge-reranker-v2-gemma-2b, sintetizou com Claude Sonnet 4.7 (pronto-cached), passa a saída através de Llama Guard 4 e NeMo Guardrails, e emite uma resposta ancorada em citações.

A pilha de avaliação tem quatro camadas.**Golden set**(200 Q/A com citações) para a correcção. **Red team**(Prisões de prisão, tentativas de extracção de PII, questões fora do domínio) para segurança. **RAGAS**para fidelidade / relevância da resposta / precisão do contexto automaticamente por turno. **Drift dashboard**(Arize Phoenix) assistindo a qualidade da recuperação e a pontuação de alucinação semanalmente.

O caching rápido é a alavanca de custo. Claude 4.5 + e GPT-5 + suportam o sistema de caching + contexto recuperado. A taxa de hits de 60-80%, o custo por consulta cai 3-5 vezes. O pipeline deve ser projetado para prefixos estáveis (sistema de prompt + conteúdo re-ranqueado primeiro) para alcançar altas taxas de hits no cache.

## Arquitetura

```
documents (contracts, protocols, policies)
      |
      v
docling / Unstructured parse + ColPali for visuals
      |
      v
chunks + summaries + role-labels + jurisdiction tags
      |
      v
pgvector + pgvectorscale  +  BM25 (Tantivy)
      |
query + role + jurisdiction
      |
      v
LangGraph conversational agent
   +--- retrieve (hybrid)
   +--- filter by role + jurisdiction
   +--- rerank (bge-reranker-v2-gemma-2b or Voyage rerank-2)
   +--- synthesize (Claude Sonnet 4.7, prompt cached)
   +--- guard (Llama Guard 4 + NeMo Guardrails + Presidio output PII scrub)
   +--- cite + return
      |
      v
eval:
  RAGAS faithfulness / answer_relevance / context_precision (online)
  Langfuse annotation queue (sampled)
  Arize Phoenix drift (weekly)
  red team suite (pre-release)
```

## Estaca

- Ingestão: Unstructured.io ou docling para documentos estruturados; ColPali para PDFs ricas em visão
- DB vetor: pgvector + pgvectorscale inferior a 50M vectors; Qdrant Cloud caso contrário
- Sparse: Tantivy BM25 com pesos de campo
- Orquestração: LlamaIndex Fluxos de trabalho (ingestão) + LangGraph (conversa)
- Re-ranking: bge-re-ranking-v2-gemma-2b auto-hosted ou Voyage rerank-2 hosted
- LLM: Claude Sonnet 4.7 com caché rápido; fallback Llama 3.3 70B auto-hosted
- Eval: RAGAS 0.2 online, DeepEval para alucinações e suites de jailbreak
- Observabilidade: Langfuse auto-hosted com fila de anotações; Arize Phoenix para drift
- Guardrails: Llama Guard 4 classificador de entrada/saída, política NeMo Guardrails v0.12, esgrimação de PII Presidio
- Compliance: rótulos de acesso baseados em funções em blocos; etiquetas de jurisdição para o GDPR/HIPAA

```figure
canary-rollout
```

## Construí-lo

1. **Ingestion.**Partilhe o seu corpus (1000-10000 documentos para uma construção séria) com Unstructured ou docling. Para páginas digitalizadas / visuais pesadas, percorra ColPali. Produza pedaços com resumos, rótulos, tags de jurisdição.

2. **Index.**Embedings densos (Voyage-3 ou Nomic-embed-v2) em pgvector + pgvector escala. BM25 lateral-index via Tantivy. papel e jurisdição filtros como carga útil.

3. **Hybrid retrieve.**Filtrar por função + jurisdição primeiro; então paralelo denso + BM25; fundir com fusão de rango recíproco; top-20 para re-ranquerer; top-5 para sintetizar.

4. **Synthesize with prompt caching.**Promete sistema + políticas estáticas no cabeçalho do cache; conteúdo re-ranqueado como extensão do cache; pergunta do usuário como sufixo não caçado.

5. **Guardrails.**Llama Guard 4 em entrada; NeMo Guardrails bloqueia questões fora do domínio ou tópicos proibidos pela política; Presidio esfrega PII acidental na saída; pós-filtro de execução de citações.

6. **Golden set.**200 pares de perguntas e respostas rotulados por um especialista em domínio com (resposta, citações).

7. **Red team.**50 indicações adversárias: jailbreaks (PAIR, TAP), tentativas de exfiltração de PII, vazamentos fora do domínio, transversais.

8. **Drift dashboard.**Arize Phoenix acompanha a qualidade da recuperação semanalmente.

9. **Cost report.**Langfuse: taxa de hits de caching de prompt, tokens por consulta, $/query por fase.

## Usá-lo

```
$ chat --role=analyst --jurisdiction=GDPR
> what is the data-retention obligation for EU user profiles under our contract?
[retrieve]  hybrid top-20 filtered to GDPR + analyst-role
[rerank]    top-5 kept
[synth]     claude-sonnet-4.7, cache hit 74%, 0.8s
answer:
  The contract (Section 12.4, Master Services Agreement dated 2024-03-11)
  obligates EU user profile deletion within 30 days of termination per GDPR
  Article 17. The DPA amendment (DPA-v2.1, Section 5) extends this to 14 days
  for "restricted" category data.
  citations: [MSA-2024-03-11 s12.4, DPA-v2.1 s5]
```

## Envia-o

`outputs/skill-production-rag.md`Um chatbot de domínio regulamentado implantado com rótulos de conformidade, atravessado pela rubrica, observado com monitoramento de deriva ao vivo.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | RAGAS faithfulness + answer relevance | Online scores on the golden set (200 Q/A) |
| 20 | Citation correctness | Fraction of answers with verifiable source anchors |
| 20 | Guardrail coverage | Llama Guard 4 pass rate + jailbreak suite results |
| 20 | Cost / latency engineering | Prompt-cache hit rate, p95 latency, $/query |
| 15 | Drift monitoring dashboard | Phoenix live dashboard with weekly retrieval-quality trend |
| **100** | | |

## Exercícios

1. Construir uma segunda faixa de corpus sob uma jurisdição diferente (por exemplo, HIPAA ao lado do GDPR). Demonstrar o filtro de papel + jurisdição para evitar vazamentos cruzados em uma investigação de 20 questões entre jurisdições.

2. Meter a taxa de hits de caché imediato durante uma semana de tráfego de produção. Identificar quais consultas quebrarem o prefixo de caché. Reestruturação.

3. Adicione memória multi-turn com um tampão de resumo de 10k tokens. Meter se a fidelidade cai à medida que a conversa cresce.

4. Troca o Claude Sonnet 4.7 por Llama 3.3 70B auto-hosted.

5. Adicione um modo "incureza": se as pontuações mais altas re-ranqueadas estiverem abaixo de um limiar, o agente diz "não tenho citações confiantes" em vez de responder.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Prompt caching | "Cached system + context" | Claude/OpenAI feature: cached prefix tokens discounted 60-90% on hit |
| RAGAS | "RAG evaluator" | Automated scoring of faithfulness, answer relevance, context precision |
| Golden set | "Labeled eval" | 200+ expert-labeled Q/A with citations; the ground truth |
| Jurisdiction tag | "Compliance label" | GDPR/HIPAA/SOC2 scope attached to chunks; enforced by retrieval filter |
| Citation faithfulness | "Grounded answer rate" | Fraction of claims backed by retrievable source spans |
| Drift | "Retrieval quality decay" | Weekly change in nDCG or citation score; alert threshold 5% |
| Red team | "Adversarial eval" | Pre-release jailbreak, PII extraction, off-domain probes |

## Mais leitura

- [Harvey AI](https://www.harvey.ai) Estaca de produção legal de referência
- [Glean enterprise search](https://www.glean.com) RAG de referência em escala empresarial
- [Mendable documentation](https://mendable.ai) Referência RAG dos desenvolvedores-docs
- [LlamaCloud Parse + Index](https://docs.cloud.llamaindex.ai/llamaparse/getting_started) ingestão gerenciada
- [Anthropic prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) a referência ao alavancagem de custos
- [RAGAS 0.2 documentation](https://docs.ragas.io/) o quadro de avaliação canônico do RAG
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) Observabilidade de deriva de referência
- [Llama Guard 4](https://www.llama.com/docs/model-cards-and-prompt-formats/llama-guard-4/) Classificação de segurança 2026
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) Estrutura ferroviária
