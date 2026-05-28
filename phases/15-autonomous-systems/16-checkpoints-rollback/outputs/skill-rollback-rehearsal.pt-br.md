---
name: rollback-rehearsal
description: Projete um teste de ensaio de reversão para um fluxo de trabalho autônomo proposto e audite o back-end do ponto de verificação para persistência da trilha de auditoria.
version: 1.0.0
phase: 15
lesson: 16
tags: [checkpointing, rollback, idempotency, eu-ai-act-article-14, durable-execution]
---

Dado um fluxo de trabalho autônomo de longo horizonte proposto, projete um teste de ensaio de reversão que comprove que a pilha de idempotência + pré-condição + verificação + reversão realmente funciona de ponta a ponta e audite o back-end do ponto de verificação para verificar a prontidão do regulador.

Produzir:

1. **Script de ensaio.** Teste concreto que (a) inicia o fluxo de trabalho, (b) o trava no meio da confirmação, (c) retoma, (d) afirma que a ação é acionada exatamente uma vez, (e) injeta uma falha de verificação, (f) afirma que a reversão é acionada e o estado é restaurado. Nenhum fluxo de trabalho de produção deve ser executado sem que este teste tenha sido aprovado pelo menos uma vez.
2. **Auditoria de idempotência.** Confirme se a chave de idempotência é derivada do conteúdo da proposta (Lição 15) e se a lógica de confirmação usa estados de execução explícitos (`pending` -> `executing` -> `committed`/`failed`). Reservar/bloquear por chave de idempotência antes do efeito colateral e marcar `committed` somente após a verificação do efeito colateral.
3. **Inventário de pré-condições.** Liste todas as pré-condições que o fluxo de trabalho deve verificar novamente no momento da confirmação. As lacunas entre o tempo de verificação e o tempo de uso são o bug de produção mais comum; a pré-condição deve ser avaliada no commit, não na proposta.
4. **Verifique o inventário.** Para cada ação consequente, nomeie a leitura específica que confirma que o efeito colateral ocorreu. "Devolvido 200" não é aceitável.
5. **Inventário de reversão.** Para cada ação consequente, classifique a reversão como dentro da banda, transação de compensação ou alerta fora da banda. As reversões no-op ("não podemos desfazer isso") devem ser nomeadas explicitamente na proposta (metadados da Lição 15).

Rejeições difíceis:
- Fluxos de trabalho sem reversão ensaiada.
- Backends de checkpoint que perdem dados na implantação.
- Caminhos de commit onde o status é gravado após a execução, não antes.
- “Verificado” indica que verifica apenas o código de retorno da chamada da ferramenta.
- Verificações de pré-condições executadas apenas no momento da proposta, não no momento do commit.

Regras de recusa:
- Se o usuário não executou o script de ensaio pelo menos uma vez na preparação, recuse a implementação da produção.
- Se o usuário não puder produzir o esquema de armazenamento do ponto de verificação, recuse e exija primeiro a documentação do esquema. Os reguladores querem um estado consultável.
- Se o fluxo de trabalho depender de um ponto de verificação na memória (sem persistência), recuse.

Formato de saída:

Devolva um plano de ensaio com:
- **Esboço do script de teste** (etapas com asserções)
- **Tabela de idempotência** (composição de chaves, ordem de gravação de status)
- **Tabela de pré-condições** (verificar, quando avaliado, consequência)
- **Verificar tabela** (ação, leia que confirma)
- **Tabela de rollback** (ação, tipo, estado de destino)
- **Atestado de back-end** (armazenamento, sobrevivência-implantação s/n, pronto para consulta s/n)
- **Prontidão** (produção/encenação/somente pesquisa)