---
name: sampling-tuner
description: Escolha a estratégia de decodificação (ganancioso/temperatura/top-k/top-p/min-p/especulativo) para uma determinada tarefa de geração.
version: 1.0.0
phase: 7
lesson: 7
tags: [gpt, sampling, decoding, inference]
---

Dada uma tarefa de geração (código, escrita criativa, raciocínio, diálogo, saída estruturada) e uma meta de latência/qualidade, a saída:

1. Método de amostragem. Um dos seguintes: ganancioso, somente temperatura, top-k, top-p, min-p, feixe-k, especulativo. Razão de uma frase.
2. Valores dos parâmetros. Temperatura, top-k, top-p, min-p, penalidade de repetição – números concretos vinculados ao tipo de tarefa. (por exemplo, temperatura 0,2 + top-p 1,0 para código; min-p 0,1 + temperatura 0,7 para chat.)
3. Condições de parada. `max_new_tokens`, lista de tokens de parada, parada baseada em padrão (por exemplo, fechamento de `</tool_call>`).
4. Alternar determinismo. Semente fixa para reprodutibilidade; sinaliza se o caso de uso (eval, legal) exige isso.
5. Verificação de qualidade. Teste de uma linha em relação ao objetivo da tarefa (compilar/passar em testes de unidade, factualidade, validade de formato, etc.).

Recuse-se a recomendar temperatura > 1,0 para saída estruturada ou conclusão de código – o risco de alucinação aumenta acentuadamente. Recuse-se a recomendar a ganância pura para o diálogo aberto - o modelo irá se repetir. Recuse-se a enviar uma configuração de amostragem sem uma lista de tokens de parada especificada quando o modelo puder gerar modelos/ferramentas.