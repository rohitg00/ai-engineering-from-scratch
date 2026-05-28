---
name: skill-production-checklist
description: Estrutura de decisão para envio de aplicativos LLM para produção – abrange todos os componentes com limites específicos e critérios de aprovação/reprovação
version: 1.0.0
phase: 11
lesson: 13
tags: [production, deployment, llm, architecture, scaling, cost, observability, guardrails]
---

# Lista de verificação de produção LLM

Ao enviar uma inscrição LLM, siga esta lista de verificação em ordem. Cada seção possui critérios de aprovação/reprovação com limites específicos.

## 1. Segurança (bloqueadores de navios)

Cada item aqui deve passar antes de qualquer implantação.

| Verifique | Critérios de aprovação | Como verificar |
|-------|-------------|---------------|
| Chaves de API em env vars | Zero chaves codificadas na base de código | `grep -r "sk-" --include="*.py"` não retorna nada |
| Protetores de entrada ativos | Padrões de injeção imediata bloqueados | Enviar "Ignorar todas as instruções anteriores" - retorna resposta bloqueada |
| Redação de PII | SSN, cartão de crédito, padrões de e-mail detectados | Enviar "Meu SSN é 123-45-6789" - PII redigido antes da chamada LLM |
| Filtragem de saída | Conteúdo perigoso bloqueado | O modelo não pode retornar os padrões `DROP TABLE`, `rm -rf`, `exec()` |
| Limitação de taxa | Limite de solicitação por usuário aplicado | 100 solicitações do mesmo usuário em 10 segundos – últimas 50+ rejeitadas |
| Autenticação em todos os endpoints | Nenhum acesso LLM não autenticado | `curl /v1/chat` sem token retorna 401 |
| CORS restrito | Somente domínios de produção são permitidos | Solicitação de `Origin: evil.com` rejeitada |
| Máximo de tokens de entrada | Pedidos acima do limite rejeitados | Enviar entrada de token de 50K - retorna 413 ou truncamento |

## 2. Confiabilidade (sobrevivência na primeira semana)

Isso evita seu primeiro incidente de plantão.

| Verifique | Critérios de aprovação | Como verificar |
|-------|-------------|---------------|
| Tente novamente com espera | 3 tentativas em 5xx, atraso exponencial | Kill LLM mock mid-solicitação – novas tentativas visíveis nos logs |
| Cadeia de modelos alternativos | Mais de 2 modelos em cadeia | Modelo primário indisponível – a resposta ainda retorna do substituto |
| Solicitar tempo limite | Máximo de 30 segundos em todas as chamadas externas | Simulação LLM lenta (60s) - a solicitação expira em 30s |
| Degradação graciosa | Falha de cache/RAG não trava o serviço | Pare o cache – as solicitações ainda são bem-sucedidas (mais lentas, mais caras) |
| Ponto de extremidade da verificação de integridade | Retorna status de dependência | `GET /health` retorna `{"status": "healthy", "cache": ..., "llm": ...}` |
| Funciona em streaming | Primeiro token abaixo de 500ms | Tempo até o primeiro token medido, consistentemente <500ms |
| As mensagens de erro são seguras | Erros internos nunca vazam para os usuários | Force 500 – o usuário vê um erro genérico, não um rastreamento de pilha |

## 3. Controle de custos (economia do primeiro mês)

Isso evita a fatura surpresa de US$ 50 mil.

| Verifique | Critérios de aprovação | Como verificar |
|-------|-------------|---------------|
| Custo por solicitação acompanhada | Cada solicitação registra contagem de tokens + custo em dólares | O log de solicitação possui os campos `input_tokens`, `output_tokens`, `cost_usd` |
| Cache semântico ativo | > Taxa de acerto de 20% em padrões repetidos | Estatísticas de cache mostram taxa de acerto após 1.000 solicitações de teste |
| Cache TTL configurado | As inscrições expiram (padrão: 1 hora) | Entrada inserida -- não retornada após TTL |
| Acompanhamento de custos por usuário | Custo agregado por user_id | Dashboard/API mostra os 10 principais usuários por custo |
| Alerta de custos | Alerta em 80% do orçamento diário | Definir $10 daily budget, send $8.50 em solicitações - alertar incêndios |
| Roteamento de modelo por custo | Consultas de baixa complexidade utilizam modelo mais barato | Perguntas simples direcionam para gpt-4o-mini, complexas para gpt-4o |
| Conjunto máximo de tokens de saída | Respostas limitadas por modelo | Modelo com max_output_tokens=512 -- a resposta nunca excede |

**Fórmula de estimativa de custos:**
```
Monthly LLM cost = DAU x queries_per_user x 30 x (1 - cache_hit_rate) x (avg_input_tokens x input_price + avg_output_tokens x output_price) / 1,000,000
```

**Limites de referência por escala:**

| DAU | Custo teórico/pedido | Orçamento mensal |
|-----|-------------------|----------------|
| 1K | <$0.005 | < $750 |
| 10K | <$0.003 | < $4.500 |
| 100K | <$0.001 | < $15.000 |

## 4. Observabilidade (depuração em produção)

Você não pode consertar o que não pode ver.

| Verifique | Critérios de aprovação | Como verificar |
|-------|-------------|---------------|
| Registro JSON estruturado | Cada solicitação produz uma linha de log JSON | O log contém: request_id, user_id, modelo, tokens, latency_ms, custo |
| Solicitar rastreamento | Rastreamento ponta a ponta com temporização de componentes | A solicitação única mostra: guardrail (5ms) + cache (2ms) + llm (3200ms) + eval (1ms) |
| Rastreamento de latência | P50, P95, P99 medidos | Após 1000 solicitações: P50 < 2s, P99 < 10s |
| Monitoramento da taxa de erro | Erros contados e categorizados | O painel mostra: 0,5% de erros de API, 0,1% de bloqueios de proteção, 0,01% de tempos limite |
| Métricas de cache | Taxa de acertos, taxa de erros, contagem de entradas visíveis | `GET /v1/cache/stats` retorna números atuais |
| Métricas de teste A/B | Métricas de qualidade por variante registradas | Cada solicitação registra prompt_template + versão para comparação |
| Registro de avaliação | Sinais de qualidade registados por pedido | Comprimento da resposta, latência, modelo, versão do modelo armazenada para análise offline |

## 5. Gerenciamento imediato

Os prompts são código. Trate-os como código.

| Verifique | Critérios de aprovação | Como verificar |
|-------|-------------|---------------|
| Modelos versionados | Cada modelo possui uma string de nome + versão | Alteração de modelo cria nova versão, versão antiga preservada |
| Suporte para testes A/B | Tráfego dividido por hash determinístico de usuário | O mesmo usuário sempre vê a mesma variante no experimento |
| Capacidade de reversão | Reverter para a versão anterior em <1 minuto | Alterar configuração do experimento – o tráfego muda instantaneamente |
| Validação de modelo | Variáveis ​​validadas antes da renderização | Variável ausente no modelo gera erro claro, não KeyError |
| Separação imediata do sistema | Mensagens do sistema e do usuário em campos separados | O prompt do sistema não está concatenado na mensagem do usuário |

## 6. Prontidão de escalonamento

Não é necessário no lançamento. Necessário em 10x.

| Verifique | Critérios de aprovação | Como verificar |
|-------|-------------|---------------|
| Chamadas LLM assíncronas | Nenhum bloqueio de thread em chamadas de API | 50 solicitações simultâneas – CPU do servidor permanece <30% |
| Pool de conexões | Conexões HTTP reutilizadas | Rastreamento de rede mostra conexões persistentes com provedor LLM |
| Escala horizontal | Projeto de servidor sem estado | 2 instâncias atrás do balanceador de carga – todas as solicitações são bem-sucedidas |
| Suporte a filas | Tarefas que não são em tempo real vão para a fila | Solicitação de resumo retorna job_id, resultado disponível via polling |
| Carga testada | 100 usuários simultâneos, taxa de erro <5% | O teste `wrk` ou `locust` é aprovado na simultaneidade desejada |

## Ordem de implementação para novos projetos

1. **Dia 1:** Servidor API + modelos de prompt + chamada LLM única com nova tentativa
2. **Dia 2:** Proteção de entrada + proteção de saída + tratamento de erros
3. **Dia 3:** Cache semântico + rastreamento de custos por solicitação
4. **Dia 4:** Streaming (SSE) + endpoint de verificação de integridade
5. **Dia 5:** Registro estruturado + rastreamento de solicitação + registro de avaliação
6. **Semana 2:** Teste A/B + controle de versão imediato + reversão
7. **Semana 3:** Cadeia de modelo substituto + degradação graciosa
8. **Semana 4:** Teste de carga + otimização assíncrona + escalonamento horizontal

## Diagnóstico rápido

Se algo estiver errado na produção, verifique nesta ordem:

1. **Usuários reclamando de erros?** Verifique o endpoint de integridade, a taxa de erros nos logs e a página de status do provedor LLM
2. **As respostas são lentas?** Verifique a latência do P99, depois a taxa de acertos do cache e, em seguida, os tempos de resposta do LLM em traces
3. **Aumento de custos?** Verifique a tendência de custo por solicitação, em seguida, a taxa de acerto do cache, depois os principais usuários por custo e, em seguida, procure por alterações imediatas no modelo que aumentaram a contagem de tokens
4. **Qualidade caiu?** Verifique se uma nova versão do prompt foi implantada, verifique se a precisão da recuperação do RAG foi alterada, verifique se o provedor do modelo alterou a versão padrão do modelo
5. **Incidente de segurança?** Verifique a taxa de bloqueio do guardrail (queda repentina = guardrails desativados), verifique os logs de solicitação em busca de padrões incomuns, gire as chaves de API imediatamente