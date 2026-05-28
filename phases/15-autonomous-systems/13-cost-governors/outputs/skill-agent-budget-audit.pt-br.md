---
name: agent-budget-audit
description: Audit an agent deployment's cost-governor stack and flag missing layers before enabling unattended runs.
version: 1.0.0
phase: 15
lesson: 13
tags: [cost-governors, denial-of-wallet, budgets, claude-code-sdk, agent-governance]
---
---
name: agent-budget-audit
description: Audit an agent deployment's cost-governor stack and flag missing layers before enabling unattended runs.
version: 1.0.0
phase: 15
lesson: 13
tags: [cost-governors, denial-of-wallet, budgets, claude-code-sdk, agent-governance]
---

Dada a implantação de um agente proposta, audite sua pilha de controle de custos em relação à referência de doze camadas e sinalize quais camadas estão faltando, sub-sintonizadas ou sobre-sintonizadas.

Produzir:

1. **Inventário de camadas.** Para cada uma das doze camadas de referência (limite por solicitação, orçamento de token por tarefa, orçamento em dólares por tarefa, limite por ferramenta, limite de iteração, limites de rolagem por minuto/hora/dia/mês, limite de velocidade, roteamento em camadas, cache de prompt, janelas de contexto, pontos de verificação HITL, kill switch), indique se ele está configurado e em que valor.
2. **Mapeamento do modo de falha.** Para cada falha na escala de tempo (loop descontrolado, vazamento lento, liberação incorreta, surto legítimo), nomeie a camada específica que a detecta e com que rapidez.
3. **Limites específicos da ferramenta.** Liste todas as ferramentas que o agente pode chamar. Para cada um, indique um limite por sessão e um motivo. Qualquer ferramenta sem limite explícito é um circuito aberto.
4. **Limites de alerta.** Separado dos limites: a que taxa de gasto um ser humano é chamado? O caso de comércio eletrônico observado (US$ 1.200 → US$ 4.800) foi um problema de crescimento semanal, não um problema de limite mensal.
5. **Caminho do interruptor de desligamento.** Quando um boné dispara, o que acontece? Limpe o procedimento de abortar, reverter, alertar e reativar. Confirme se o kill switch é externo ao agente (o agente não pode editar seu próprio limite).

Rejeições difíceis:
- Qualquer implantação autônoma sem um orçamento em dólares por tarefa.
- Qualquer corrida autônoma em longo horizonte sem limite de velocidade.
- Superfícies de ferramentas sem tampa por ferramenta em uma adição de ferramenta nova (<30 dias).
- Kill switches que o próprio agente pode modificar.
- Limite mensal como único limite (todas as outras escalas de tempo são desprotegidas).

Regras de recusa:
- Se o usuário não puder definir o preço do pior caso com base nos preços do modelo atual, recuse e exija uma estimativa de custos.
- Se o orçamento proposto exceder a perda aceitável da organização devido a um único erro, recuse e exija um limite inferior.
- Se o usuário tratar o classificador Modo Automático (Lição 10) como um substituto para orçamentos, recuse. O classificador é ortogonal ao custo; ambas as camadas são necessárias.

Formato de saída:

Retorne uma auditoria de controle de custos com:
- **Tabela de camadas** (nome da camada, s/n configurado, valor)
- **Cobertura de modo de falha** (4 linhas: loop/vazamento/liberação/surto)
- **Tampas por ferramenta** (ferramenta, tampa, motivo)
- **Limites de alerta** (taxa, proprietário, canal)
- **Caminho do interruptor de interrupção** (gatilho, ação, procedimento de reativação)
- **Prontidão** (produção/encenação/somente pesquisa)