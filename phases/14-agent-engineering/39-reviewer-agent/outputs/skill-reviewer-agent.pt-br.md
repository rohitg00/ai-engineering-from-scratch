---
name: reviewer-agent
description: Stand up a reviewer agent role with a five-dimension rubric that reads builder artifacts, produces a structured review report, and starts human review from a written page instead of a blank one.
version: 1.0.0
phase: 14
lesson: 39
tags: [reviewer, rubric, role-separation, second-loop, review-report]
---
---
name: reviewer-agent
description: Stand up a reviewer agent role with a five-dimension rubric that reads builder artifacts, produces a structured review report, and starts human review from a written page instead of a blank one.
version: 1.0.0
phase: 14
lesson: 39
tags: [reviewer, rubric, role-separation, second-loop, review-report]
---

Dado um agente construtor que já produz artefatos de ambiente de trabalho, crie um revisor que os leia e escreva relatórios estruturados.

Produzir:

1. `agents/reviewer.md` com aviso do sistema do revisor: acesso somente leitura, rubrica de cinco dimensões, deve citar o caminho do artefato para cada pontuação.
2. `tools/reviewer.py` que carrega `ReviewerInputs` do ambiente de trabalho e executa o marcador LLM por dimensão.
3. `outputs/review/<task_id>.json` como caminho do relatório de revisão canônica.
4. `docs/reviewer-rubric.md` listando as cinco dimensões, a pergunta que cada uma responde e as descrições das âncoras 0-1-2.
5. Etapa do CI que publica o relatório de revisão como um comentário de PR sempre que uma tarefa do construtor é encerrada.

Rejeições difíceis:

- Um revisor com acesso de gravação ao diff. A lacuna entre o construtor e o revisor é o sinal completo; desmoroná-lo destrói a confiabilidade.
- Uma rubrica sem descrições âncoras por pontuação. "Pontuação de 0 a 2" sem âncoras desmorona em vibrações.
- Revise relatórios que omitem citações. Cada pontuação deve apontar para um arquivo ou entrada de rastreamento.
- Compartilhando o prompt do sistema do construtor. O mesmo modelo está bom; mesmo prompt não é.

Regras de recusa:

- Se o construtor não produzir nenhum relatório de verificação, recuse-se a executar o revisor. A aceitação deve ser mantida antes que valha a pena pedir julgamento.
- Se o projeto tiver menos de três tarefas fechadas, recuse-se a reivindicar que a rubrica está calibrada. Salve os primeiros relatórios como conjunto de calibração.
- Se o revisor for solicitado a pontuar abaixo de um nível mínimo de confiança, recuse e exponha a dimensão incerta a um ser humano.

Estrutura de saída:

```
<repo>/
├── agents/reviewer.md
├── tools/reviewer.py
├── outputs/review/
│   └── <task_id>.json
├── docs/reviewer-rubric.md
└── .github/workflows/review.yml
```

Termine com "o que ler a seguir" apontando para:

- Lição 40 para o pacote de handoff que combina verificação + revisão.
- Lição 41 para a tarefa de estilo real que exercita a separação entre construtor e revisor de ponta a ponta.
- Lição 05 (Self-Refine e CRITIC) para a linha de base de autoavaliação de agente único que esta lição aprimora.