---
name: workbench-audit
description: Audite um repositório para as sete superfícies do ambiente de trabalho do agente e relate quais estão ausentes, parciais ou íntegras antes de qualquer trabalho do agente começar.
version: 1.0.0
phase: 14
lesson: 31
tags: [workbench, audit, reliability, agent-engineering]
---

Dado um caminho de repositório e o produto do agente que será executado dentro dele, audite as sete superfícies do ambiente de trabalho e produza um relatório de prontidão.

As sete superfícies:

1. Instruções: um arquivo raiz que o agente lê primeiro (por exemplo, `AGENTS.md`), curto, que direciona para regras mais profundas.
2. Estado: um arquivo durável e legível por máquina que registra tarefas, arquivos tocados, bloqueadores e próxima ação.
3. Escopo: um contrato por tarefa listando arquivos permitidos, arquivos proibidos, critérios de aceitação, plano de reversão.
4. Feedback: um executor que captura comando, stdout, stderr, código de saída e alimenta o resultado de volta no loop.
5. Verificação: uma porta que executa testes, fiapos, verificação de tipo, execução de fumaça e confirma critérios de aceitação.
6. Revisão: uma segunda passagem com função diferente, construtora não pode marcar sua própria obra.
7. Handoff: um artefato que resume o que mudou, por que, o que resta e a próxima melhor ação.

Produzir:

- Uma pontuação por superfície: 0 faltantes, 1 parcial, 2 saudáveis. Vincule cada pontuação a um arquivo ou processo que você observou.
- Três prioridades ordenadas por alavancagem: qual superfície faltante, se adicionada primeiro, remove o maior número de modos de falha.
- Um relatório `workbench_audit.json` legível por máquina mais um resumo `workbench_audit.md` legível por humanos.
- Um patch inicial para a superfície mais fraca: a menor alteração no arquivo que move a pontuação de 0 para 1.

Rejeições difíceis:

- Pontuações "saudáveis" sem caminho de arquivo ou referência de processo. Auditorias sem evidências apodrecem.
- Uma única superfície combinada de "configuração do agente". A combinação de superfícies oculta qual delas falhou quando uma tarefa é interrompida.
- Ignorando a verificação porque os testes são lentos. Se a verificação não estiver na bancada, os construtores marcam o seu próprio trabalho de casa.

Regras de recusa:

- Se o repositório não tiver nenhum comando de teste, recuse a pontuação de verificação e apresente-a como uma descoberta de bloqueio.
- Se o repositório não tiver histórico de controle de versão, recuse a pontuação de transferência e apresente-a como uma descoberta de bloqueio.
- Se o produto do agente for executado como root ou com acesso irrestrito a arquivos, recuse a pontuação do escopo até que um sandbox ou uma lista de gravação seja definida.

Estrutura de saída:

```
workbench-audit/
├── workbench_audit.json
├── workbench_audit.md
├── patches/
│   └── <weakest-surface>.patch
└── README.md
```

Termine com "o que ler a seguir" apontando para:

- Lição 32 para o layout mínimo do repositório.
- Lição 33 para as instruções em profundidade.
- Lição 38 para o portão de verificação.