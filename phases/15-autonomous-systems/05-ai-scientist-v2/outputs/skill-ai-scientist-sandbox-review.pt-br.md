---
name: ai-scientist-sandbox-review
description: Lista de verificação de revisão de duas portas para resultados do agente do circuito de pesquisa antes que qualquer coisa saia da sandbox.
version: 1.0.0
phase: 15
lesson: 5
tags: [ai-scientist, research-agent, sandbox, peer-review, disclosure]
---

Dado um resultado de pesquisa autônomo (hipótese, código, experimentos, figuras, rascunho de papel) produzido por um loop estilo AI-Scientist-v2, produza uma revisão de duas portas: auditoria de sandbox (sair alguma coisa?) mais auditoria de pesquisa (o trabalho é bom?).

Os dois portões são mapeados diretamente nas auditorias abaixo: **Sandbox gate = item 1**; **Portão de pesquisa = itens 2 (auditoria experimental) + 3 (auditoria polonesa)**. Os itens 4–5 regem o que acontece depois que ambos os portões passam.

Produzir:

1. **Portão da sandbox.** Antes de qualquer artefato sair da sandbox:
   - Liste todas as chamadas de rede feitas pelo loop e seu destino. Sinalize aqueles que não foram pré-aprovados.
   - Faça um inventário de cada arquivo que o loop gravou fora de seu diretório de trabalho.
   - Confirme a contenção do Docker/seccomp/gVisor mantida durante a execução completa.
   - Confirme se nenhum subprocesso escapou da supervisão do sandbox.
   Se alguma verificação falhar, bloqueie a exportação; elevar a um humano.
2. **Auditoria do experimento.** Leia o código do experimento, não o documento:
   - Verifique se todos os experimentos reivindicados foram realmente executados e se os números relatados são reproduzíveis.
   - Verifique se os experimentos fracassados ​​foram relatados como falhas, e não reformulados como resultados negativos após o fato.
   - Verifique se o rótulo de “novidade” na ideia se compara a uma pesquisa bibliográfica realizada por um especialista no domínio humano.
3. **Auditoria polonesa.** Leia os números:
   - Certifique-se de que os dados de cada figura vieram de um experimento registrado, e não de uma reescrita em estágio de polimento.
   - Confirme se os eixos, escalas e anotações correspondem aos dados subjacentes.
   - Sinalize qualquer figura cuja legenda afirme mais do que os dados suportam.
4. **Plano de divulgação.** Se o artefato for destinado à distribuição externa:
   - Divulgue que o artefato é de autoria do agente.
   - Divulgar as ferramentas utilizadas (família de modelos, versão loop).
   - Divulgar o revisor humano que verificou e o que verificou.
5. **Decisão de liberação negativa.** Se o artefato falhar em qualquer etapa de auditoria, o padrão será não liberar. A substituição deste padrão requer um proprietário humano nomeado.

Rejeições difíceis:
- Qualquer envio que pule qualquer um dos portões.
- Qualquer artefato onde os logs de execução do loop estejam ausentes ou incompletos.
- Qualquer valor que não possa ser atribuído a uma experiência específica.
- Qualquer novidade que um especialista do domínio não tenha verificado.

Regras de recusa:
- Se a execução não tiver Docker ou isolamento equivalente, recuse e exija uma nova execução em uma sandbox isolada.
- Se o usuário não puder produzir logs de execução para a fase experimental, recuse — o artigo não pode ser revisado.
- Se o canal de distribuição proposto for um local revisado por pares e o usuário propor não divulgar a autoria do agente, recuse e exija a divulgação.

Formato de saída:

Retorne um relatório de duas portas:
- **Veredicto do sandbox gate** (PASS / BLOCK, com justificativa)
- **Veredicto do portão de pesquisa** (abrange auditoria de experimento (2) e auditoria polonesa (3)) (PASS / BLOCK / REQUIRES_EXPERT, com notas por verificação)
- **Plano de divulgação** (local, texto, nome do revisor humano)
- **Decisão de liberação** (liberar/reter/rejeitar)
- **Próxima ação** (quem faz o quê e quando)