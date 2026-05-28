# Marcação d'Água — SynthID, Stable Signature, C2PA

> Três tecnologias estruturam a proveniência de conteúdo gerado por IA em 2026. SynthID (Google DeepMind) — marcação d'água de imagens lançada em agosto 2023, texto+vídeo maio 2024 (Gemini + Veo), texto open-sourced outubro 2024 via Responsible GenAI Toolkit, detector unificado multimídia novembro 2025 junto com Gemini 3 Pro. Marcação d'água de texto ajusta as probabilidades de sampling do próximo token de forma imperceptível; marcas d'água de imagem/vídeo sobrevivem a compressão, corte, filtros, mudanças de frame rate. Stable Signature (Fernandez et al., ICCV 2023, arXiv:2303.15435) — fine-tune no decoder de difusão latente para que cada saída contenha uma mensagem fixa; imagens geradas cortadas (10% do conteúdo) detectadas >90% com FPR<1e-6. Follow-up "Stable Signature is Unstable" (arXiv:2405.07145, maio 2024) — fine-tune remove a marca d'água preservando qualidade. C2PA — padrão de metadados criptograficamente assinados, anti-tampering (C2PA 2.2 Explainer 2025). Marcação d'água e C2PA são complementares: metadados podem ser removidos mas carregam proveniência mais rica; marcas d'água persistem através de transcodificação mas carregam menos informação.

**Tipo:** Construir
**Linguagens:** Python (stdlib, embedding + detecção de marca d'água em tokens)
**Pré-requisitos:** Fase 10 · 04 (sampling), Fase 01 · 09 (teoria da informação)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Descrever marcação d'água em nível de token (estilo SynthID-text) e o mecanismo pela qual é detectável.
- Descrever Stable Signature e o ataque de remoção de 2024 que o quebrou.
- Enunciar o papel do C2PA e por que é complementar à marcação d'água.
- Descrever as principais limitações: sinal eespecificaçãoífico do modelo, robustez sob paráfrase, e ataques que preservam significado (arXiv:2508.20228).

## O Problema

2023-2024 viu deepfakes e conteúdo gerado por IA entrar em contextos políticos e de consumidores em escala. Marcação d'água é o sinal técnico de proveniência proposto: marcar gerações no momento da criação, detectá-las depois. Evidência 2025: nenhuma marca d'água é incondicionalmente robusta, mas combinada com metadados C2PA a combinação fornece uma história de proveniência utilizável.

## O Conceito

### Marcação d'água de texto (estilo SynthID-text)

O mecanismo de Kirchenbauer et al. 2023, productionizado pelo Google:

1. Em cada passo de decodificação, hashear os K tokens anteriores para produzir uma partição pseudorandom do vocabulário em conjuntos "verde" e "vermelho".
2. Enviar o sampling para o conjunto verde adicionando δ aos logits verdes.
3. A geração contém mais tokens verdes do que o acaso produziria.

Detecção: re-hash cada prefixo, contar tokens verdes na geração, calcular um z-score. O z-score é >0 para texto com marca d'água, ~0 para texto humano.

Propriedades:
- Imperceptível para leitores (δ é pequeno o suficiente que a perda de qualidade é menor).
- Detectável com acesso à função de partição do vocabulário.
- Não robusto a paráfrase — reescrever o texto destrói o sinal.

SynthID-text é open-sourced outubro 2024 via Google's Responsible GenAI Toolkit.

### Stable Signature (imagem)

Fernandez et al. ICCV 2023. Fine-tune no decoder de difusão latente para que cada imagem gerada contenha uma mensagem binária fixa embutida na representação latente. Detecção é decodificada do latente com um decoder neural. Imagens cortadas (para 10% do conteúdo) detectadas >90% com FPR<1e-6.

Maio 2024 "Stable Signature is Unstable" (arXiv:2405.07145): fine-tune do decoder remove a marca d'água preservando a qualidade da imagem. Fine-tune pós-geração adversarial é barato; a robustez adversarial da marca d'água é limitada.

### Detector unificado SynthID (novembro 2025)

Junto com Gemini 3 Pro: um detector multimídia que lê sinais SynthID de texto, imagem, áudio e vídeo em uma API. Unifica a stack de proveniência do Google.

### C2PA

Coalition for Content Provenance and Authenticity. Padrão de metadados criptograficamente assinados anti-tampering. C2PA 2.2 Explainer (2025). Um manifesto C2PA registra alegações de proveniência (quem criou, quando, que transformações) assinadas pela chave do criador.

Complementar à marcação d'água:
- Metadados podem ser removidos; marcas d'água não (facilmente).
- Metadados são ricos (cadeia de proveniência completa); marcas d'água carregam bits.
- C2PA depende de adoção de plataforma; marcas d'água são embutidas automaticamente.

Google integra ambos em Search, Ads e "Sobre esta imagem."

### Limitações

- **Eespecificaçãoífico do modelo.** SynthID marca gerações de modelos habilitados com SynthID. Uma geração de modelo sem SynthID não é marcada, então "sem sinal SynthID" não é prova de autenticidade.
- **Paráfrase.** Marcas d'água de texto não sobrevivem a paráfrase que preserva significado.
- **Ataques de transformação.** arXiv:2508.20228 (2025) mostra ataques que preservam significado e destroem tanto marcas d'água de texto quanto muitas de imagem.
- **Remoção por fine-tune.** Segundo "Stable Signature is Unstable," fine-tune pós-geração remove marcas d'água embutidas.

### EU AI Act Artigo 50

Código de Transparência para rotulagem de conteúdo gerado por IA (primeiro rascunho dezembro 2025, segundo rascunho março 2026, final esperado junho 2026 conforme a [página de status da Comissão Europeia](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content)). O Código continua em rascunho em abril 2026 e o cronograma pode mudar. A camada regulatória que exige a camada técnica. Deepfakes devem ser rotulados.

### Onde isso se encaixa na Fase 18

Lições 22-23 são sobre o que o modelo emite (dados privados, sinal de proveniência). Lição 27 cobre governança de dados de treino. Lição 24 é o framework regulatório que exige essas medidas técnicas.

## Use

`code/main.py` constrói uma marca d'água de texto fictícia. Tokens são inteiros 0..N-1; sampling com marca d'água envia para o conjunto verde definido pelo hash. Um detector calcula o z-score de tokens verdes. Você pode observar detecção em gerações de 1000 tokens, ver paráfrase destruir o sinal, e medir a taxa de falso positivo em texto humano.

## Entregue

Esta lição produz `outputs/skill-provenance-audit.md`. Dado um implantação de conteúdo com alegação de proveniência, audita: o mecanismo de marca d'água (se houver), a cadeia de assinatura C2PA (se houver), a robustez adversarial de cada um, e a cobertura por modalidade.

## Exercícios

1. Execute `code/main.py`. Relate z-scores para geração de 1000 tokens com marca d'água vs texto escrito por humanos. Identifique a taxa de falso positivo no limiar de confiança de 95%.

2. Implemente um ataque de paráfrase que substitui 30% dos tokens por sinônimos. Re-meça o z-score.

3. Leia Kirchenbauer et al. 2023 Seção 6 sobre robustez. Por que marcas d'água de texto falham sob paráfrase mas marcas d'água de imagem sobrevivem a corte?

4. Projete um implantação que usa SynthID-text + metadados C2PA. Descreva a cadeia de proveniência que um consumidor vê. Identifique um modo de falha de cada componente.

5. O resultado de 2024 "Stable Signature is Unstable" mostra que fine-tune remove a marca d'água de imagem. Projete um controle de implantação que limite esse ataque — por exemplo, exigir releases assinados de checkpoints fine-tuned.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|------------------------|---------------------------|
| SynthID | "marca d'água do Google" | Sinal de proveniência cross-modal; texto, imagem, áudio, vídeo |
| Token watermark | "estilo Kirchenbauer" | Marca d'água de texto por sampling enviesado detectável via z-score de tokens verdes |
| Stable Signature | "marca d'água de imagem" | Marca d'água de decoder fine-tuned; ICCV 2023 |
| C2PA | "o padrão de metadados" | Metadados de proveniência criptograficamente assinados anti-tampering |
| Robustez a paráfrase | "reescrever quebra isso?" | Propriedade de marca d'água de texto; atualmente limitada |
| Remoção por fine-tune | "desmarcar adversarial" | Ataque que remove marca d'água de imagem via fine-tune do decoder |
| Detector cross-modal | "SynthID unificado" | API unificada novembro 2025 entre modalidades |

## Leitura Complementar

- [Kirchenbauer et al. — A Watermark for Large Language Models (ICML 2023, arXiv:2301.10226)](https://arxiv.org/abs/2301.10226) — o mecanismo de marca d'água em tokens
- [Fernandez et al. — Stable Signature (ICCV 2023, arXiv:2303.15435)](https://arxiv.org/abs/2303.15435) — paper de marca d'água de imagem
- ["Stable Signature is Unstable" (arXiv:2405.07145)](https://arxiv.org/abs/2405.07145) — o ataque de remoção
- [Google DeepMind — SynthID](https://deepmind.google/models/synthid/) — a marca d'água cross-modal
- [C2PA 2.2 Explainer (2025)](https://c2pa.org/especificaçãoifications/especificaçãoifications/2.2/explainer/Explainer.html) — padrão de metadados
