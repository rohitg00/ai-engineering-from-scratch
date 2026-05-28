---
name: handoff-generator
description: Gere pacotes de transferência de final de sessão a partir de artefatos de ambiente de trabalho, produzindo Markdown legível por humanos e JSON legível por máquina codificados para os sete campos canônicos.
version: 1.0.0
phase: 14
lesson: 40
tags: [handoff, generator, session-end, packet, next-action]
---

Dado um ambiente de trabalho (estado, veredicto, revisão, log de feedback, comparação), produza um gerador de transferência de final de sessão conectado ao tempo de execução do agente.

Produzir:

1. `tools/generate_handoff.py` expondo `generate_handoff(snapshot) -> (markdown, payload)`.
2. `outputs/handoff/<session_id>/handoff.md` e `handoff.json`.
3. `handoff.schema.json` cobrindo os sete campos obrigatórios e o formato final do feedback.
4. Script de gancho de final de sessão que executa o gerador e se recusa a fechar a sessão se algum campo estiver faltando.
5. `docs/handoff.md` listando os sete campos, suas fontes e a política de corte.

Rejeições difíceis:

- Uma transferência sem `next_action`. Relatórios de status disfarçados de transferências envenenam a próxima sessão.
- Um gerador que escreve o resumo à mão. A função do agente é deixar o ambiente de trabalho em um estado gerável.
- Um pacote de remarcação que diverge do JSON. JSON é a fonte; markdown é uma renderização de JSON.
- Uma cauda de feedback com mais de 30 entradas. O log completo está no controle de versão; o pacote deve permanecer pequeno.

Regras de recusa:

- Se o relatório de verificação estiver faltando, recuse a geração do pacote. Uma transferência sem veredicto é um desejo.
- Se o relatório de revisão estiver faltando e for esperado um revisor humano, recuse e exija a aprovação da revisão primeiro.
- Se o resumo de comparação estiver vazio, mas a sessão durou mais de 5 minutos, revele a anomalia antes de gerar; suspeite de uma sessão travada em vez de um ambiente autônomo real.

Estrutura de saída:

```
<repo>/
├── outputs/handoff/<session_id>/
│   ├── handoff.md
│   └── handoff.json
├── tools/generate_handoff.py
├── handoff.schema.json
└── docs/handoff.md
```

Termine com "o que ler a seguir" apontando para:

- Lição 41 para exercícios completos em um aplicativo de amostra de estilo real.
- Lição 42 para empacotar o gerador no pacote de bancada de trabalho final.
- Lição 29 (Tempos de execução de produção) para conectar o final da sessão a gatilhos de fila, evento e cron.