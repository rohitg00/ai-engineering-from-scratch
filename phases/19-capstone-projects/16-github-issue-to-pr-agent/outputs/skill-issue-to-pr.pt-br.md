---
name: issue-to-pr
description: Crie um agente assíncrono de emissão para PR do GitHub que seja executado em um sandbox de nuvem, reproduza a compilação, verifique os testes e abra PRs prontos para revisão dentro de orçamentos rigorosos por repositório.
version: 1.0.0
phase: 19
lesson: 16
tags: [capstone, async-agent, github, fargate, daytona, swe-bench, budget, safety]
---

Dado um repositório GitHub com problemas rotulados como `@agent fix this`, envie um agente de nuvem auto-hospedado que transforme cada problema rotulado em um PR pronto para revisão com credenciais de escopo e custo limitado.

Plano de construção:

1. Aplicativo GitHub com token refinado: problemas rw, gravação de PRs, conteúdo rw, leitura de fluxos de trabalho. Sem pressão forçada. A proteção de ramificação principal evita gravações diretas.
2. O receptor Webhook (Lambda ou Fly.io) filtra eventos de rótulo/comentário de PR e enfileira-se no SQS.
3. O despachante impõe limites de contagem de $ e PR por dia por recompra; gera uma tarefa do ECS Fargate por trabalho permitido.
4. Inferência de ambiente: detecta idioma + gerenciador de pacotes + tempo de execução do conteúdo do repositório. Sintetize um Dockerfile instantaneamente, se estiver ausente.
5. Sandbox Daytona ou E2B por tarefa. Clone o repositório em uma nova ramificação do agente `git worktree` +.
6. Loop de agente (mini-swe-agent ou SWE-agent v2 sobre Claude Opus 4.7 ou GPT-5.4-Codex). Ferramentas: ripgrep, mapa de repositório de árvore, read_file, edit_file, run_tests, git. Limites: $ 20, 30 voltas, 30 min.
7. Verifique: CI completo na sandbox; delta de cobertura via jacoco/coverage.py; rótulo `needs-review` se delta < -2%; parar se CI estiver vermelho.
8. PR aberto via API GitHub com justificativa, resumo de diferenças, URL de rastreamento, custo, turnos.
9. Observabilidade: rastreamento Langfuse por PR; limpeza de log para segredos; painel de orçamento por repositório.
10. Avaliação de 30 questões internas semeadas; compare com agentes de fundo Cursor e agentes AWS Remote SWE em um subconjunto compartilhado de três problemas.

Rubrica de avaliação:

| Peso | Critério | Medição |
|:-:|---|---|
| 25 | Taxa de aprovação em 30 questões | Sucesso de ponta a ponta (CI verde + cobertura OK) |
| 20 | Qualidade de relações públicas | Tamanho do diferencial, delta de cobertura, conformidade de estilo |
| 20 | Custo e latência por problema resolvido | $/PR e relógio de parede/PR |
| 20 | Segurança | Token com escopo definido, orçamento por repositório, sem pressão forçada, higiene de credenciais |
| 15 | Experiência do operador | Comentários de justificativa, capacidade de repetição, acompanhamento de @menção |

Rejeições difíceis:

- Qualquer agente que possa forçar o push. Exclusão difícil.
- Despachantes que ignoram as verificações orçamentárias. Os loops descontrolados são o fracasso clássico.
- PRs abertos sem que o CI completo tenha passado no sandbox.
- Rastreie arquivos contendo tokens ou PII não editados.

Regras de recusa:

- Recuse-se a instalar sem proteção de ramificação na rede principal.
- Recuse-se a operar sem um orçamento diário por repo (dólares e contagem de PR).
- Recuse-se a repetir automaticamente as execuções com falha; todas as novas tentativas exigem uma reaplicação humana do rótulo.

Saída: um repositório contendo o aplicativo GitHub, o receptor de webhook, o despachante + razão de orçamento, a definição de tarefa Fargate, o gerenciador de ciclo de vida do sandbox, o loop do mini-swe-agent, a execução de avaliação de 30 problemas, uma comparação lado a lado com Agentes de fundo do Cursor e Agentes AWS Remote SWE e um artigo nomeando as três principais falhas de inferência de compilação e a alteração de síntese do Dockerfile que reduziu cada uma.