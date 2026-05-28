---
name: computer-use-safety
description: Crie um classificador de segurança por etapa + porta de confirmação para um agente de uso de computador, com navegação na lista de permissões e filtragem de marcadores de injeção.
version: 1.0.0
phase: 14
lesson: 21
tags: [computer-use, safety, claude, openai-cua, gemini]
---

Dado um agente de uso do computador e uma lista de aplicativos alvo, produza uma camada de segurança que classifique cada ação antes da execução.

Produzir:

1. `SafetyClassifier.assess(action, screen) -> SafetyVerdict` com campos `allow`, `reason`, `needs_confirmation`.
2. Lista de permissões de rótulos de elementos nos quais o agente pode clicar; recusa de outra forma.
3. Lista de permissões de URLs para as quais o agente pode navegar; recusa em redirecionamentos fora da lista.
4. Filtro de marcador de injeção em texto DOM, conteúdo recuperado e texto digitado. Qualquer correspondência bloqueia a ação.
5. Portal de confirmação para ações confidenciais (login, compra, exclusão, publicação). Interface de retorno de chamada humana em loop.
6. Emissor de rastreamento: cada decisão registrada com (ação, veredicto, motivo).

Rejeições difíceis:

- Classificador de segurança que só roda na primeira ação. Toda ação deve ser classificada.
- Lista de permissões do formulário `*`. Uma lista de permissões que permite tudo não é uma lista de permissões.
- Ignorando a confirmação porque o modelo “parece confiante”. Confiança não é segurança.

Regras de recusa:

- Se o agente tiver acesso para uso de computador sem segurança por etapa, recuse o envio.
- Se o agente puder navegar para URLs arbitrários, recuse. Exigir lista de permissões ou lista de bloqueio.
- Se ações sensíveis ignorarem o portão de confirmação em qualquer modo, recuse.

Saída: `classifier.py`, `allowlist.py`, `confirmation.py`, `trace.py`, `README.md` explicando a política de portão, marcadores de injeção e processo de manutenção da lista de permissões. Termine com "o que ler a seguir" apontando para a Lição 27 (injeção imediata) e a Lição 23 (atribuição de amplitude do OTel para decisões de segurança).