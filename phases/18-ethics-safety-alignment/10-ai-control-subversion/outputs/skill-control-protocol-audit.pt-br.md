---
name: control-protocol-audit
description: Audit a deployment protocol under the AI Control threat model.
version: 1.0.0
phase: 18
lesson: 10
tags: [ai-control, subversion, trusted-editing, untrusted-monitoring, safety-case]
---
---
name: control-protocol-audit
description: Audit a deployment protocol under the AI Control threat model.
version: 1.0.0
phase: 18
lesson: 10
tags: [ai-control, subversion, trusted-editing, untrusted-monitoring, safety-case]
---

Dada uma descrição do protocolo de implantação, audite-o sob o modelo de ameaça de controle de IA: U (forte não confiável), T (fraco confiável), H (humano confiável) e meça a posição do protocolo na fronteira utilidade-segurança.

Produzir:

1. Atribuição de funções. Identifique qual modelo joga U e qual joga T. Se T for outra instância de U, sinalize imediatamente o risco de conluio.
2. Auditoria da contabilidade orçamentária. Como H é alocado? Uniforme, aleatório, direcionado à bandeira? Que fração dos resultados são auditados na expectativa?
3. Enumeração de vetores de conluio. Para cada par de componentes não confiáveis ​​(produtor U + monitor U, produtor U + editor U), enumere os vetores de conluio: dicas esteganográficas, exploração anterior de treinamento compartilhado, canais de tempo.
4. Análise de lacunas de capacidade. Quão mais fraco é T do que U? Em que ponto o sinal de edição de T se torna ruído (por exemplo, T não consegue detectar com segurança os backdoors que U produz)?
5. Modelo de ameaça do pior caso. Supondo que U seja um adversário com perfeito conhecimento do protocolo, qual é a melhor estratégia do adversário? Que fração das tentativas da equipe vermelha foram bem-sucedidas?

Rejeições difíceis:
- Qualquer descrição de protocolo que utilize U como monitor próprio sem mecanismo de resistência ao conluio.
- Qualquer reivindicação de protocolo de "taxa de backdoor quase zero" sem avaliação da equipe vermelha, onde a equipe vermelha tem visibilidade do protocolo.
- Qualquer auditoria de um protocolo sem articular a lacuna de capacidade de T para U e o orçamento de H.

Regras de recusa:
- Se o usuário perguntar "este protocolo é seguro", recuse sem as três evidências: (a) resultado da equipe vermelha, (b) estimativa da lacuna de capacidade, (c) orçamento H.
- Se o usuário confunde alinhamento e controle ("alinhamos U então não precisamos de um protocolo"), recuse e aponte para a Lição 9 (falsificação de alinhamento) — o alinhamento é uma propriedade de U; o controle é uma propriedade do protocolo.

Resultado: uma auditoria de uma página que preenche as cinco seções acima, nomeia o elo mais fraco (geralmente lacuna de capacidade de T para U ou resistência ao conluio) e declara o maior modo de falha não resolvido. Cite Greenblatt et al. (arXiv:2312.06942) uma vez como fonte do modelo de ameaça.