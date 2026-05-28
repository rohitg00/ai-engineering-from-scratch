# Checkpoints e Rollback

> Toda transição de estado de grafo persiste. Quando um worker cai, seu lease expira e outro worker retoma no último checkpoint. Durable Objects da Cloudflare mantêm estado por horas ou semanas. Proposta-então-commit (Aula 15) define um plano de rollback por ação. Verificação pós-ação fecha o loop. Artigo 14 do EU AI Act torna supervisão humana efetiva obrigatória para sistemas de alto risco — na prática isso significa que checkpoints devem ser consultáveis, rollbacks devem ser ensaiados e a trilha de auditoria deve sobreviver a um deploy. O modo de falha agudo: sem chaves de idempotência e verificações de pré-condição, um retry após falha transitória pode duplamente-executar uma ação já aprovada. Verificação pós-ação é o que pega isso.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, máquina de estados de checkpoint e rollback)
**Pré-requisitos:** Fase 15 · 12 (Execução durable), Fase 15 · 15 (Proposta-então-commit)
**Tempo:** ~60 minutos

## O Problema

Execução durable (Aula 12) torna um agente que cai retomável. Proposta-então-commit (Aula 15) torna uma ação aprovada auditável. Esta aula junta os dois: o que acontece quando uma ação aprovada executa parcialmente, cai e retoma? Quando o rollback roda, e contra qual estado?

Sistemas reais conectam isso de forma diferente:

- **LangGraph** checkpoints cada transição de estado de grafo em PostgreSQL. No crash do worker, o lease libera e outro worker retoma no último checkpoint. Workflows pausam em `interrupt()`, que em si persiste.
- **Durable Objects da Cloudflare** mantêm estado por chave por horas ou semanas. Localize o cálculo com o armazenamento para a ação aprovada.
- **Microsoft Agent Framework** expõe primitivas `Checkpoint` na API de workflow; replay mais idempotência cobre retries.

Em todos os casos, a combinação que realmente funciona é: chave de idempotência (impede dupla-execução) + verificação de pré-condição (estado ainda é o que aprovamos) + verificação pós-ação (o efeito colateral realmente aconteceu) + rollback em falha de verificação.

## O Conceito

### Toda transição persiste

Uma transição de estado de grafo é qualquer passo que move o workflow de um estado nomeado para outro. Implementações inocentes persistem apenas em pontos eespecificaçãoíficos de commit; implementações de produção persistem cada transição. O custo (algumas escritas extras) é pequeno em relação à ganho de confiabilidade (replay pousa em qualquer lugar, recuperação de lease é precisa).

### Recuperação de lease

Quando um worker cai, o workflow não é perdido; o lease (uma reivindicação de curta duração de que este worker está executando esta execução) simplesmente expira. Outro worker pega o último checkpoint e resume. O mecanismo de lease é o que permite que sistemas de produção sobrevivam a deploys contínuos sem perder trabalho em voo.

### Idempotência mais pré-condições

Idempotência sozinha não é suficiente. Considere: um workflow está aprovado para "transferir $100 de A para B quando saldo > $1000." O workflow é commitado, cai no meio da execução e resume. Se somente a chave de idempotência for verificada, e a execução resume, a transferência roda uma vez (correto). Mas considere que entre o crash e o resume, o saldo de A cai para $500 via um workflow diferente. A verificação de idempotência ainda passa; a pré-condição não. Sem verificação de pré-condição, enviamos um estouro de limite.

Toda ação consequencial precisa de ambos:

- **Chave de idempotência**: impede dupla-execução.
- **Verificação de pré-condição**: confirma que o estado ainda está consistente com o que foi aprovado.

### Verificação pós-ação

"A ferramenta retornou 200" não é verificação. Verificação real relê o estado alvo e confirma que o efeito colateral realmente aconteceu. Padrões:

- Atualização de banco: `UPDATE ... RETURNING *` depois assertar que a linha retornada corresponde ao estado pretendido.
- Envio de email: verificar pasta de enviados pelo ID da mensagem após envio.
- Escrita de arquivo: reler o arquivo e calcular hash.
- Chamada de API: `GET` subsequente no recurso alvo.

Se a verificação falhar, o workflow está em um estado conhecido-ruim. Rollback é acionado.

### Planos de rollback

Toda ação consequencial em proposta-então-commit (Aula 15) carrega um plano de rollback. Tipos:

- **Rollback in-band**: reverter o efeito colateral diretamente (`DELETE` após `INSERT`, `enviar-email-de-correção` após envio).
- **Transação compensatória**: uma nova ação que neutraliza a original (padrão SAGA).
- **Rollback out-of-band**: alertar um humano, pausar o workflow, deixar o estado ruim para investigação.

Rollback no-op ("não podemos desfazer isso") deve ser nomeado na proposta. Ações sem rollback exigem HITL mais forte no momento do commit (pergunta-e-resposta da Aula 15).

### Leitura operacional do Artigo 14 do EU AI Act

Artigo 14 exige "supervisão humana efetiva" para sistemas de alto risco. Em termos operacionais, implementadores leem como:

- Checkpoints são consultáveis por um auditor.
- Rollbacks são ensaiados (testados de ponta a ponta pelo menos uma vez).
- A trilha de auditoria sobrevive a um implantação (backend de checkpoint não é efêmero).
- Falhas de verificação são alertadas, não logadas silenciosamente.

Um workflow que cai no meio de um commit, resume e completa o efeito colateral sem caminho de verificação + rollback não sobrevive ao teste do Artigo 14.

### O modo de falha agudo: dupla-execução

O incidente de produção mais comum neste espaço:

1. Ação aprovada, chave de idempotência k.
2. Commit começa, executa, retorna 200.
3. Workflow cai antes de persistir o status "comprometido."
4. Workflow resume; vê "aprovado mas não comprometido"; re-executa.
5. Efeito colateral dispara duas vezes.

Mitigação: persistir uma intenção "em voo" antes da execução, executar com chave de idempotência, depois marcar "comprometido" somente após verificação pós-ação ter sucesso. Se a ação disparar e a escrita de status falhar, você sabe que deve verificar e (se necessário) re-executar. Se a escrita de status tiver sucesso e a ação falhar, você verifica e executa exatamente uma vez via caminho de recuperação.

## Use

`code/main.py` implementa um workflow com checkpoint com idempotência, pré-condições, verificação e rollback. O driver simula quatro cenários: execução limpa, retry após crash (idempotência pega), falha de pré-condição (workflow aborta sem disparar), falha de verificação (rollback dispara).

## Entregue

`outputs/skill-rollback-rehearsal.md` projeta um teste de ensaio de rollback para um workflow proposto e audita o backend de checkpoint para persistência de trilha de auditoria.

## Exercícios

1. Rode `code/main.py`. Verifique os quatro cenários. Para o caso de crash durante commit, confirme que a ação dispara exatamente uma vez entre retries.

2. Modifique o padrão "marcar como feito primeiro, depois fazer" para que a escrita de status dispare após a ação. Rode novamente o cenário de crash. Meça quantas ações duplicadas disparam.

3. Projete um plano de rollback para uma ação de produção eespecificaçãoífica (ex: "postar em um canal Slack"). Classifique como in-band, compensatório ou out-of-band. Justifique a escolha.

4. Pegue um workflow que você conheça. Identifique cada transição de estado. Marque cada uma com um requisito de durabilidade (persistir / não persistir). Conte as que você atualmente não está persistindo.

5. Teste de rollback ensaiado: projete um teste de ponta a ponta que roda um workflow real, cai e confirma que o caminho de rollback dispara. O que o teste asserta?

## Termos-Chave

| Termo | O que dizem | O que significa de verdade |
|---|---|---|
| Checkpoint | "Ponto de salvamento" | Toda transição de estado de grafo persiste em armazenamento durable |
| Lease | "Reivindicação de worker" | Reivindicação de curta duração de que um worker está executando uma execução; expira em crash |
| Pré-condição | "Gate de estado" | Aserção de que o estado ainda está consistente com a ação aprovada |
| Verificação pós-ação | "Reler e verificar" | Confirmar que o efeito colateral realmente aconteceu no sistema alvo |
| Rollback in-band | "Desfazer direto" | Reverter o efeito colateral com a operação inversa |
| Transação compensatória | "Desfazer SAGA" | Nova ação que neutraliza a original |
| Marcar-como-feito-primeiro | "Ordem de escrita de status" | Persistir o status comprometido antes de retornar do commit |
| Artigo 14 | "Supervisão humana EU AI Act" | Operacional: checkpoints consultáveis, rollbacks ensaiados, trilha auditável |

## Leituras Adicionais

- [Microsoft Agent Framework — Checkpointing and HITL](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) — primitivas de checkpoint e recuperação de lease.
- [Cloudflare Agents — Human in the loop](https://developers.cloudflare.com/agents/concepts/human-in-the-loop/) — Durable Objects como substrato de estado.
- [EU AI Act — Article 14: Human oversight](https://artificialintelligenceact.eu/article/14/) — base regulatória.
- [Anthropic — Measuring agente autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — enquadramento de confiabilidade para workflows de longo prazo.
- [Anthropic — Claude Code Agent SDK: agente loop](https://code.claude.com/docs/en/agent-sdk/agent-loop) — forma de workflow para Claude Code Routines.
