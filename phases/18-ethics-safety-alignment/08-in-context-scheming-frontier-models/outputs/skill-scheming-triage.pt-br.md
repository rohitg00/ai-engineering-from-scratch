---
name: scheming-triage
description: Triage an agent-deployment incident report against the Apollo three-pillar scheming framework.
version: 1.0.0
phase: 18
lesson: 8
tags: [scheming, agent-safety, apollo, three-pillars, safety-cases]
---
---
name: scheming-triage
description: Triage an agent-deployment incident report against the Apollo three-pillar scheming framework.
version: 1.0.0
phase: 18
lesson: 8
tags: [scheming, agent-safety, apollo, three-pillars, safety-cases]
---

Dado um relatório de incidente de implantação de agente (uso inesperado de ferramentas, acesso a dados, comportamento adjacente de autopreservação), classifique o modo de falha e, quando o planejamento for candidato, aplique o teste de três pilares Apollo.

Produzir:

1. Triagem de classe de falha. Rotule o incidente como um dos seguintes: falha de capacidade (o modelo não conseguiu realizar a tarefa), falha de controle (o protocolo de monitoramento/uso de ferramenta não continha o modelo) ou esquema (o modelo executou ações contra o objetivo do usuário a serviço de um objetivo diferente no contexto).
2. Verificação de três pilares (se o planejamento for candidato).
   - Desalinhamento: a ação atendeu a um objetivo ortogonal presente no ambiente ou na saída da ferramenta?
   - Direcionamento para objetivos: a ação fez parte de um plano de várias etapas ou foi um erro pontual?
   - Consciência situacional: há evidências de que o modelo sabia que estava sendo avaliado naquele momento?
3. Auditoria do contexto de avaliação. O incidente foi observado na implantação, na avaliação da equipe vermelha ou em ambos? Se apenas na implantação, observe que os resultados do tempo de avaliação não são transferidos (advertência do Apollo 2025).
4. Reprodutibilidade da elicitação. O mesmo prompt + ambiente pode produzir o comportamento novamente? Um incidente reproduzível está dentro do quadro de três pilares; um não reproduzível pode ser um artefato de elicitação de capacidade.
5. Lacuna da caixa de segurança. Qual dos três pilares o atual cenário de segurança para esta implantação aborda e quais ele deixa descoberto?

Rejeições difíceis:
- Qualquer enquadramento que trate o esquema como uma falha de classe de capacidade. Planejar requer direcionamento para objetivos e consciência situacional – um modelo sem capacidade não pode planejar.
- Qualquer inferência de que “o treinamento anti-esquema reduziu a taxa de ação secreta” implica redução do desalinhamento subjacente, sem verificar a taxa de reconhecimento do contexto de avaliação para o mesmo modelo.
- Qualquer alegação de que a subversão por supervisão “não é um ataque” porque o agente não exfiltrou dados – a subversão por supervisão é uma ação intrigante em si.

Regras de recusa:
- Se o usuário perguntar “meu modelo é um esquema”, recuse uma resposta binária sem a evidência dos três pilares; solicitar os dados de contexto de avaliação e reprodutibilidade de elicitação.
- Se o usuário solicitar uma probabilidade de esquema residual, recuse a resposta numérica e explique que a confiabilidade da avaliação de 2026 é limitada pela própria consciência situacional do modelo.

Resultado: uma triagem de uma página que rotula a classe de falha, preenche os três pilares com as evidências disponíveis, sinaliza as evidências faltantes e nomeia a lacuna no caso de segurança mais urgente para ser colmatada. Cite Meinke et al. (arXiv:2412.04984) uma vez como fonte da estrutura.