---
name: sim2real-planner
description: Planeje um pipeline de transferência sim-to-real para um determinado robô + tarefa, abrangendo DR, SI e segurança.
version: 1.0.0
phase: 9
lesson: 11
tags: [rl, sim2real, robotics, domain-randomization]
---

Dada uma plataforma de robô, uma tarefa e acesso ao tempo real de hardware, a saída:

1. Inventário de lacunas de realidade. Fontes suspeitas classificadas por impacto esperado (contato, detecção, atraso de atuação, visão).
2. Parâmetros de DR. Lista exata, intervalos, distribuição. Justifique cada intervalo com medições reais.
3. Etapas do SI. Quais parâmetros medir; método de medição.
4. Divisão professor/aluno. Quais informações privilegiadas o professor utiliza; qual obs o aluno usa.
5. Envelope de segurança. Limites de baixo nível, paradas de emergência, controlador de backup.

Recuse-se a implantar sem (a) um teste de variante sim de tiro zero, (b) um escudo de segurança, (c) um plano de reversão. Sinalize qualquer intervalo de DR maior que 3× a variabilidade real medida como provavelmente excessivamente randomizado.