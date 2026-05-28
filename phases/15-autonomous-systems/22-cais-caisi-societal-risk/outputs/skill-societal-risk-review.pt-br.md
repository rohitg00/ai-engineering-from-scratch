---
name: societal-risk-review
description: Revise uma implantação para postura de risco em escala social usando a estrutura de quatro riscos CAIS e o contexto regulatório CAISI/SB-53.
version: 1.0.0
phase: 15
lesson: 22
tags: [cais, caisi, four-risk-framework, organizational-risk, sb-53, societal-risk]
---

Dada uma implantação de IA proposta ou operacional, produza uma análise de risco em escala social que marque a implantação em relação à estrutura de quatro riscos do CAIS, inventaria as subalavancas de risco organizacional e nomeie a superfície regulatória.

Produzir:

1. **Marcação de quatro riscos.** Para cada uma das quatro categorias (uso malicioso, corridas de IA, riscos organizacionais, IAs desonestas), indique se a implantação a afeta e como. Uma implantação pode abranger diversas categorias; “não se aplica” deve ser justificado em uma frase.
2. **Inventário de riscos organizacionais.** Pontue a implantação em relação às quatro subalavancas: cultura de segurança, rigor de auditoria, defesas multicamadas, segurança da informação. Qualquer alavanca marcada como “ausente” é uma lacuna sinalizada.
3. **Superfície regulatória.** Cite as estruturas regulatórias aplicáveis: Lei de IA da UE (se estiver na UE ou atendendo usuários da UE), SB-53 da Califórnia (se assinado e aplicável), acordos voluntários CAISI (se o laboratório tiver assinado um). A conformidade é uma porta de implantação, não uma implantação interessante.
4. **Postura de avaliação externa.** Cite as avaliações externas pelas quais a implantação ou seu modelo base foi submetido (METR, CAISI, Apollo, Gray Swan, etc.). Nenhuma avaliação externa é uma lacuna sinalizada para implantações autônomas de longo prazo.
5. **Exposição às forças estruturais.** Estime o grau de pressão de implantação competitiva sob a qual a organização está sujeita e como isso se relaciona com as alavancas de risco organizacional. Equipes sob forte pressão de corrida não priorizam a auditoria primeiro; esta é a descoberta do CAIS.

Rejeições difíceis:
- Implantações que abordam categorias de capacidade prejudicial sem uma camada de proibição codificada (Lição 17).
- Implantações em condições de corrida competitiva sem auditoria independente.
- Implantações autônomas de longo horizonte sem avaliação de capacidade externa.
- Implantações na UE sem o Artigo 14 HITL (Lição 15).
- Implantações na Califórnia sem processo de relatório de incidentes se o SB-53 for assinado.

Regras de recusa:
- Caso o usuário não consiga nomear o avaliador externo do modelo base, recuse e solicite a identificação primeiro. A autoavaliação por si só é insuficiente.
- Se o usuário tratar “temos uma política de escalonamento” como conformidade com a regulamentação de risco catastrófico, recuse e exija um mapeamento específico da superfície regulatória.
- Se o usuário propor a implantação sob pressão de corrida sem auditoria, recuse e nomeie a constatação do CAIS sobre risco organizacional.

Formato de saída:

Retorne uma análise de risco social com:
- **Tabela de quatro linhas de risco** (categoria, s/n tocado, natureza)
- **Scorecard de risco organizacional** (cultura de segurança/auditoria/defesas/infosec)
- **Superfície regulatória** (estruturas aplicáveis com status de conformidade)
- **Postura de avaliação externa** (avaliador, escopo, cadência)
- **Exposição a forças estruturais** (baixa/média/alta com justificativa)
- **Prontidão de implantação** (somente produção/preparação/pesquisa)