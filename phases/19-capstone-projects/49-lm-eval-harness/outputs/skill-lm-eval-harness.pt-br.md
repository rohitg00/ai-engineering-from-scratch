---
name: lm-eval-harness
description: Equipamento de avaliação de modelo de linguagem mínimo com especificação de tarefa JSONL, cinco métricas, adaptador trocável e saída JSON de tabela de classificação.
version: 1.0.0
phase: 19
lesson: 49
tags: [evaluation, metrics, leaderboard, harness]
---

## Quando usar

Compare dois modelos, dois pontos de verificação ou dois modelos de prompt com um conjunto fixo de tarefas. Qualquer coisa que seja enviada e que você precise monitorar ao longo do tempo.

## Especificação da tarefa

Uma linha JSONL por exemplo:

```json
{"id": "ex-001", "prompt": "...", "targets": ["..."], "metric": "exact_match", "extras": {}}
```

Todos os exemplos em um arquivo compartilham uma métrica. O nome do arquivo é o nome da tarefa.

## Métricas

| Métrica | Assinatura | Usar para |
|--------|-----------|--------|
| correspondência_exata | normalizar inferior + espaço em branco, igualdade | Respostas aritméticas e factóides |
| substring_contém | alvo deve aparecer na previsão normalizada | Geração de forma livre com palavras âncora |
| escolha_múltipla | correspondência da primeira letra | Perguntas estilo A/B/C/D |
| vermelho_l | LCS F1 sobre texto tokenizado | Resumo, paráfrase |
| código_exec | executar `f` da previsão em io_pairs, contar correspondências | Geração de código |

Todas as métricas retornam flutuação em [0,0, 1,0]. A pontuação da tarefa é a média.

## Adaptador

```python
class Adapter(Protocol):
    name: str
    def generate(self, prompts: list[str]) -> list[str]: ...
```

O adaptador é o único código específico do modelo.

## Tabela de classificação JSON

String de esquema, carimbo de data/hora, pontuações por tarefa e latência, média geral. Inclua registros por exemplo ao comparar execuções para que as regressões em nível de previsão fiquem visíveis.

## Modos de falha

- Retornos da métrica fora de [0, 1]: a pontuação geral torna-se ininterpretável.
- Métricas mistas em um arquivo de tarefa: disparos de asserção; mantenha uma métrica por arquivo.
- code_exec sem namespace restrito: execução arbitrária de código.
- Sem sequência de esquema: a evolução do formato quebra os painéis posteriores.