# Pontos de controlo e retorno

> Cada transição grafico-estado persiste. Quando um trabalhador cai, o contrato de locação expira e outro trabalhador pega no último ponto de controlo. Os objetos duráveis Cloudflare mantêm o estado durante horas ou semanas. Propõe-se então um compromisso (Lessão 15) define um plano de retrocesso por acção. A verificação pós-ação fecha o ciclo. O artigo 14.o da Lei da UE sobre IA torna obrigatória a supervisão humana eficaz para os sistemas de alto risco  na prática, isto significa que os pontos de controlo devem ser interrogáveis, os rollbacks devem ser ensaiados e a trilha de auditoria deve sobreviver à implantação. O modo de falha aguda: sem as chaves de idempotencia e os controlos de pré-condição, uma nova tentativa após uma falha transitória pode duplicar a execução de uma ação já aprovada. A verificação pós-ação é o que a apanha.

**Type:** Learn
**Languages:** Python (stdlib, checkpoint and rollback state machine), TypeScript
**Prerequisites:** Phase 15 · 12 (Durable execution), Phase 15 · 15 (Propose-then-commit)
**Time:** ~60 minutes

## O problema

A execução duradoura (Lessão 12) torna um agente quebrado reiniciável. Propõe-depois-compromete (Lessão 15) torna uma ação aprovada auditável. Esta lição se junta a eles: o que acontece quando uma ação aprovada executar parcialmente, quebrou e reiniciou? Quando é que o rollback é executado e contra que estado?

Os sistemas reais transmitem isto de forma diferente:

- **LangGraph**Os dados de trabalho são de acordo com o sistema de verificação de dados de um funcionário.`interrupt()`, que por si só persiste.
- **Cloudflare Durable Objects**Mantém o estado de cada chave durante horas ou semanas. Co-localize o cálculo com o armazenamento para a ação aprovada.
- **Microsoft Agent Framework**expõe`Checkpoint`As alterações de desempenho são consideradas como "primitivas" na API do fluxo de trabalho; replay mais idempotency cobre retemptations.

Em todos os casos, a combinação que realmente funciona é: chave de idempotency (preventa dupla execução) + verificação de pré-condição (o estado ainda é o que aprovamos contra) + verificação pós-ação (o efeito colateral realmente aconteceu) + retrocesso na verificação-falha.

## O conceito

### Cada transição persiste .

Uma transição grafico-estado é qualquer passo que move o fluxo de trabalho de um estado chamado para outro. Implementações ingênuos persistem apenas em pontos específicos de compromisso; implementações de produção persistem em cada transição. O custo (alguns escritos extras) é pequeno em relação ao ganho de confiabilidade (replay aterrissa em qualquer lugar, recuperação de arrendamento é precisa).

### Recuperação do arrendamento

Quando um trabalhador cai, o fluxo de trabalho não é perdido; o contrato de locação (uma alegação de curta duração de que esse trabalhador está executando essa corrida) simplesmente expira. Outro trabalhador pega o último ponto de controle e retoma. O mecanismo de locação é o que permite que os sistemas de produção sobrevivam às implantações em movimento sem perder o trabalho em voo.

### Idempotencia mais condições prévias

A independência não basta.$100 from A to B when balance > $1000. " O fluxo de trabalho é comprometido, desabar no meio da execução e retoma. Se apenas a chave de idempotencia for verificada e a execução for retomada, a transferência será executada uma vez (correto). Mas considere que entre o crash e o resume, o saldo de A cai para $500 através de um fluxo de trabalho diferente. O controle de idempotencia ainda passa; a pré-condição não. Sem um controle de pré-condição, enviamos um overdraft.

Toda a acção consequente requer:

- **Idempotency key**: previne a dupla execução.
- **Precondition check**A Comissão considera que o Estado deve dar continuidade ao seu acordo.

### Verificação pós-ação

"A ferramenta devolvida 200" não é verificação. Verificação real lê novamente o estado-alvo e confirma o efeito colateral realmente aconteceu. padrões:

- Atualização da base de dados: `UPDATE ... RETURNING *`A seguir, afirmar o estado previsto das correspondências de filas devolvidas.
- Envio de e-mail: verifique a pasta enviada para a identificação da mensagem após a submissão.
- Escrever arquivo: ler o arquivo de volta e hash-o.
- Aplicação da API: acompanhamento `GET`sobre o recurso alvo.

Se a verificação falhar, o fluxo de trabalho está num estado conhecido de mau desempenho.

### Planejamento de reestruturação

Cada acção consequente na proposta-depois-compromisso (Lessão 15) contém um plano de retrocesso.

- **In-band rollback**: inverter directamente o efeito colateral (`DELETE`Depois`INSERT`- Não .`Send-correction-email`após a envio).
- **Compensating transaction**: uma nova acção que neutraliza o original (patrão SAGA padrão).
- **Out-of-band rollback**Alerta um ser humano, pausa o fluxo de trabalho, deixa o mau estado para investigação.

Ações sem retrocesso exigem um maior nível de TIH no momento do compromisso (Lessão 15 - desafio e resposta).

### Lei da IA da UE Artigo 14 Leitura operacional

O artigo 14.o exige "supervisão humana eficaz" dos sistemas de alto risco.

- Os pontos de controlo são consultáveis por um auditor.
- Os rollbacks são ensaiados (testados de ponta a ponta pelo menos uma vez).
- A trilha de auditoria sobrevive a uma implantação (o backend do checkpoint não é efêmero).
- As verificações falhadas são alertadas, não registadas silenciosamente.

Um fluxo de trabalho que falhe no meio do compromisso, retoma e completa o efeito colateral sem um caminho de verificação + retrocesso não sobrevive ao teste do artigo 14.o.

### Modo de falha aguda: duplo executador

O incidente de produção mais comum neste espaço:

1. Ação aprovada, chave de independência k.
2. Compromissos inicia, executa, retorna 200.
3. O fluxo de trabalho falha antes de persistir o status de "compromiso".
4. O fluxo de trabalho é reiniciado; vê "aprovado, mas não comprometido"; re-executado.
5. Efeito secundário disparos duas vezes.

Mitigação: persistir em uma intenção "em voo" antes da execução, executar com uma chave de idempotency, em seguida, marcar "comprometeu" apenas após a verificação pós-ação ser bem sucedida. Se o tiro de ação e o status write falhar, você sabe para verificar e (se necessário) refire. Se o status write é bem sucedido e a ação falha, você verificar e disparar exatamente uma vez através do caminho de recuperação.

```figure
checkpoint-replay
```

## Usá-lo

`code/main.py`Implementa um fluxo de trabalho com controle de controle com idempotencia, pré-condições, verificação e retrocesso. O motorista simula quatro cenários: execução limpa, retoma após o acidente (apanhadas de idempotencia), falha de pré-condição (abortes de fluxo de trabalho sem disparos), verificação de falha (incêndios de retrocesso).

## Envia-o

`outputs/skill-rollback-rehearsal.md`concebe um teste de ensaio de retrocesso para um fluxo de trabalho proposto e verifica o backend do ponto de controlo para verificar a persistência da trilha de auditoria.

## Exercícios

1. Corra .`code/main.py`Verifique os quatro cenários, para o caso de acidente durante o compromisso, confirme os disparos de ação exatamente uma vez em todas as retemptadas.

2. Modifique o padrão "marque como feito primeiro, depois faça" para que o status escreva incêndios após a ação. Reinicie o cenário de crash. Messa quantas ações duplicadas disparam.

3. Desenhar um plano de reestruturação para uma ação de produção específica (por exemplo, "postar para um canal Slack"). Classificar como dentro da banda, compensando ou fora da banda. Justificar a escolha.

4. Tome um fluxo de trabalho que você conhece. Identifique cada transição de estado. Marque cada uma com um requisito de durabilidade (persistir / não persistir). Conte aqueles que você não está atualmente persistir.

5. Teste repetido de retrocesso: desenhar um teste de ponta a ponta que execute um fluxo de trabalho real, o bloqueie e confirme os incêndios do caminho de retrocesso.

## Termos-chave

| Term | What people say | What it actually means |
|---|---|---|
| Checkpoint | "Save point" | Every graph-state transition persists to a durable store |
| Lease | "Worker claim" | Short-lived claim that a worker is executing a run; expires on crash |
| Precondition | "State gate" | Assertion that the state is still consistent with the approved action |
| Post-action verify | "Re-read check" | Confirm the side effect actually happened in the target system |
| In-band rollback | "Direct undo" | Reverse the side effect with the inverse operation |
| Compensating transaction | "SAGA undo" | A new action that neutralizes the original |
| Mark-as-done-first | "Status write order" | Persist the committed status before returning from commit |
| Article 14 | "EU AI Act human oversight" | Operational: queryable checkpoints, rehearsed rollbacks, auditable trail |

## Mais leitura

- [Microsoft Agent Framework — Checkpointing and HITL](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) Primitivos de pontos de controlo e recuperação de arrendamento.
- [Cloudflare Agents — Human in the loop](https://developers.cloudflare.com/agents/concepts/human-in-the-loop/) Objetos duráveis como um substrato de estado.
- [EU AI Act — Article 14: Human oversight](https://artificialintelligenceact.eu/article/14/) Linha de base regulatória.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) enquadramento de confiabilidade para os fluxos de trabalho de longo prazo.
- [Anthropic — Claude Code Agent SDK: agent loop](https://code.claude.com/docs/en/agent-sdk/agent-loop) Forma do fluxo de trabalho para Routines de código Claude.
