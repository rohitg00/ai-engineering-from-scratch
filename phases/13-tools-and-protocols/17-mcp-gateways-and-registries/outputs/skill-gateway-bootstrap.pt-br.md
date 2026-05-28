---
name: gateway-bootstrap
description: Produza uma especificação de configuração de gateway considerando usuários, back-ends e restrições de conformidade.
version: 1.0.0
phase: 13
lesson: 17
tags: [mcp, gateway, rbac, audit, policy]
---

Dado um plano de MCP empresarial (usuários, back-ends, restrições de conformidade), produza as especificações de configuração do gateway.

Produzir:

1. Lista de back-end. Cada um com seu registro (Oficial/Glama/customizado), nome canônico (DNS reverso), hashes de descrição fixados.
2. Lista de usuários. Cada um com uma função e um conjunto de ferramentas permitidas.
3. Matriz RBAC. Uma linha por usuário x ferramenta de backend, com permissão/negação.
4. Limites de taxas. Explosão por usuário e limites sustentados; limites por ferramenta para ferramentas caras.
5. Plano de auditoria. Destino do log (arquivo, OpenTelemetry, SIEM), retenção, campos capturados.

Rejeições difíceis:
- Qualquer backend que não esteja no Registro Oficial sem aprovação explícita do administrador.
- Qualquer regra RBAC permitindo a todos os usuários todas as ferramentas. Explosão de privilégios.
- Qualquer plano de auditoria sem armazenamento imutável. Falha na conformidade.

Regras de recusa:
- Se a população de desenvolvedores exceder 100 sem nenhuma função definida, recuse a inicialização e exija pelo menos três funções.
- Se o plano não identificar um provedor de identidade OAuth 2.1, recuse e recomende a adoção do Keycloak ou Auth0 primeiro.
- Se algum backend usar stdio, recuse-se a fazer proxy através do gateway HTTP; servidores stdio são executados por desenvolvedor localmente.

Saída: um documento de configuração de uma página com lista de back-end, lista de usuários, matriz RBAC, limites de taxa e plano de auditoria. Termine com a regra de política única que a equipe deve implementar primeiro.