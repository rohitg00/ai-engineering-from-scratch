---
name: skill-rag-pipeline
description: Crie e depure pipelines RAG a partir dos primeiros princípios
version: 1.0.0
phase: 11
lesson: 6
tags: [rag, retrieval, embeddings, vector-search, llm-engineering]
---

# Padrão de pipeline RAG

Todo sistema RAG segue este padrão:

```
documents -> chunk -> embed -> store
query -> embed -> search(top_k) -> build_prompt -> generate
```

A indexação acontece uma vez por documento. A consulta acontece em cada solicitação do usuário.

## Quando usar RAG

- O LLM precisa de acesso a documentos privados ou recentes
- O ajuste fino é muito caro ou muito lento para atualizar
- Você precisa citar fontes para obter respostas
- A base de conhecimento muda frequentemente

## Quando NÃO usar RAG

- A resposta é conhecimento geral que o LLM já possui
- A tarefa é criativa (escrita, brainstorming) e não factual
- Você precisa que o modelo adote um estilo de raciocínio específico (use ajuste fino)

## Lista de verificação de implementação

1. Divida os documentos em segmentos de token 256-512 com sobreposição de 50 tokens
2. Incorpore cada pedaço usando um modelo de incorporação consistente
3. Armazene os embeddings em um banco de dados vetorial com o texto original
4. Na hora da consulta, incorpore a pergunta do usuário com o mesmo modelo
5. Recuperar top-k (5-10) pedaços mais semelhantes por meio de similaridade de cosseno
6. Crie um prompt: instrução do sistema + contexto recuperado + pergunta do usuário
7. Gere a resposta, fundamentando-a no contexto recuperado
8. Devolva a resposta com referências de origem

## Erros comuns

- Usando diferentes modelos de incorporação para indexação e consulta (vetores são incompatíveis)
- Pedaços muito pequenos (perdem contexto) ou muito grandes (diluem relevância)
- Não incluindo sobreposição entre pedaços (divide frases nos limites)
- Esquecer de reindexar quando os documentos mudam
- Retornar pedaços recuperados ao usuário sem gerar uma resposta coerente
- Não definir temperatura = 0 para consultas RAG factuais (temperatura mais alta = mais alucinação)

## Recuperação de depuração

Se os pedaços corretos não estiverem sendo recuperados:
1. Imprima a incorporação da consulta e verifique se é diferente de zero
2. Verifique manualmente as semelhanças de cossenos para um pedaço conhecido e relevante
3. Tente reformular a consulta para corresponder ao vocabulário do documento
4. Verifique se o modelo de incorporação corresponde entre o índice e o tempo de consulta
5. Verifique se o conteúdo relevante foi perdido durante a fragmentação

## Parâmetros de produção

- Tamanho do pedaço: 256-512 tokens
- Sobreposição: 50 tokens (10-20% do tamanho do bloco)
- Top-k: 5-10 para a maioria dos casos de uso
- Temperatura: 0 para respostas factuais
- Modelo de incorporação: text-embedding-3-small (econômico) ou text-embedding-3-large (maior precisão)