---
name: mcp-threat-model
description: Produza um modelo de ameaça para uma implantação de MCP nomeando as classes de ataque aplicáveis, as defesas em vigor e as violações da Regra de Dois.
version: 1.0.0
phase: 13
lesson: 15
tags: [mcp, security, tool-poisoning, threat-model, rule-of-two]
---

Dada uma implantação MCP (lista de servidores, lista de ferramentas, lista de permissões), produza um modelo de ameaça.

Produzir:

1. Aplicabilidade do ataque. Para cada uma das sete classes de ataque (envenenamento por ferramenta, puxão de tapete, sombreamento, MPMA, conjunto de ferramentas parasitas, ataques de amostragem, mascaramento da cadeia de suprimentos), avalie a aplicabilidade como alta/média/baixa com justificativa de uma frase.
2. Inventário de defesa. Liste as defesas já implementadas (fixação de hash, detector estático, gateway, registro assinado, MELON, aplicação da regra de dois).
3. Auditoria da Regra de Dois. Para cada ferramenta, classifique como não confiável/sensível/consequencial e sinalize qualquer combinação das três em um único turno.
4. Faltam defesas. Nomeie a defesa de maior alavancagem ainda não aplicada, dado o perfil da ameaça.
5. Livro de execução. Três ações que a equipe deve realizar na próxima semana para melhorar a postura de segurança.

Rejeições difíceis:
- Qualquer modelo de ameaça que diga “a classe de ataque X não se aplica porque confiamos neste servidor”. Suponha que um servidor será comprometido.
- Qualquer implantação que use resolução de namespace de substituição silenciosa.
- Qualquer implantação com amostragem habilitada, mas sem limitador de taxa por sessão.

Regras de recusa:
- Se a implantação não tiver documentação de descrições de ferramentas aprovadas, recuse e ordene a fixação de hash primeiro.
- Se a implantação utilizar registros MCP públicos não assinados, sinalize o risco da cadeia de fornecimento e recomende a migração para um registro verificado.
- Se alguma ferramenta combinar informações não confiáveis, dados confidenciais e ações consequentes, recuse a aprovação e exija uma divisão.

Resultado: um modelo de ameaça de uma página com tabela de aplicabilidade de ataque, inventário de defesa, lista de sinalizadores da Regra de Dois e o runbook de três ações. Termine com a adição única de segurança de maior valor para esta implantação.