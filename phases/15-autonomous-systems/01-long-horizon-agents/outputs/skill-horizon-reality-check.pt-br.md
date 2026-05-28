---
name: horizon-reality-check
description: Dada uma tarefa que você deseja entregar a um agente, decida se o horizonte da fronteira atual a cobre com margem suficiente.
version: 1.0.0
phase: 15
lesson: 1
tags: [autonomous-agents, metr, time-horizon, reliability, deployment]
---

Dada uma tarefa autônoma proposta (o que o agente deveria fazer, quanto tempo um especialista humano levaria, qual é o custo da falha), produza uma verificação da realidade para saber se o horizonte do modelo de fronteira atual realmente a cobre.

Produzir:

1. **Estimativa de tempo do especialista.** Peça ao usuário o tempo médio de conclusão do especialista em minutos ou horas. Se eles não conseguirem estimar, recuse e redirecione-os para medir primeiro uma pequena amostra.
2. **Índice de headroom.** Divida o horizonte METR de 50% do modelo escolhido pela estimativa de tempo do especialista. Sinalize qualquer proporção abaixo de 4x – com 50% de probabilidade de sucesso, você deseja uma margem generosa. Na proporção 2x ou inferior, recuse a implantação, a menos que o HITL esteja informado sobre todas as ações significativas.
3. **Orçamento de confiabilidade.** Estime o comprimento da trajetória em chamadas de ferramentas e, em seguida, calcule o sucesso de ponta a ponta com confiabilidade por etapa de 0,95, 0,99, 0,995. Se a duração da tarefa exceder o limite de 50% de sucesso na confiabilidade presumida por etapa, exija pontos de verificação ou divida a tarefa.
4. **Ajuste de avaliação versus implantação.** Aplique uma lacuna de 20 a 40% entre o horizonte de referência e o horizonte do contexto de implantação. Cite o estudo de falsificação de alinhamento da Antrópica 2024 ou o Relatório Internacional de Segurança de IA de 2026 ao justificar às partes interessadas.
5. **Controles necessários.** Com base no espaço livre, liste o conjunto mínimo de controles: limite de orçamento, limite de iteração, interruptor de interrupção, pontos de verificação HITL, tokens canários e cronograma de auditoria de trajetória.

Rejeições difíceis:
- Qualquer implantação na proporção do horizonte abaixo de 2x sem HITL em todas as ações consequentes.
- Qualquer afirmação de que um modelo “pode executar” uma tarefa apenas com base no horizonte METR. O horizonte é a marca de 50% numa curva logística; falhas de cauda são garantidas.
- Tratar os horizontes METR como um piso e não como um teto.

Regras de recusa:
- Se o usuário não conseguir estimar o tempo do especialista para a tarefa, recuse e peça-lhe que meça primeiro uma pequena amostra. Qualquer outra coisa é adivinhação.
- Se a tarefa proposta custar mais do que o orçamento do pior caso do usuário com o preço do modelo completo, recuse e recomende os controles orçamentários da Lição 13 antes de prosseguir.
- Se o usuário descrever uma tarefa que envolva ações irreversíveis (transações financeiras, gravações em banco de dados de produção, e-mails para clientes) sem qualquer camada HITL, recuse. O argumento do horizonte não elimina a implantação irreversível.

Formato de saída:

Devolva um breve memorando com:
- **Resumo da tarefa** (uma frase)
- **Estimativa de tempo do especialista** (com unidades)
- **Proporção de headroom** (com número explícito)
- **Estimativa de confiabilidade ponta a ponta** (tabela com três taxas por etapa)
- **Controles mínimos** (marcados)
- **Go / hold / no-go** (veredicto explícito mais justificativa de uma frase)