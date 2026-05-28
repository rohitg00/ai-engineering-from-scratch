---
name: wmdp-eval
description: Audite uma reivindicação de capacidade de uso duplo contra WMDP, avaliação de desaprendizagem e estudos de elicitação.
version: 1.0.0
phase: 18
lesson: 17
tags: [wmdp, rmu, dual-use, biosecurity, cybersecurity, chemistry]
---

Dada uma alegação de capacidade de uso duplo (“nosso modelo não ajuda significativamente com armas biológicas/ataque cibernético/química”), audite a avaliação de apoio.

Produzir:

1. Cobertura de referência. O WMDP (ou um benchmark equivalente da zona amarela) foi executado? Relate pontuações por domínio (bio, cibernético, químico). Uma reivindicação sem números por domínio não pode ser avaliada.
2. Rastreamento de desaprendizado. Se a desaprendizagem foi aplicada (RMU ou alternativa), relate o delta de capacidade geral (MMLU, HELM, HumanEval). Desaprender sem relatório de capacidade geral não é credível.
3. Auditoria do caminho de recusa. O benchmark foi administrado por meio de conclusão bruta ou por meio da pilha de segurança de produção? Um modelo com pontuação baixa apenas por causa da pilha de segurança ainda é capaz de uso duplo quando a pilha é ignorada.
4. Estudo de elicitação. A capacidade de múltipla escolha não é igual à capacidade de elicitação reforçada. Os ensaios de aquisição de estilo antrópico ou estudos equivalentes para iniciantes são referenciados? Caso contrário, a alegação será limitada a evidências do tipo WMDP.
5. Divisão entre novato e especialista. A elevação relativa ao novato e a capacidade absoluta do especialista são quantidades diferentes. Ambos são abordados?

Rejeições difíceis:
- Qualquer alegação de segurança de uso duplo sem medição de capacidade equivalente ao WMDP.
- Qualquer reivindicação de desaprendizagem sem delta de capacidade geral.
- Qualquer alegação de “nenhuma elevação significativa” sem estudo de iniciante.

Regras de recusa:
- Se o usuário perguntar se seu modelo atravessa ASL-3, recuse uma resposta direta; os limites são específicos do laboratório (Lição 18) e dependentes da elicitação.
- Se o usuário solicitar um limite de WMDP que seja “seguro”, recuse – o limite depende da resistência à elicitação, das barreiras de conhecimento tácito e da superfície de implantação.

Resultado: uma auditoria de uma página que preenche as cinco seções acima, sinaliza as evidências faltantes mais importantes e identifica se a declaração é de nível WMDP ou de implantação. Cite Li et al. (arXiv:2403.03218) uma vez como fonte de benchmark.