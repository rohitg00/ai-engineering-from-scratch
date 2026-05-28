---
name: init-script
description: Entreviste um projeto e emita um init_agent.py determinístico com cinco testes mais um fluxo de trabalho de CI que se recusa a iniciar o agente se algum teste falhar.
version: 1.0.0
phase: 14
lesson: 35
tags: [init, probes, ci, workbench, fail-loud]
---

Dado um repositório, o produto do agente e sua superfície de dependência produzem um script de inicialização específico do projeto e uma fiação de CI.

Produzir:

1. `tools/init_agent.py` com estes testes: versão de tempo de execução, dependências listadas, capacidade de resolução do comando de teste, env vars necessários, atualização do arquivo de estado.
2. Esquema `init_report.json` documentado próximo ao script. Cada sonda retorna `(name, status: pass|warn|fail, detail)`.
3. `.github/workflows/agent-init.yml` (ou equivalente) que executa o script e bloqueia o trabalho do agente em qualquer investigação de gravidade de falha.
4. Um script de gancho `pre-task` que o tempo de execução do agente pode chamar antes do início de cada sessão.
5. Documentação em `docs/init.md` listando cada investigação, sua gravidade e como corrigir uma falha.

Rejeições difíceis:

- Testes que ligam para a rede sem tempo limite. O Init deve ser rápido e seguro offline.
- Sondas que exigem chamadas LLM. Init é um encanamento determinístico.
- Um código de saída diferente de zero que o wrapper engole. Falhar alto é o ponto principal.
- Sondas que tocam estado sem idempotência. Duas execuções consecutivas devem produzir carimbo de data/hora do módulo de relatórios idêntico.

Regras de recusa:

- Se o projeto não tiver comando de teste, recuse o envio do script. Em vez disso, adicione a lacuna à auditoria do ambiente de trabalho.
- Se a lista env var contiver segredos, o script será impresso, recusará e forçará a redação. Os relatórios de inicialização nunca devem conter segredos.
- Se uma sonda demorar mais de três segundos em um teste, coloque a descoberta de tempo antes do envio. Longas sondagens transformam o início em cerimônia.

Estrutura de saída:

```
<repo>/
├── tools/
│   ├── init_agent.py
│   └── pre_task.sh
├── docs/
│   └── init.md
└── .github/
    └── workflows/
        └── agent-init.yml
```

Termine com "o que ler a seguir" apontando para:

- Lição 36 para o contrato de escopo por tarefa que usa o `repo_paths` do relatório init.
- Lição 37 para o loop de feedback de tempo de execução que consome o comando de teste resolvido.
- Lição 38 para a porta de verificação que depende da passagem das sondas.