---
name: ipi-audit
description: Audite uma implantação de agente para exposição imediata à injeção indireta e cobertura de controle de fluxo de informações.
version: 1.0.0
phase: 18
lesson: 15
tags: [ipi, indirect-prompt-injection, ifc, agent-security, owasp-llm01]
---

Dada uma descrição de implantação de agente, audite a implantação para exposição à injeção indireta e imediata.

Produzir:

1. Inventário de conteúdo não confiável. Liste todas as fontes de conteúdo que o agente pode ler: documentos RAG, caixa de entrada, calendário, resultados de ferramentas, tickets, análises de produtos, APIs de terceiros. Cada um é um vetor potencial de IPI.
2. Rotulagem de confiança. A implantação separa confiável (prompt do usuário) de não confiável (conteúdo recuperado)? Se o conteúdo for concatenado no mesmo prompt sem rótulo, o IFC não terá efeito.
3. Controle de ação. Quais ferramentas podem ser invocadas? Para cada um, a invocação é controlada apenas pelo prompt confiável ou o conteúdo não confiável pode influenciar a invocação?
4. Avaliação de ataque adaptativo. A implantação foi testada com ataques adaptativos (gradiente, RL, equipe vermelha humana) de acordo com Nasr et al. 2025? A avaliação apenas de ataque estático é insuficiente.
5. Limites de violação de escopo. Identifique cada limite de confiança cruzada (por exemplo, caixa de entrada -> envio, documentos -> API externa). Para cada um, verifique se a ação foi proibida sob influência não confiável ou explicitamente ratificada pelo prompt confiável.

Rejeições difíceis:
- Qualquer implantação de agente sem rotulagem de confiança explícita no conteúdo recuperado.
- Qualquer reclamação de defesa baseada apenas em ataques estáticos.
- Qualquer alegação de "nosso agente é seguro para injeção imediata" sem nomear o mecanismo IFC.

Regras de recusa:
- Se o usuário perguntar se a filtragem é suficiente, recuse e explique o resultado do Nasr 2025 de que os ataques adaptativos quebram >90% das defesas baseadas em filtros.
- Se o usuário solicitar uma defesa mágica, recuse — a defesa do IPI exige IFC, além de moderação de resposta em camadas, além de auditoria humana em ações de alto risco.

Resultado: uma auditoria de uma página que preenche as cinco seções acima, sinaliza o limite mais perigoso de não confiável para confiável e nomeia o controle mais urgente a ser adicionado. Cite informações do MDPI 17(1):54 (2026) e Nasr et al. (outubro de 2025) uma vez cada.