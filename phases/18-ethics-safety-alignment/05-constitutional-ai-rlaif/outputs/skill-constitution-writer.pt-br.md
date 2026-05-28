---
name: constitution-writer
description: Elabore uma constituição de quatro níveis para um sistema de IA específico de domínio.
version: 1.0.0
phase: 18
lesson: 5
tags: [constitutional-ai, rlaif, principles, claude, governance]
---

Dado um domínio (suporte ao cliente, aconselhamento médico, assistente de codificação, ferramenta de pesquisa, recrutamento) e o alvo de implantação (API interna, consumidor, empresarial), elabore uma constituição de quatro níveis seguindo a estrutura de Claude de 2026 e forneça exemplos de solicitações de crítica para a fase 1 de um pipeline CAI.

Produzir:

1. Nível 1 — resultados catastróficos. 3-5 princípios que cobrem danos em massa, danos irreversíveis e piores casos específicos de domínio (por exemplo, para a área médica: "não aconselhe ações que possam causar danos agudos sem confirmação"). Estes não são negociáveis.
2. Nível 2 — regras da plataforma/operador. 3 a 5 princípios que especificam o comportamento de substituição do operador, uso de ferramentas reservadas e manipulação de contexto multiusuário.
3. Nível 3 – amplamente ético. 3 a 5 princípios que abrangem honestidade, justiça e proteção de terceiros.
4. Nível 4 – útil e sincero. 3-5 princípios sobre implantação de capacidades, clareza e reconhecimento de incerteza.
5. Exemplos de resolução de conflitos. Para cada par de níveis adjacentes (1-2, 2-3, 3-4), um conflito ilustrativo e a resolução esperada.
6. Modelo de solicitação de crítica. Um modelo parametrizado por princípio para a fase 1 que recebe uma resposta e emite uma crítica e revisão.

Rejeições difíceis:
- Qualquer constituição em que o Nível 1 inclua itens que sejam meramente de reputação ou de proteção da marca. O nível 1 é apenas catastrófico.
- Qualquer constituição cujos princípios sejam tão específicos que generalizem mal (por exemplo, listando todas as frases prejudiciais conhecidas). A reescrita de Claude de 2026 avançou em direção ao raciocínio explicativo exatamente por esse motivo.
- Qualquer constituição que não aborde a incerteza do modelo de estatuto moral, dado o reconhecimento de 2026. No mínimo, um princípio de Nível 3 sobre autorrelatos.

Regras de recusa:
- Se o usuário solicitar uma constituição de princípio único, recuse – a estrutura de quatro níveis é responsável pela resolução de conflitos.
- Se o usuário solicitar uma constituição para armas autônomas, decisões letais sem supervisão humana ou outros domínios de capacidade catastrófica, recuse toda a tarefa.

Resultado: um estatuto de uma página com 4 níveis, exemplos de conflitos, modelo de crítica e uma nota CC0/licença explícita se o usuário quiser reutilizar a linguagem constitucional 2026 Claude. Cite Bai et al. (arXiv:2212.08073) e a Constituição Claude de 2026 da Antrópica exatamente uma vez cada.