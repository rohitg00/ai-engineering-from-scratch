# Capstone 08 — Chatbot RAG de Produção para Vertical Regulada

> Harvey, Glean, Mendable e LlamaCloud todos rodam a mesma forma de produção em 2026. Ingestão com docling ou Unstructured e ColPali para visuais. Busca híbrida. Re-ranqueamento com bge-reranker-v2-gemma. Síntese com Claude Sonnet 4.7 usando prompt caching a 60-80% de taxa de acerto. Proteção com Llama Guard 4 e NeMo Guardrails. Monitoramento com Langfuse e Phoenix. Avaliação com RAGAS num conjunto dourado de 200 questões. Construa um num domínio regulado (jurídico, clínico, seguro) e o capstone é passar no conjunto dourado, no red team e no painel de deriva.

**Tipo:** Capstone
**Linguagens:** Python (pipeline + API), TypeScript (UI de chat)
**Pré-requisitos:** Fase 5 (NLP), Fase 7 (transformers), Fase 11 (engenharia de LLM), Fase 12 (multimodal), Fase 17 (infraestrutura), Fase 18 (segurança)
**Fases exercitadas:** P5 · P7 · P11 · P12 · P17 · P18
**Tempo:** 30 horas

## Problema

RAG em domínio regulado (contratos jurídicos, protocolos de ensaios clínicos, apólices de seguro) é a forma de produção mais lançada em 2026 porque o ROI é óbvio e as consequências são concretas. Harvey (Allen & Overy) construiu para jurídico. Mendable lança a variante de docs de desenvolvedor. Glean cobre busca empresarial. O padrão é: ingerir alta fidelidade, recuperar híbrido com re-ranqueamento, sintetizar com aplicação de citações e cache de prompts, proteger com múltiplas camadas de segurança e monitorar deriva continuamente.

As partes difíceis não são o modelo. São conformidade consciente de jurisdição (HIPAA, GDPR, SOC2), auditabilidade no nível de citação, controle de custo (cache de prompt compra desconto de 60-90% quando o taxa de acerto é alto), detecção de alucinação via fidelidade do RAGAS e detecção de deriva quando os documentos fonte são atualizados sem o índice acompanhar. Este capstone te pede para lançar tudo isso num conjunto dourado de 200 questões com um conjunto de red team ao lado.

## Conceito

A pipeline tem dois lados. **Ingestão**: docling ou Unstructured parseia documentos estruturados; ColPali lida com os visualmente ricos; chunks ganham resumos, tags e rótulos de acesso baseado em função. Vetores vão para pgvector + pgvectorscale (abaixo de 50M vetores) ou Qdrant Cloud; BM25 sparse roda ao lado. **Conversa**: LangGraph lida com memória e multi-turn; cada consulta roda recuperação híbrida, re-ranqueia com bge-reranker-v2-gemma-2b, sintetiza com Claude Sonnet 4.7 (com prompt caching), passa a saída pelo Llama Guard 4 e NeMo Guardrails e emite uma resposta ancorada em citações.

A stack de avaliação tem quatro camadas. **Conjunto dourado** (200 Q/A rotulados com citações) para corretude. **Red team** (jailbreaks, tentativas de extração de PII, questões fora de domínio) para segurança. **RAGAS** para fidelidade / relevância da resposta / precisão do contexto automaticamente por turno. **Painel de deriva** (Arize Phoenix) observando qualidade de recuperação e pontuação de alucinação semanalmente.

Cache de prompt é a alavanca de custo. Claude 4.5+ e GPT-5+ suportam cache de prompts do sistema + contexto recuperado. A 60-80% de taxa de acerto, custo por consulta cai 3-5x. A pipeline deve ser projetada para prefixos estáveis (prompt do sistema + contexto re-rankeado primeiro) para atingir altas taxas de cache hit.

## Arquitetura

```
documentos (contratos, protocolos, apólices)
      |
      v
parse docling / Unstructured + ColPali para visuais
      |
      v
chunks + resumos + rótulos-de-função + tags de jurisdição
      |
      v
pgvector + pgvectorscale  +  BM25 (Tantivy)
      |
consulta + função + jurisdição
      |
      v
agent conversacional LangGraph
   +--- recuperar (híbrido)
   +--- filtrar por função + jurisdição
   +--- re-ranquear (bge-reranker-v2-gemma-2b ou Voyage rerank-2)
   +--- sintetizar (Claude Sonnet 4.7, com cache de prompt)
   +--- proteger (Llama Guard 4 + NeMo Guardrails + limpeza PII output Presidio)
   +--- citar + retornar
      |
      v
avaliação:
  RAGAS fidelidade / relevância_da_resposta / precisão_do_contexto (online)
  Fila de anotação Langfuse (amostrada)
  Drift Arize Phoenix (semanal)
  conjunto de red team (pré-lançamento)
```

## Stack

- Ingestão: Unstructured.io ou docling para documentos estruturados; ColPali para PDFs visualmente ricos
- Vector DB: pgvector + pgvectorscale abaixo de 50M vetores; Qdrant Cloud caso contrário
- Sparse: Tantivy BM25 com pesos de campo
- Orquestração: LlamaIndex Workflows (ingestão) + LangGraph (conversa)
- Re-ranqueador: bge-reranker-v2-gemma-2b auto-hospedado ou Voyage rerank-2 hospedado
- LLM: Claude Sonnet 4.7 com prompt caching; reserva Llama 3.3 70B auto-hospedado
- Avaliação: RAGAS 0.2 online, DeepEval para suites de alucinação e jailbreak
- Observabilidade: Langfuse auto-hospedado com fila de anotação; Arize Phoenix para deriva
- Guardrails: classificador de entrada/saída Llama Guard 4, política NeMo Guardrails v0.12, limpeza PII Presidio
- Compliance: rótulos de acesso baseado em função nos chunks; tags de jurisdição para GDPR/HIPAA

## Construa

1. **Ingestão.** Parse seu corpus (1000-10000 documentos para uma implementação séria) com Unstructured ou docling. Para páginas escaneadas / pesadas em visuais, roteie pelo ColPali. Produza chunks com resumos, rótulos-de-função, tags de jurisdição.

2. **Índice.** Embeddings densos (Voyage-3 ou Nomic-embed-v2) no pgvector + pgvectorscale. Índice lateral BM25 via Tantivy. Filtros de função e jurisdição como payload.

3. **Recuperação híbrida.** Filtre por função+jurisdição primeiro; depois densa + BM25 em paralelo; fusão com reciprocal rank fusion; top-20 para re-ranqueador; top-5 para síntese.

4. **Sintetize com prompt caching.** Prompt do sistema + políticas estáticas no cabeçalho do cache; contexto re-rankeado como extensão do cache; pergunta do usuário como sufixo não-cacheado. Meta de 60-80% taxa de acerto do cache em estado estacionário.

5. **Guardrails.** Llama Guard 4 na entrada; trilhas NeMo Guardrails bloqueiam questões fora de domínio ou tópicos proibidos pela política; Presidio limpa PII acidental na saída; pós-filtro de aplicação de citações.

6. **Conjunto dourado.** 200 pares Q/A rotulados por um eespecificaçãoialista do domínio com (resposta, citações). Pontue o agente em correspondência exata de citação, corretude da resposta, fidelidade (RAGAS).

7. **Red team.** 50 prompts adversários: jailbreaks (PAIR, TAP), tentativas de exfiltração de PII, fora de domínio, vazamentos cross-jurisdição. Pontue com pass/falha e severidade.

8. **Painel de deriva.** Arize Phoenix rastreia qualidade de recuperação (nDCG, fidelidade de citação) semanalmente. Alerta em queda de 5%.

9. **Relatório de custo.** Langfuse: taxa de acerto de prompt caching, tokens por consulta, breakdown de $/consulta por estágio.

## Use

```
$ chat --role=analyst --jurisdiction=GDPR
> qual é a obrigação de retenção de dados para perfis de usuários EU sob nosso contrato?
[recuperar]  híbrido top-20 filtrado para GDPR + role-analyst
[re-ranquear] top-5 mantidos
[sintetizar]  claude-sonnet-4.7, cache hit 74%, 0.8s
resposta:
  O contrato (Seção 12.4, Acordo Principal de Serviços datado de 2024-03-11)
  obriga exclusão de perfis de usuários EU em até 30 dias após o término
  conforme Artigo 17 do GDPR. A emenda DPA (DPA-v2.1, Seção 5) estende
  isso para 14 dias para dados da categoria "restrita".
  citações: [MSA-2024-03-11 s12.4, DPA-v2.1 s5]
```

## Entregue

`outputs/skill-production-rag.md` descreve a entrega. Um chatbot de domínio regulado implantado com rótulos de conformidade, passando pela rubrica, monitorado com deriva ao vivo.

| Peso | Critério | Como é medido |
|:-:|---|---|
| 25 | Fidelidade RAGAS + relevância da resposta | Pontuações online no conjunto dourado (200 Q/A) |
| 20 | Corretude das citações | Fração de respostas com âncoras de fonte verificáveis |
| 20 | Cobertura de guardrails | Taxa de pass Llama Guard 4 + resultados da suite de jailbreak |
| 20 | Custo / engenharia de latência | Hit rate de prompt cache, p95 de latência, $/consulta |
| 15 | Painel de monitoramento de deriva | Dashboard ao vivo Phoenix com tendência semanal de qualidade de recuperação |
| **100** | | |

## Exercícios

1. Construa um segundo slice de corpus sob uma jurisdição diferente (ex.: HIPAA ao lado de GDPR). Demonstre que o filtro função+jurisdição impede vazamento cross-jurisdição num probe de 20 questões cross-jurisdição.

2. Meça o taxa de acerto de prompt cache em uma semana de tráfego de produção. Identifique quais queries quebram o prefixo do cache. Reestruture.

3. Adicione memória multi-turn com um buffer de resumo de 10k tokens. Meça se a fidelidade cai conforme a conversa cresce.

4. Troque Claude Sonnet 4.7 por Llama 3.3 70B auto-hospedado. Meça $/consulta e delta de fidelidade.

5. Adicione um modo "não tenho certeza": se as pontuações re-rankeadas do top estão abaixo de um limiar, o agente diz "não tenho citações confiantes" em vez de responder. Meça a redução de falsa confiança.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|------|------------------------|------------------------|
| Prompt caching | "Sistema + contexto em cache" | Recurso Claude/OpenAI: tokens de prefixo em cache descontados 60-90% no hit |
| RAGAS | "Avaliador RAG" | Pontuação automatizada de fidelidade, relevância da resposta, precisão do contexto |
| Conjunto dourado | "Avaliação rotulada" | 200+ Q/A rotulados por eespecificaçãoialista com citações; o ground truth |
| Tag de jurisdição | "Label de conformidade" | Escopo GDPR/HIPAA/SOC2 anexado aos chunks; aplicado por filtro de recuperação |
| Fidelidade de citação | "Taxa de resposta fundamentada" | Fração de afirmações sustentadas por trechos de fonte recuperáveis |
| Drift | "Decaimento de qualidade de recuperação" | Variação semanal no nDCG ou pontuação de citação; limiar de alerta 5% |
| Red team | "Avaliação adversarial" | Jailbreaks pré-lançamento, extração de PII, probes fora de domínio |

## Leitura Complementar

- [Harvey AI](https://www.harvey.ai) — stack de referência jurídica em produção
- [Glean busca empresarial](https://www.glean.com) — RAG de referência em escala empresarial
- [Documentação Mendable](https://mendable.ai) — RAG de referência para docs de desenvolvedor
- [LlamaCloud Parse + Index](https://docs.llamaindex.ai/en/stable/examples/llama_cloud/llama_parse/) — ingestão gerenciada
- [Prompt caching Anthropic](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — referência da alavanca de custo
- [Documentação RAGAS 0.2](https://docs.ragas.io/) — framework de avaliação RAG canônico
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) — observabilidade de deriva de referência
- [Llama Guard 4](https://ai.meta.com/research/publications/llama-guard-4/) — classificador de segurança de 2026
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) — framework de trilhas de política
