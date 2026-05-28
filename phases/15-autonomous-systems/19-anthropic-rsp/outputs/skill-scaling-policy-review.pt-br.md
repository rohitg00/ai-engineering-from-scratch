---
name: scaling-policy-review
description: Revise uma política de escalonamento de laboratório de fronteira (Anthropic RSP, OpenAI Preparedness, DeepMind FSF, interno) em relação ao formato de referência RSP v3.0.
version: 1.0.0
phase: 15
lesson: 19
tags: [rsp, scaling-policy, ai-rd-4, pause-commitment, saferai, governance]
---

Dada uma política de expansão publicada ou proposta, produza uma revisão estruturada comparando-a com o formato de referência RSP v3.0 (AI R&D-4, caso afirmativo, mitigação de dois níveis, Roteiro de Segurança de Fronteira, Relatório de Risco, revisão independente).

Produzir:

1. **Inventário de dois níveis.** Separe os compromissos em "laboratório unilateral" e "recomendação para todo o setor". Os compromissos no nível de recomendação são defesa e não promessas. Conte a proporção; uma política em que a maioria dos compromissos reside no nível de recomendação é uma política fraca.
2. **Limites.** Nomeie cada limite de capacidade e a mitigação que aciona. Limites de sinalização qualitativos onde v2 era quantitativo. Sinalize limites ausentes para recursos que a política afirma cobrir.
3. **Pausar compromisso.** Confirme os nomes da política com uma cláusula de pausa (interrupções de treinamento, interrupções de implantação ou similares) em limites específicos. v3.0 removeu isso; as políticas que seguem o exemplo herdam a regressão.
4. **Artefatos permanentes.** Confirme os mandatos da política vigentes no Roteiro de Segurança da Fronteira e nos documentos do Relatório de Risco com cadência declarada. Artefatos únicos publicados post-hoc não se qualificam.
5. **Revisão independente.** Nomeie o mecanismo de revisão externa. A revisão apenas interna (um “Grupo Consultivo de Segurança” composto por funcionários do laboratório) não se qualifica como supervisão independente.

Rejeições difíceis:
- Políticas sem limite de capacidade nomeado.
- Políticas cujas mitigações estão todas no nível de recomendação do setor.
- Políticas sem artefatos permanentes de Roadmap/Risk Report.
- Políticas sem mecanismo de revisão independente.
- Políticas que afirmam “aprender com a experiência do mundo real” sem indicar como o texto da política é atualizado e em que cadência.

Regras de recusa:
- Se o documento político for de marketing e não de governança (sem compromissos específicos, sem limites, sem cadência), recuse-se a classificá-lo como uma política de expansão.
- Se o usuário tratar a existência de uma política como equivalente à conformidade, recuse. Uma política é um dispositivo de compromisso; a conformidade requer evidências.
- Se o usuário citar uma versão mais antiga da política (por exemplo, RSP Antrópico 2023) como atual, recuse e exija a versão atual.

Formato de saída:

Retorne uma revisão da política com:
- **Proporção de dois níveis** (unilateral/recomendação/contagem total)
- **Tabela de limites** (nome, tipo: quantitativo/qualitativo, gatilho, mitigação)
- **Pausar compromisso** (apresentar s/n, cláusula específica)
- **Artefatos permanentes** (cadência do roteiro, cadência do relatório de risco)
- **Revisão independente** (mecanismo, identidade do revisor, frequência)
- **Classificação resumida** (forte/moderado/fraco, justificado)