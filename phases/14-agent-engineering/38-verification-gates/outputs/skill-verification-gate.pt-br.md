---
name: verification-gate
description: Gere uma porta de verificação determinística que combine escopo, regra e artefatos de feedback em um único verify_report.json por tarefa, além de fiação de CI que se recusa a mesclar sem um veredicto verde.
version: 1.0.0
phase: 14
lesson: 38
tags: [verification, gate, deterministic, ci, override-log]
---

Dados os critérios de aceitação de um projeto e os artefatos de ambiente de trabalho existentes, produza a porta de verificação e substitua o log de auditoria.

Produzir:

1. `tools/verify_agent.py` expondo `verify(task_id, artifacts) -> VerdictReport`. Função pura, determinística, sem chamadas LLM.
2. `outputs/verification/<task_id>.json` como a única fonte do veredicto da verdade.
3. `tools/override.py` que anexa entradas de substituição assinadas a `outputs/verification/overrides.jsonl` (deve incluir motivo, ID do usuário, carimbo de data/hora, código de localização).
4. Fluxo de trabalho de CI que falha em `passed: false` e exibe o relatório in-line.
5. `docs/verification.md` listando cada verificação, sua gravidade, seu artefato de origem e a política de substituição.

Rejeições difíceis:

- Um cheque que chama um LLM. O portão é um encanamento determinístico; O julgamento do LLM pertence ao revisor.
- Um caminho de substituição que o agente pode seguir sem uma entrada assinada. As substituições são apenas humanas.
- Um relatório de verificação que omite os caminhos do artefato consumido. Os relatórios devem ser auditáveis.
- Descobertas de gravidade de bloco que o fluxo de trabalho pode fazer downgrade silenciosamente. A gravidade é fixada no momento da gravação, não no momento da leitura.

Regras de recusa:

- Caso o projeto não possua comando de aceitação, recuse o envio da comporta até que exista. Um portão que não prova nada é teatro.
- Se o relatório de regras não existir, recuse-se a pular a verificação de regras; falhar fechado.
- Se o log de feedback não existir, recuse-se a pular a verificação de aceitação; os logs ausentes são eles próprios um bloco.
- Se as entradas de substituição não forem controladas por versão, recuse a ligação do caminho de substituição; substituições off-the-record derrotam o portão.

Estrutura de saída:

```
<repo>/
├── tools/
│   ├── verify_agent.py
│   └── override.py
├── outputs/verification/
│   ├── overrides.jsonl
│   └── <task_id>.json
├── docs/verification.md
└── .github/workflows/verify.yml
```

Termine com "o que ler a seguir" apontando para:

- Lição 39 para o agente revisor que continua após um veredicto verde.
- Lição 40 para o gerador de handoff que inclui o veredicto no pacote.
- Lição 41 para executar o portão em um aplicativo de amostra de estilo real.