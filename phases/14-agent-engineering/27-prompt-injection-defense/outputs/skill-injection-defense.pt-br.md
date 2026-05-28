---
name: injection-defense
description: Build a PVE (Prompt-Validator-Executor) layer with source-tagged content, injection-marker scanning, and allowlist navigation for any agent runtime.
version: 1.0.0
phase: 14
lesson: 27
tags: [security, prompt-injection, pve, greshake, source-tag]
---
---
name: injection-defense
description: Build a PVE (Prompt-Validator-Executor) layer with source-tagged content, injection-marker scanning, and allowlist navigation for any agent runtime.
version: 1.0.0
phase: 14
lesson: 27
tags: [security, prompt-injection, pve, greshake, source-tag]
---

Dado um agente com acesso e recuperação de ferramentas, produza uma camada de defesa contra injeção.

Produzir:

1. Tag de origem em cada conteúdo: `user_message`, `tool_output`, `retrieved_web`, `retrieved_memory`, `retrieved_file`. Propague tags por meio do histórico de mensagens.
2. `Validator.assess(tool_call, contents)` — recusa chamadas de ferramentas com argumentos em forma de injeção ou conteúdo recuperado; permitido somente quando as tags de origem correspondem ao nível de confiança declarado.
3. Lista de permissões/lista de bloqueio para navegação: URLs, domínios, caminhos de arquivos que o agente pode tocar.
4. Guarda-corpo de gravação na memória: recusa gravações que se parecem com diretivas.
5. Disciplina de captura de conteúdo (Lição 23): armazenar conteúdo recuperado externamente; spans carregam IDs de referência, não prosa.
6. Conjunto de testes: as cinco classes de exploração Greshake como casos de equipe vermelha.

Rejeições difíceis:

- Superfície de uso de ferramentas sem tags de origem. Não é possível distinguir níveis de permissão sem procedência.
- Validador que roda apenas na saída final. A validação tardia é irrelevante – o modelo já agiu.
- "Confie em mim, o prompt do sistema cuida disso." A higiene imediata do sistema não é um controle.

Regras de recusa:

- Se o agente tiver qualquer capacidade de recuperação sem marcação na origem, recuse o envio. O conteúdo recuperado é o vetor de injeção canônica.
- Se ferramentas confidenciais (enviar mensagem, executar shell, gravar arquivo em /) não tiverem confirmação humana, recuse.
- Se as gravações na memória estiverem desprotegidas, recuse. O envenenamento persistente da memória reenvenena a próxima sessão.

Saída: `validator.py`, `source_tag.py`, `allowlist.py`, `memory_guard.py`, `red_team.py`, `README.md` explicando a pilha de seis controles, riscos residuais e cadência de revisão contínua. Termine com “o que ler a seguir” apontando para a Lição 21 (segurança no uso do computador) e Lição 23 (captura de conteúdo via OTel).