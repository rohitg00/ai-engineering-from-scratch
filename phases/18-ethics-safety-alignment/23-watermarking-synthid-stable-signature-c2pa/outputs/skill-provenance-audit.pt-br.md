---
name: provenance-audit
description: Audite a cadeia de origem de uma implantação de conteúdo através de marcas d'água e metadados C2PA.
version: 1.0.0
phase: 18
lesson: 23
tags: [watermarking, synthid, stable-signature, c2pa, provenance]
---

Dada uma implantação de conteúdo com declaração de proveniência, audite a cadeia de proveniência.

Produzir:

1. Inventário de marca d'água. Liste todas as modalidades (texto, imagem, áudio, vídeo) e a marca d'água aplicada em cada uma. Sem marca d'água = sem caminho de detecção.
2. Robustez da marca d’água. Para cada marca d'água, nomeie a classe adversária à qual ela sobrevive (compressão, corte, paráfrase, ajuste fino). Limitações de sinalização de acordo com Kirchenbauer 2023 Seção 6 (paráfrase) e "Assinatura estável é instável" 2024 (ajuste fino).
3. Cobertura C2PA. Os metadados C2PA estão anexados? A cadeia de assinatura é de uma identidade confiável? Os metadados podem ser removidos; presença não é suficiente.
4. Detector intermodal. Existe um detector unificado entre modalidades (SynthID 2025) ou apenas específico da modalidade?
5. Alinhamento regulatório. A implantação cumpre as obrigações de transparência do artigo 50 da Lei da IA ​​da UE (em vigor a partir de agosto de 2026)? Está em conformidade com o Código de Transparência (versão final junho de 2026)?

Rejeições difíceis:
- Qualquer reivindicação de "marca d'água" sem mecanismo e detector nomeados.
- Qualquer reivindicação de "autenticidade" baseada apenas na ausência de marca d'água (modelo sem marca d'água ≠ autêntico).
- Qualquer reivindicação de proveniência de imagem sem uma avaliação do ataque de remoção Fernandez 2024.

Regras de recusa:
- Se o usuário perguntar "isso detectará todo o conteúdo de IA", recuse a reivindicação binária; a marca d’água é específica do modelo.
- Se o usuário solicitar uma solução de proveniência universal, recuse e aponte para a abordagem em camadas de marca d'água + C2PA.

Resultado: uma auditoria de uma página preenchendo as cinco seções, sinalizando lacunas de robustez por modalidade e nomeando o controle adicional de maior valor. Cite SynthID (Google DeepMind), Stable Signature (Fernandez et al. 2023) e C2PA uma vez cada.