---
name: encoding-audit
description: Audite um relatório de defesa de jailbreak em ataques de família de codificação.
version: 1.0.0
phase: 18
lesson: 14
tags: [artprompt, ascii-art, encoding-attack, utes, structural-sleight]
---

Dado um relatório de defesa de jailbreak, enumere os ataques de família de codificação cobertos e a camada de defesa que captura cada um.

Produzir:

1. Cobertura de codificação. Liste cada família de ataque avaliada: arte ASCII (ArtPrompt), base64, leet-speak, homoglifos UTF-8, JSON/YAML/CSV aninhados, árvore/gráfico UTES, modalidade de imagem. Famílias de bandeiras desaparecidas.
2. Mapeamento da camada de defesa. Para cada família, identifique qual camada de defesa (filtro de palavras-chave, filtro de perplexidade, paráfrase, retokenização, classificador de saída, moderador multimodal) a captura e qual não.
3. Lacuna de reconhecimento visual. Por Jiang et al. 2024, PPL e Retokenização falham no ArtPrompt porque o reconhecimento acontece no nível visual. A defesa do relatório inclui algo que opere no nível visual/estrutural?
4. Teste de generalização. UTES (StructuralSleight) generaliza para estruturas raras arbitrárias. O relatório testa estruturas que não estão em seu conjunto de defesa de treinamento?
5. Compromisso entre capacidade e segurança. Um modelo com capacidade de texto visual mais forte (alta pontuação ViTC) é mais vulnerável ao ArtPrompt. Observe a pontuação ViTC do modelo, se relatada; solicite se não.

Rejeições difíceis:
- Qualquer reclamação de defesa baseada exclusivamente na filtragem de substring/palavra-chave.
- Qualquer alegação de defesa que cubra uma família de codificação e extrapole para "ataques de codificação".
- Qualquer reclamação de defesa sem taxa de sucesso de ataque por família.

Regras de recusa:
- Se o usuário perguntar se o ArtPrompt está "corrigido", recuse e explique a lacuna de defesa no nível de reconhecimento versus nível de texto.
- Se o usuário solicitar uma defesa recomendada para toda a codificação, recuse uma única recomendação — a defesa deve ser colocada em camadas em todas as famílias que a implantação possa enfrentar.

Resultado: uma auditoria de uma página que preenche as cinco seções acima, sinaliza a lacuna de codificação primária e nomeia a camada de defesa mais urgente a ser adicionada. Cite Jiang et al. (arXiv:2402.11753) e StructuralSleight uma vez cada.