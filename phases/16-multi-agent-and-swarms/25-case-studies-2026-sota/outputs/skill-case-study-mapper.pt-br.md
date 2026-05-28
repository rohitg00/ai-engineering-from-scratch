---
name: case-study-mapper
description: Mapeie um projeto de sistema multiagente proposto para a referência de produção mais próxima de 2026 (Anthropic Research, MetaGPT/ChatDev ou OpenClaw/Moltbook). Revele as compensações conhecidas, a estrutura recomendada e as decisões de design específicas já testadas na produção.
version: 1.0.0
phase: 16
lesson: 25
tags: [multi-agent, case-studies, production, framework-selection, reference-architectures]
---

Dado um projeto de sistema multiagente proposto, escolha o estudo de caso canônico mais próximo de 2026 e adapte-o.

Produzir:

1. **Impressão digital de design.** Tipo de tarefa (pesquisa/engenharia/população/automação), contagem de agentes, requisito de verificação, duração do tempo de execução, distinção de função, exposição da rede voltada para o usuário.
2. **Estudo de caso mais próximo.**
   - **Pesquisa Antrópica** se: tarefa de pesquisa ou recuperação de conhecimento, verificação obrigatória, execuções de várias horas, os agentes diferem principalmente por contexto e escopo (os subagentes de novo contexto vencem).
   - **MetaGPT/ChatDev** se: engenharia ou fluxo de trabalho estruturado, as funções são claramente distinguíveis (planejador/codificador/revisor/testador), os artefatos de transferência são bem digitados.
   - **OpenClaw / Moltbook** se: rede de agentes em escala populacional e voltada para o usuário, a injeção imediata for uma ameaça significativa, a economia emergente for importante.
3. **Padrões a serem copiados.** As decisões de design específicas do estudo de caso escolhido que se aplicam: subagentes de contexto novo, implantação de arco-íris, desalucinação comunicativa, roteamento DAG, verificador não gravável, segurança em nível de substrato.
4. **Recomendação de estrutura.** LangGraph, CrewAI, AG2, Microsoft Agent Framework, OpenAI Agents SDK, Google ADK, Anthropic Claude Agent SDK ou personalizado. Padrão para a estrutura típica do estudo de caso; observe se existe um ajuste melhor para o design específico.
5. **Antipadrões do caso.** Coisas que o caso de referência descobriu que NÃO funcionavam. Evite no novo design.
6. **Projeção de custo.** Multiplicador de token esperado (Anthropic Research: ~15x; MetaGPT: ~5x; OpenClaw: depende dos efeitos de rede). Faixa esperada de relógio de parede e custo em dólares.
7. **Abordagem de avaliação.** Qual benchmark (MARBLE, SWE-bench Pro, interno) é relevante; qual delta sobre a linha de base do estudo de caso é razoável atingir.

Rejeições difíceis:

- Projetos que ignoram a verificação quando a tarefa possui requisitos de correção. Cada estudo de caso paga a taxa de verificação.
- Projetos que reivindicam um novo substrato sem reconhecer a injeção imediata como superfície de ataque. O caso OpenClaw/Moltbook mostra que esta é uma preocupação de produção, não hipotética.
- Afirmações “revolucionárias” que não se enquadram em nenhum estudo de caso. O multiagente está em produção desde 2024; novas afirmações precisam de comparação explícita.
- Projetos que ignoram a adoção de MCP ou A2A sem justificativa. O suporte do protocolo é uma aposta de mesa.

Regras de recusa:

- Se o projeto não tiver um tipo de tarefa claro, recomende definir o escopo da tarefa antes de escolher um estudo de caso. “Multiagente para tudo” não é um design.
- Se o projeto alegar prontidão para produção, mas nenhuma auditoria de modo de falha, recomende uma auditoria estilo MAST (Lição 23) antes do mapeamento de referência.
- Se o design for puramente experimental/de pesquisa, observe quais aspectos precisariam ser reforçados antes de adotar qualquer padrão de produção de estudo de caso.

Resultado: um resumo de duas páginas. Comece com um resumo de uma frase ("Estudo de caso mais próximo: MetaGPT / ChatDev. Adote decomposição de papel-SOP, desalucinação comunicativa e artefatos de transferência estruturados; use CrewAI ou customizado.") e, em seguida, as sete seções acima. Termine com um plano de adaptação de 90 dias: o que copiar da referência, o que personalizar e o que validar em relação aos benchmarks.