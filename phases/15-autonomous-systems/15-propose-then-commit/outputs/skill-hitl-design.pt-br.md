---
name: hitl-design
description: Revise um fluxo de trabalho Human-in-the-Loop proposto para propor o formato e depois confirmar e sinalizar metadados ausentes, idempotência, verificação ou camadas de desafio e resposta.
version: 1.0.0
phase: 15
lesson: 15
tags: [hitl, propose-then-commit, idempotency, langgraph, cloudflare, agent-framework, eu-ai-act]
---

Dado um fluxo de trabalho HITL proposto, audite-o em relação à referência propor-e-comprometer e sinalize o que está faltando, subespecificado ou incompatível com o regulador.

Produzir:

1. **Metadados da proposta.** Confirme todas as superfícies da proposta: intenção (por que), linhagem de dados (conteúdo de origem), permissões tocadas, raio de explosão (pior caso), plano de reversão. Campos ausentes são bloqueadores; “o agente quer X” não é uma proposta.
2. **Idempotência.** Nomeie a composição da chave de idempotência. Deve ser derivável do conteúdo da proposta para que as novas tentativas retornem o mesmo registro. Chaves que incluem o horário do relógio de parede não são chaves de idempotência; eles estão registrando carimbos de data/hora.
3. **Durabilidade.** Nomeie o armazenamento (PostgreSQL, Redis, Objeto Durável, armazenamento de objetos com verificação de integridade). Confirme se as aprovações sobrevivem à reinicialização do agente, à reinicialização do host e à implantação. As filas na memória não são qualificadas.
4. **Superfície de aprovação.** A aprovação com carimbo (botão único Aprovar) é reprovada nesta auditoria. Obrigatório: lista de verificação de desafio e resposta com reconhecimento positivo sobre compreensão da intenção, verificação do raio de explosão e prontidão para reversão. Confirme se a lista de verificação é adaptada à classe de ação específica e não genérica.
5. **Verificação pós-confirmação.** Confirme se o fluxo de trabalho relê o recurso de destino após a execução e alerta sobre falha na verificação. "A ferramenta retornou 200" não foi verificada.

Rejeições difíceis:
- Superfícies HITL que não persistem propostas de forma duradoura.
- Fluxos de aprovação onde o revisor é o próprio agente.
- Qualquer ação de produção irreversível sem desafio e resposta.
- Chaves de idempotência com componentes de relógio de parede.
- Fluxos de trabalho onde a verificação pós-confirmação está ausente em ações consequentes.

Regras de recusa:
- Se o usuário nomear a UI de aprovação, mas não puder nomear o armazenamento durável por trás dela, recuse e exija um armazenamento primeiro.
- Se o usuário tratar "max_budget_usd e uma caixa de diálogo de confirmação" como HITL suficiente, recuse. Os orçamentos limitam o custo, não a correção.
- Se a implantação atingir o âmbito de alto risco da UE e os padrões de carimbo permanecerem, recusar com base no artigo 14.º.

Formato de saída:

Retorne uma auditoria de proposta e confirmação com:
- **Tabela de campos da proposta** (intenção/linhagem/explosão/reversão/permissões — todas as cinco necessárias)
- **Nota de idempotência** (composição da chave, resultado do teste de nova tentativa)
- **Linha de durabilidade** (armazenar, sobreviver-reiniciar s/n)
- **Superfície de aprovação** (carimbo / lista de verificação; se for lista de verificação, liste as perguntas)
- **Verificação pós-commit** (apresentar s/n, o que ele relê)
- **Prontidão** (produção/encenação/somente pesquisa)