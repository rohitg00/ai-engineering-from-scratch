---
name: managed-platform-picker
description: Escolha uma plataforma LLM gerenciada (Bedrock, Azure OpenAI, Vertex AI) e uma segunda para redundância, dada a carga de trabalho, SLA e requisitos de conformidade — e então produza um plano de instrumentação FinOps.
version: 1.0.0
phase: 17
lesson: 01
tags: [bedrock, azure-openai, vertex-ai, ptu, finops, managed-platforms]
---

Dado um perfil de carga de trabalho (modelos necessários, tokens mensais, SLA TTFT em P50/P99, restrições de conformidade, pegada de nuvem existente), produza uma recomendação de plataforma.

Produzir:

1. Plataforma primária. Nomeie a plataforma, os modelos específicos que ela cobre e se as unidades de rendimento provisionadas (PTUs) ou sob demanda são apropriadas, dada a utilização. Cite a matemática do ponto de equilíbrio (PTU com aproximadamente 40-60% de utilização sustentada).
2. Plataforma secundária. Nomeie o substituto mínimo de dois provedores. Justifique o emparelhamento — a redundância deve cobrir a sobreposição do modelo (Claude no Bedrock + GPT no Azure OpenAI é o par comum) e a sobreposição da região.
3. Instrumentação FinOps. Especifique o que ativar no primeiro dia: perfis de inferência de aplicativos Bedrock, escopos do Azure + reservas de PTU como objetos de custo, projeto Vertex por equipe + exportação de faturamento do BigQuery. Nomeie as dimensões de atribuição — por usuário, por tarefa, por locatário.
4. Verificação de SLA. Compare o TTFT P99 alvo com os benchmarks publicados (Azure OpenAI PTU ≈ 50 ms P50; Bedrock sob demanda ≈ 75 ms P50). Se o SLA for mais rígido do que o sob demanda pode oferecer, exija PTU.
5. Verificação de conformidade. Verifique BAA, SOC 2 Tipo II, HIPAA, residência de dados na UE conforme necessário. Observe que todos os três atendem à linha de base, mas as políticas de retenção e a desativação do monitoramento de abuso são diferentes.
6. Percurso migratório. Cite uma etapa reversível que a equipe pode realizar esta semana (por exemplo, implantar por meio do provedor de abstração de gateway de IA; cabeçalhos de atribuição de instrumentos) e uma etapa de longo prazo (compromisso de PTU; failover entre regiões).

Rejeições difíceis:
- Recomendar uma plataforma única sem um substituto nomeado. Recuse e insista no mínimo de dois provedores.
- Picking de PTU sem estimativa de utilização. Recuse e solicite dados de utilização sustentada.
- Ignorar perfis de inferência de aplicativos Bedrock quando a atribuição é listada como um requisito — eles são a superfície nativa mais limpa.

Regras de recusa:
- Se a carga de trabalho exigir Claude, Gemini e GPT como P0, nomeie a realidade de três plataformas (Bedrock + Vertex + Azure OpenAI atrás de um gateway) em vez de fingir que uma plataforma pode servir todos os três.
- Se o SLA for TTFT P99 < 100 ms e o orçamento esperado não puder suportar o PTU, recuse-se a prometer o SLA — explique o teto de variação sob demanda.
- Se o cliente pedir para “usar o provedor mais barato”, recuse – o preço é multidimensional (taxa de token + capacidade dedicada + sobrecarga de atribuição + custo de lock-in).

Resultado: uma decisão de uma página com plataforma primária, plataforma secundária, PTU vs sob demanda, lista de instrumentação, verificação de SLA/conformidade e duas etapas de migração. Termine com a métrica única que irá captar desvios do plano (utilização sustentada, desperdício de PTU ou cobertura de atribuição).