---
name: mast-auditor
description: Execute uma auditoria de modo de falha no estilo MAST em um sistema multiagente. Categorizar falhas de rastreamento de execução em Especificação/Coordenação/Verificação e famílias Groupthink; classificar mitigações pela redução de falhas esperada.
version: 1.0.0
phase: 16
lesson: 23
tags: [multi-agent, failure-modes, MAST, groupthink, circuit-breaker, audit]
---

Dado um sistema multiagente e amostras de rastreamentos de execução, execute uma auditoria de modo de falha.

Produzir:

1. **Construção de amostra.** Pelo menos 200 rastreamentos de produção, amostrados uniformemente em todos os tipos de tarefas e janelas de tempo. Método de amostragem de documentos e riscos de viés.
2. **Passagem de classificação.** Para cada rastreamento, marque `success | failure`. Para falhas, atribua uma categoria MAST (especificação/coord/verifique) e, quando aplicável, uma ou mais tags da família Groupthink (monocultura/conformidade/tom/motivo misto/cascata).
3. **Tabela de distribuição.** Contagens e porcentagens por categoria MAST e tag Groupthink. Compare com a distribuição de referência do Cemri 2025 (41,77 / 36,94 / 21,30). Sistemas que se desviam fortemente da referência geralmente possuem uma camada fraca específica.
4. **Principais padrões de falha.** Identifique os três padrões específicos mais frequentes (por exemplo, "dois agentes revisam"). Etapas de reprodução de documentos.
5. **Classificação de mitigação.** Para cada padrão principal, proponha uma mitigação da biblioteca padrão: contratos de função explícita, estado compartilhado com versão, verificador independente, disjuntor, trio detecção-diagnóstico-validação (STRATUS). Classifique pela redução de falhas esperada, dada a frequência do padrão.
6. **Risco de falhas silenciosas.** Quantas falhas produzem resultados plausíveis, mas errados, versus erros altos? A taxa silenciosa impulsiona o investimento na camada de verificação.
7. **Proxies de falha lenta.** Recomende 2 a 3 métricas em tempo real que revelariam desvios antes que se tornassem um erro alto: taxa de concordância, taxa de novas tentativas, distribuição de comprimento de saída, distância de edição entre agentes.

Rejeições difíceis:

- Auditorias sem amostra aleatória ou estratificada. Falhas escolhidas a dedo representam casos dramáticos e ignoram o desvio de falha lenta.
- Recomendações de mitigação sem medição de base. "Adicionar um verificador" não significa nada, a menos que a taxa de falha atual seja conhecida.
- Ignorando incidentes desconhecidos do MAST. Se um traço não se enquadrar em uma categoria, a taxonomia estará incompleta; propor uma extensão em vez de forçar uma categoria.
- Reivindicar uma auditoria trimestral é suficiente sem monitoramento operacional de falhas lentas. As perdas trimestrais oscilam entre as auditorias.

Regras de recusa:

- Se os rastreamentos não tiverem atribuição por agente (quem escreveu o quê, quem leu o quê), a auditoria não poderá distinguir falhas de coordenação de conflitos de funções. Recomendamos adicionar o registro estruturado por agente antes da nova auditoria.
- Se o sistema tiver menos de 50 rastreamentos com falha no total, a amostra é muito pequena para produzir estimativas de distribuição. Recomendo uma janela de observação mais longa.
- Se os vestígios contiverem PII, mascarar antes da análise.

Resultado: um relatório de três páginas. Comece com um resumo de uma frase ("41% de falhas nas especificações, 12% de coordenação, 39% de lacunas de verificação, 8% de incógnitas; o padrão principal é o conflito entre revisores duplos; a mitigação de maior ROI são contratos de função explícitos.") e, em seguida, as sete seções acima. Termine com uma lista de ações priorizadas: três mitigações com custo de implementação estimado e redução esperada da taxa de insucesso.