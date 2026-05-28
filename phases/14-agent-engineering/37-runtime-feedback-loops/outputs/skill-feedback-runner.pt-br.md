---
name: feedback-runner
description: Envolva comandos shell com captura determinística de stdout/stderr/exit/duration, persista um registro JSONL por comando e recuse-se a avançar o loop do agente quando faltar feedback.
version: 1.0.0
phase: 14
lesson: 37
tags: [feedback, subprocess, runner, jsonl, loop-control]
---

Dado um projeto que executa comandos shell dentro de um loop de agente, produza um executor de feedback e o JSONL que ele grava.

Produzir:

1. `tools/run_with_feedback.py` expondo `run_with_feedback(command: list[str], agent_note: str, timeout_s: float) -> FeedbackRecord`.
2. Localização de `feedback_record.jsonl` no ambiente de trabalho, um registro por linha.
3. `tools/feedback_loader.py` que retorna os N registros mais recentes da tarefa ativa.
4. Um auxiliar `loop_can_advance(record) -> bool` que o loop do agente chama antes de declarar sucesso.
5. Testes cobrindo: caminho de sucesso, saída diferente de zero, tempo limite, binário ausente, truncamento determinístico cabeça/cauda.

Rejeições difíceis:

- `shell=True` em qualquer lugar do corredor. Somente Argv.
- Truncamento que depende do relógio de parede ou amostragem aleatória. A mesma entrada deve produzir o mesmo registro.
- Registros sem `duration_ms`. Sondas lentas são o primeiro sinal de uma bancada de trabalho presa.
- Um carregador que retorna uma lista ilimitada. Limitar no último N ou paginar.

Regras de recusa:

- Se o projeto canalizar segredos por meio do stdout, recuse-se a enviar o executor sem uma etapa de redação. Revele as linhas que teriam sido capturadas.
- Se o projeto tiver comandos que podem travar indefinidamente, recuse o envio sem um tempo limite padrão e uma lista de substituições explícita.
- Se o executor for executado dentro de um trabalhador com estado compartilhado, recuse-se a ignorar um bloqueio de arquivo em torno do anexo JSONL. Vários escritores irão rasgar o arquivo.

Estrutura de saída:

```
<repo>/
├── feedback_record.jsonl
└── tools/
    ├── run_with_feedback.py
    ├── feedback_loader.py
    └── test_feedback_runner.py
```

Termine com "o que ler a seguir" apontando para:

- Lição 38 para a porta de verificação que consome os registros.
- Lição 39 para o agente revisor que lê o feedback ao pontuar uma execução.
- Lição 23 para convenções OTel GenAI para adicionar ao lado da telemetria assim que o feedback for sólido.