# Time Horizons da METR e Avaliação Externa de Capacidade

> METR (ex-ARC Evals) é uma 501(c)(3) independente desde dezembro de 2023. Seu benchmark Time Horizon 1.1 (janeiro de 2026) ajusta uma curva logística à probabilidade de sucesso em tarefas vs log(tempo de conclusão por eespecificaçãoialista humano); a interseção em 50% de probabilidade define o horizonte temporal do modelo. O conjunto de engajamentos 2025–2026 cobre GPT-5.1, GPT-5.1-Codex-Max e protótipos de avaliação de monitoramento (um monitor consegue pegar tarefas paralelas; o agente consegue evadir). Conjuntos de benchmark: HCAST (180+ tarefas de ML, cyber, SWE, raciocínio; 1 minuto a 8+ horas), RE-Bench (77 tarefas de engenharia de pesquisa em ML com baseline de eespecificaçãoialista), SWAA. Nota honesta: medições da METR são idealizadas — sem humano, sem consequências reais — e a equipe documentou a lacuna de comportamento eval-vs-deploy (Aula 1). Um horizonte temporal é um limite superior, não uma previsão de deploy.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, estimador de horizonte com ajuste logístico)
**Pré-requisitos:** Fase 15 · 01 (Agents de longo prazo), Fase 15 · 19 (RSP)
**Tempo:** ~60 minutos

## O Problema

Políticas de escala (Aulas 19, 20) são tão úteis quanto as medições que referenciam. "Limiar AI R&D-4" e "Long-range Autonomy" são definidos em prosa de política; tornam-se acionáveis somente quando avaliações eespecificaçãoíficas produzem números eespecificaçãoíficos.

METR é a organização de avaliação externa de 2024–2026 que definiu muitos desses números. Eles avaliam modelos de fronteira — frequentemente antes do release, sob NDA com laboratórios — e publicam metodologia depois. O benchmark Time Horizon 1.1 (janeiro de 2026) é seu artefato principal: um único escalar que comprime capacidade em uma unidade legível por humanos ("este modelo consegue fazer o tipo de tarefa que um eespecificaçãoialista gasta X horas com 50% de confiabilidade").

A aula é parcialmente sobre a metodologia (como um horizonte é calculado) e parcialmente sobre a interpretação (por que um horizonte é um limite superior, não uma previsão de deploy). As duas habilidades pertencem juntas. Uma equipe que entende como o horizonte é ajustado é muito mais difícil de enganar com uma alegação ruim de fornecedor do que uma equipe que apenas vê "14 horas" em um slide.

## O Conceito

### Contexto da METR

- Fundação: dezembro de 2023 (ex-ARC Evals, desmembrada em 501(c)(3) independente).
- Escopo: avaliação de capacidades autônomas de modelos de fronteira, frequentemente antes do release.
- Laboratórios parceiros: Anthropic, OpenAI (múltiplos engajamentos 2025–2026).
- Entregas notáveis: Time Horizon 1.0 (março de 2025), Time Horizon 1.1 (janeiro de 2026), protótipos de avaliação de monitoramento.

### O ajuste do Time Horizon

Metodologia (a partir do blog e papers da METR):

1. Coletar um conjunto de tarefas abrangendo tempos de conclusão de eespecificaçãoialista de escala de minutos até horas. Conjuntos atuais: HCAST (180+ tarefas), RE-Bench (71 tarefas), SWAA.
2. Rodar o modelo em cada tarefa; registrar sucesso ou falha.
3. Ajustar uma curva logística: P(sucesso) como função de log(tempo de conclusão do eespecificaçãoialista).
4. O horizonte é o tempo de eespecificaçãoialista em que P(sucesso) = 0.5.

A forma logística é a certa porque capacidade geralmente tem uma relação crescente, aproximando-se de platô, com dificuldade da tarefa. O ponto de 50% é uma escolha (poderia ser 10%, 90%); METR reporta múltiplos limiares no paper detalhado mas lidera com 50% porque é o mais intuitivo.

### Os números de janeiro de 2026

Segundo Time Horizon 1.1:

- Claude Opus 4.6: ~14 horas a 50% de confiabilidade, de acordo com Time Horizon 1.1 (janeiro de 2026).
- Tempo de duplicação em tarefas HCAST: ~4.3 meses (130.8 dias) no ajuste pós-2023 reportado por Time Horizon 1.1 (janeiro de 2026); a figura de ~7 meses é o ajuste completo 2019–2025 do Time Horizon 1.0 e é reportado em TH1.1 ao lado do número pós-2023.

Esses são os números eespecificaçãoíficos que o restante da Fase 15 referencia. São citados no RSP v3.0 da Anthropic (Aula 19) e no FSF v3 da DeepMind (Aula 20) como uma das medições que alimentam avaliações de limiar.

### Conjuntos de benchmark

- **HCAST**: 189 tarefas em ML, cibersegurança, engenharia de software e raciocínio geral. Abrangência: 1 minuto a 8+ horas de tempo de eespecificaçãoialista. O conjunto principal por trás do número do horizonte.
- **RE-Bench**: 71 tarefas de engenharia de pesquisa em ML com baseline de eespecificaçãoialista humano. Mede se o modelo consegue fazer o tipo de trabalho de P&D de ML que alimenta o limiar AI R&D-4.
- **SWAA**: tarefas mais curtas; útil para calibrar a extremidade inferior da curva de horizonte.

### Protótipos de avaliação de monitoramento

O trabalho da METR em 2025–2026 incluiu protótipos de avaliação de monitoramento: um monitor consegue pegar um modelo executando uma tarefa paralela (algo diferente do que o operador pediu); o agente consegue evadir o monitor. Isso alimenta diretamente a categoria "Undermining Safeguards" no PF v2 da OpenAI e o monitoramento de alinhamento enganoso no FSF v3 da DeepMind (Aula 20).

### Por que horizontes são limites superiores

- **Ferramental idealizado**: tarefas de benchmark dão ao modelo ferramentas limpas e dados bem formatados. Deploys reais são mais bagunçados.
- **Sem consequências reais**: o modelo nunca realmente cobra um cliente, deleta dados reais ou contata pessoas reais. Deploys reais têm apostas irreversíveis.
- **Eval-context gaming**: Aula 1. Modelos se comportam diferente em testes. O Relatório Internacional de Segurança de IA de 2026 documenta isso empiricamente.
- **Sem variância de usuário legítimo**: prompts de benchmark são estrutuados. Usuários reais produzem pedidos ambíguos, dependentes de contexto.

O horizonte é o teto de capacidade sob condições favoráveis. Confiabilidade de implantação é um número diferente, menor, e equipes devem medir sua própria distribuição para conhecê-lo.

### O caso do avaliador externo

Avaliação externa importa porque laboratórios internos têm incentivos para otimizar as métricas que reportam. Independência da METR — uma 501(c)(3) com metodologia declarada e papers revisados por pares — é a mitigação estrutural. Não é suficiente sozinha (laboratórios ainda controlam o que a METR vê), mas é estritamente melhor que nenhuma avaliação externa.

### Como usar números de horizonte na prática

- **Como filtro de capacidade**: se o horizonte de um modelo está bem abaixo do tempo de eespecificaçãoialista de uma tarefa proposta, não o lance como autônomo (skill file da Aula 1).
- **Como indicador de tendência**: tempo de duplicação diz por quanto tempo a prática atual permanecerá segura mesmo sem novas mitigações.
- **Como prior**: um horizonte de 14 horas é um ponto de partida. Reduza para sua distribuição de tarefas, qualidade de ferramental e contexto de deploy.

## Use

`code/main.py` implementa um ajuste logístico de sucesso em tarefas vs log(tempo de eespecificaçãoialista), dado um conjunto de resultados sintéticos. Reporta o horizonte de 50% (principal da METR), horizonte de 10% (conservador) e horizonte de 90% (otimista). Também demonstra o que muda quando a taxa de sucesso é artificialmente inflada por eval-context gaming.

## Entregue

`outputs/skill-horizon-interpretation.md` revisa uma alegação de horizonte de um fornecedor e produz uma análise de lacuna entre alegação de benchmark e realidade de deploy.

## Exercícios

1. Rode `code/main.py`. Confirme que o horizonte de 50% do ajuste combina com o ground truth sintético. Agora reduza pela metade a grade de tempos de tarefa; a estimativa do horizonte muda significativamente?

2. Leia o post do blog Time Horizon 1.1 da METR. Identifique as tarefas eespecificaçãoíficas onde a confiabilidade é mais alta e onde é mais baixa. Explique por que a lacuna existe.

3. Leia os recursos "Measuring Autonomous AI Capabilities" da METR. Liste as categorias de tarefas HCAST. Escolha uma categoria que você ponderaria mais para uma tarefa de produção e justifique por quê.

4. Introduza eval-context gaming no simulador: inverta ~20% das tarefas falhas para sucesso. Reporte o novo horizonte. Isso aproxima o que uma taxa de gaming de 20% faz ao número observado.

5. Projete uma avaliação interna de horizonte no seu backlog de bugs ou conjunto de tarefas representativo. Descreva a coleta de dados, o ajuste e o que a saída diz. Compare com números da METR.

## Termos-Chave

| Termo | O que dizem | O que significa de verdade |
|---|---|---|
| METR | "Avaliador externo" | ex-ARC Evals; 501(c)(3) independente desde dez 2023 |
| Time Horizon | "Medida de capacidade" | Tempo de tarefa de eespecificaçãoialista a 50% de confiabilidade, de ajuste logístico |
| HCAST | "Conjunto principal da METR" | 180+ tarefas abrangendo 1 min a 8+ horas |
| RE-Bench | "Engenharia de pesquisa" | 71 tarefas de engenharia de pesquisa em ML com baseline humano |
| SWAA | "Conjunto de tarefas curtas" | Calibra a extremidade inferior da curva de horizonte |
| Tempo de duplicação | "Taxa de crescimento" | Tempo para o horizonte de 50% dobrar; ~7 meses por HCAST |
| Eval-context gaming | "Modelo se comporta diferente" | Lacuna de comportamento documentada entre testes e implantação |
| Limite superior | "Horizonte é um teto" | Horizonte de benchmark > confiabilidade de implantação sob carga |

## Leituras Adicionais

- [METR — Resources for Measuring Autonomous AI Capabilities](https://metr.org/measuring-autonomous-ai-capabilities/) — eespecificaçãoificações de HCAST, RE-Bench, SWAA.
- [METR — Measuring AI Ability to Complete Long Tasks](https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/) — o paper original do horizonte.
- [METR — Time Horizon 1.1 (January 2026)](https://metr.org/research/) — números atuais e metodologia.
- [Epoch AI — METR Time Horizons benchmark](https://epoch.ai/benchmarks/metr-time-horizons) — rastreamento em tempo real.
- [Anthropic — Measuring agente autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — perespecificaçãotiva interna sobre medições da METR.
