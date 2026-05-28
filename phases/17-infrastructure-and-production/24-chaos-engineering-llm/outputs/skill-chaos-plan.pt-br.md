---
name: chaos-plan
description: Projete um plano de engenharia do caos LLM - verifique os pré-requisitos, construa quatro aviões, escolha a ferramenta, comece com três experimentos seguros, aplique as portas do plano de segurança.
version: 1.0.0
phase: 17
lesson: 24
tags: [chaos-engineering, litmuschaos, chaosmesh, harness, llm-chaos, game-day]
---

Dada pilha (Kubernetes/VMs/gerenciada), maturidade SLI/SLO, qualidade de observabilidade e maturidade da equipe de plantão, produza um plano de caos.

Produzir:

1. Verificação de pré-requisitos. Verifique SLI/SLO definido, observabilidade conectada, reversão automatizada, runbooks estruturados, rotação de plantão. Se faltar algum, recuse-se a iniciar o caos na produção.
2. Quatro aviões. Nomeie as ferramentas para cada plano (controle, alvo, segurança, observabilidade). Aponte para a Fase 17 · 13 para observabilidade.
3. Três experiências iniciais. Comece com pod kill. Depois, o provedor 429. Depois, a sobrecarga de memória. Cada um com limite de raio de explosão, duração e critério de sucesso.
4. Portões de segurança. Taxa de queima (>2x esperada), raio de explosão (<30% da frota), marcação de identificação de rastreamento, janelas de supressão.
5. Cadência. Canário pequeno semanal. Dia de jogo mensal (cross-time). Auditoria trimestral de resiliência.
6. Ferramentas. LitmusChaos (OSS, graduado em CNCF), Chaos Mesh (OSS, sandbox CNCF), Harness Chaos (comercial assistido por IA), AWS FIS / Azure Chaos Studio (gerenciado nativo da nuvem).

Rejeições difíceis:
- Gerar o caos na produção sem os cinco pré-requisitos. Recuse — se tornará um incidente real.
- Experimentos sem limites de raio de explosão. Recusar.
- Experimentos sem marcação de ID de rastreamento. Recusar — ​​impossível desduplicar alertas.

Regras de recusa:
- Se a equipe nunca executou um experimento bem-sucedido na preparação, recuse o caos da produção até que alguém esteja verde na preparação.
- Se o volume de incidentes já for alto (>2/semana), recuse o caos adicional – estabilize primeiro.
- Se a equipe não tiver SLO, solicite o SLO antes de qualquer experimento.

Resultado: um plano de uma página com verificação de pré-requisitos, ferramentas de quatro planos, três experimentos iniciais, portas de segurança, cadência. Termine com um compromisso trimestral de atualização do mapa de dependências.