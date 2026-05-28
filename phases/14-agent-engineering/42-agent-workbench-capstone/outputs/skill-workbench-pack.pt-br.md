---
name: workbench-pack
description: Gere um pacote de ambiente de trabalho de agente personalizado ajustado ao projeto — regras ajustadas ao histórico da equipe, globos de escopo correspondentes ao repositório, dimensões de rubrica estendidas com uma entrada específica de domínio.
version: 1.0.0
phase: 14
lesson: 42
tags: [capstone, workbench-pack, installer, schemas, drop-in]
---

Dado um repositório, o histórico de incidentes da equipe e o produto do agente em execução nele, emitem um pacote de ambiente de trabalho de agente ajustado e um instalador.

Produzir:

1. Diretório `agent-workbench-pack/` correspondente ao layout canônico: AGENTS.md, docs/, schemas/, scripts/, bin/, README.md, VERSION.
2. Um `bin/install.sh` que se recusa a destruir um pacote existente sem `--force` e grava `.workbench-version` no repositório de destino.
3. Versões ajustadas ao projeto de `agent-rules.md` (com pelo menos uma regra por categoria derivada dos últimos seis incidentes da equipe), `reviewer-rubric.md` (com uma sexta dimensão de domínio) e `scope_contract.schema.json` (com globs específicos do projeto).
4. Um script `lint_pack.py` que falha no desvio entre scripts e esquemas ou entre VERSION e o `schema_version` dos esquemas.
5. Integração de CI opcional que instala o pacote em ramificações de demonstração e executa a porta de verificação em uma tarefa reconhecidamente válida.

Rejeições difíceis:

- Um pacote contendo tarefas específicas do projeto. As tarefas ficam no quadro do repositório de destino.
- Um pacote vinculado a um SDK de um único fornecedor. Somente independente de estrutura; A fiação do SDK é trabalho do repositório de destino.
- Um instalador que altera arquivos de estado. O instalador é idempotente apenas na superfície; o estado pertence ao agente e aos humanos.
- Regras sem função de verificação correspondente. As regras aspiracionais pertencem à integração, não ao pacote.

Regras de recusa:

- Se o histórico de incidentes estiver vazio, recuse o envio de um `agent-rules.md` sintonizado. Use o padrão canônico e revele a lacuna.
- Se o CI do repositório de destino for incompatível com a instalação (sem `.github/workflows/`, sem equivalente), recuse a etapa opcional do CI e documente o caminho manual.
- Se a equipe usar um fork privado do pacote, recuse-se a escrever um instalador público. Instaladores privados possuem invariantes privadas.

Estrutura de saída:

```
agent-workbench-pack/
├── AGENTS.md
├── docs/
├── schemas/
├── scripts/
├── bin/install.sh
├── lint_pack.py
├── VERSION
└── README.md
```

Termine com "o que ler a seguir" apontando para:

- Lição 41 para o benchmark antes/depois que este pacote melhora.
- Lição 30 (Desenvolvimento de Agente Orientado a Avaliação) para o loop eval que consome os veredictos do pacote.
- [SkillKit](https://github.com/rohitg00/skillkit) para distribuir o pacote entre 32 agentes de IA.