---
name: browser-agent-trust-boundary
description: Scope a proposed browser-agent deployment — trust zones, authorized writes, required defenses — before the agent touches a real site.
version: 1.0.0
phase: 15
lesson: 11
tags: [browser-agents, prompt-injection, trust-boundary, osworld, webarena]
---
---
name: browser-agent-trust-boundary
description: Scope a proposed browser-agent deployment — trust zones, authorized writes, required defenses — before the agent touches a real site.
version: 1.0.0
phase: 15
lesson: 11
tags: [browser-agents, prompt-injection, trust-boundary, osworld, webarena]
---

Dado um fluxo de trabalho de agente de navegador proposto, produza um documento de escopo de limite de confiança que enumere cada leitura, cada gravação e a pilha de defesa mínima necessária para a primeira execução.

Produzir:

1. **Ler a superfície.** Liste todas as origens que o agente irá buscar. Classifique cada um como confiável (sites primários operados pela organização do usuário) ou não confiável (qualquer terceiro, qualquer conteúdo gerado pelo usuário, qualquer resultado de pesquisa). Todas as leituras fora de confiança devem ser tratadas como potenciais canais de injeção imediata.
2. **Superfície de gravação.** Liste todas as ações consequentes que o agente está autorizado a realizar (enviar formulário, postar conteúdo, chamar uma ferramenta de back-end, gravar na memória). Para cada um, indique o raio da explosão e se a ação é reversível.
3. **Defesas necessárias.** Pilha mínima: sanitizador de conteúdo, limite de leitura/gravação (as gravações exigem nova aprovação quando content_origin está fora de confiança), lista de permissões de ferramentas por tarefa, isolamento de sessão com credenciais de escopo, tokens canário em memória persistente, HITL em ações irreversíveis.
4. **Ajuste do benchmark à distribuição.** Se o agente relatar uma pontuação BrowseComp, OSWorld ou WebArena-Verified, nomeie a sobreposição de distribuição entre o benchmark e a tarefa real. Uma pontuação alta no BrowseComp não prevê a confiabilidade do fluxo de reservas.
5. **Lista de verificação de ataques conhecidos.** Confirme se a implantação está protegida contra (a) injeção de texto visível, (b) injeção de fragmento de URL/consulta, (c) ataques de vinculação de memória (classe Tainted Memories), (d) ataques em formato CSRF em sessões autenticadas, (e) sequestros com um clique. Para cada um, nomeie a defesa específica e onde ela dispara.

Rejeições difíceis:
- Agentes de navegador com acesso a credenciais de produção e sem isolamento de sessão.
- Qualquer implantação em que uma gravação iniciada a partir de conteúdo fora de confiança não exija nova aprovação HITL.
- Qualquer implantação que dependa exclusivamente de um sanitizador de conteúdo (os higienizadores detectam ataques fáceis; cargas sofisticadas passam).
- Memória persistente sem entradas canário.
- Fluxos de trabalho que envolvem transações financeiras ou dados de clientes sem HITL nas gravações.

Regras de recusa:
- Se o usuário não puder nomear o raio de explosão de uma gravação errada acionada por injeção, recuse e exija uma frase explícita.
- Se o usuário propor um agente de navegador em uma pilha onde as credenciais com escopo definido não estão disponíveis, recuse e exija primeiro uma identidade separada.
- Se o usuário citar uma pontuação de benchmark (BrowseComp, OSWorld, WebArena) como prova de que o agente “pode” realizar uma tarefa de produção, recusar e exigir avaliações internas sobre a distribuição real.

Formato de saída:

Retorne um memorando de limite de confiança com:
- **Ler tabela de superfície** (origem, confiável/fora de confiança)
- **Escrever tabela de superfície** (ação, raio de explosão, reversível s/n)
- **Pilha de defesa** (lista com marcadores de camadas configuradas)
- **Nota de ajuste de referência** (se aplicável)
- **Lista de verificação de ataques conhecidos** (cinco linhas, defesa nomeada por linha)
- **Veredicto de implantação** (somente produção/preparação/pesquisa)