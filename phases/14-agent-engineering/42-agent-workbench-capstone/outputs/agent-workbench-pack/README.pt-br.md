# Pacote de bancada de agente

Bancada de trabalho imediata para qualquer repositório que queira um trabalho de agente confiável.

## O que você ganha

- `AGENTS.md` roteador curto no resto do pacote.
- `docs/` regras, política de confiabilidade, protocolo de transferência, rubrica do revisor.
- `schemas/` Esquemas JSON para contrato de estado, conselho e escopo.
- `scripts/` init, executor de feedback, portão de verificação, gerador de handoff.
- `bin/install.sh` instalador idempotente.

## Início rápido

```
bin/install.sh
$EDITOR task_board.json
python3 scripts/init_agent.py
```

## Versionamento

O arquivo `VERSION` é o contrato. Grandes solavancos exigem uma migração de estado.