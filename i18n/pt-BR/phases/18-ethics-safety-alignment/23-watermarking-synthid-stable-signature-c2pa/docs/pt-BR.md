# Marcação de água  SynthID, assinatura estável, C2PA

> Três tecnologias estruturam 2026 proveniência de conteúdo gerado por IA. SynthID (Google DeepMind)  marcação de água de imagem lançada em agosto de 2023, texto + vídeo maio 2024 (Gemini + Veo), texto de código aberto outubro de 2024 através do Responsible GenAI Toolkit, detector multimédia unificado novembro 2025 ao lado do Gemini 3 Pro. A marcação de água de texto ajusta as probabilidades de amostragem do token seguinte de forma imperceptível; as marcas de água de imagem/vídeo sobrevivem à compressão, corte, filtros, alterações na taxa de quadros. Estabilidade da assinatura (Fernandez et al., ICCV 2023, arXiv:2303.15435)  sintonização do decodificador de difusão latente para que cada saída contenha uma mensagem fixa; imagens cortadas (10% do conteúdo) geradas detectadas > 90% no FPR<1e-6. Seguimento "A assinatura estável é instável" (arXiv:2405.07145, maio 2024)  ajuste fino remove a marca de água enquanto preserva a qualidade. C2PA  padrão de metadados criptográficamente assinado, com evidência de adulteração (C2PA 2.2 Explicador 2025). A marcação de águas e a C2PA são complementares: os metadados podem ser desligados, mas têm origem mais rica; as marcas de águas persistem através da transcodificação, mas transportam menos informação.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, token-watermark embed + detect)
**Prerequisites:** Phase 10 · 04 (sampling), Phase 01 · 09 (information theory)
**Time:** ~75 minutes

## Objetivos de aprendizagem

- Descreva a marcação de água a nível de token (estilo de texto SynthID) e o mecanismo pelo qual é detectável.
- Descreva a assinatura estável e o ataque de remoção de 2024 que a quebrou.
- O papel do C2PA estatal e por que é complementar ao marcado de água.
- Descreva as principais limitações: sinal específico do modelo, robustez sob parafrase e ataques que preservam o significado (arXiv:2508.20228).

## O problema

2023-2024 viu deepfakes e conteúdo gerado pela IA entrar em contextos políticos e de consumo em escala. A marcação de água é o sinal de proveniência técnica proposto: marque gerações no momento da criação, detecta-as mais tarde. 2025 evidência: nenhuma marcação de água é incondicionalmente robusta, mas em camadas com metadados C2PA a combinação fornece uma história de proveniência utilizável.

## O conceito

### Marcação de água do texto (estilo de texto SynthID)

O mecanismo de Kirchenbauer et al. 2023, produzido pelo Google:

1. Em cada passo de decodificação, hash os tokens K anteriores para produzir uma partição pseudorandomática do vocabulário em conjuntos "verde" e "vermelho".
2. Amostragem de bias em direção ao conjunto verde adicionando δ aos logitos verdes.
3. A geração contém mais tokens verdes do que o acaso produziria.

Detecção: repete cada prefixo, conte os tokens verdes na geração, compute uma pontuação z. A pontuação z é >0 para texto marcado por água, ~0 para texto humano.

Propriedades:
- Imperceptível para os leitores (δ é suficientemente pequeno para que a perda de qualidade seja menor).
- Detectável com acesso à função de partição de vocabulário.
- Não é robusto para parafrasear. Reescrever o texto destrói o sinal.

SynthID-text é de código aberto em outubro de 2024 através do Google Responsible GenAI Toolkit.

### Assinatura estável (imagem)

Fernandez et al. ICCV 2023. Fine-tune o decodificador de difusão latente para que cada imagem gerada contenha uma mensagem binária fixa incorporada na representação latente. A detecção é decodificada do latente com um decodificador neural.

Maio de 2024 "Signature stable is unstable" (arXiv:2405.07145): ajuste fino do decodificador remove a marca de água enquanto preserva a qualidade da imagem.

### Detetor unificado SynthID (novembro 2025)

Junto com o Gemini 3 Pro: um detector multimédia que lê sinais SynthID de texto, imagem, áudio e vídeo em uma API. Unifica a pilha de proveniência do Google.

### C2PA

Coalizão para a Providencia e Authenticidade do Conteúdo. Padrão de metadados criptográficamente assinado com evidência de adulteração. C2PA 2.2 Explicador (2025).

Complementar à marcação de água:
- Os metadados podem ser despojados; as marcas de água não podem (fácilmente).
- Os metadados são ricos (cadena de proveniência completa); as marcas de água transportam bits.
- C2PA depende da adoção da plataforma; marcas de água incorporadas automaticamente.

O Google integra tanto na Pesquisa, anúncios e "Acerca desta imagem".

### Limitações

- **Model-specific.**A geração de um modelo sem SynthID não é marcada por água, portanto, "nenhum sinal SynthID" não é prova de autenticidade.
- **Paraphrase.**As marcas de água do texto não sobrevivem à paráfrase que preserva o significado.
- **Transformation attacks.**arXiv:2508.20228 (2025) mostra ataques de preservação de significado que destroem marcas de água de texto e muitas marcas de água de imagem.
- **Fine-tune removal.**Por "Signature stable is unstable", o ajuste fino de pós-geração remove as marcas de água embutidas.

### Lei da UE sobre IA Artigo 50

Código de Transparência para a rotulagem de conteúdos gerados por IA (primeiro projecto de Dezembro de 2025, segundo projecto de Março de 2026, previsto final de Junho de 2026 para o [European Commission status page](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content)O código permanece em redação a partir de abril de 2026 e o cronograma está sujeito a alterações. A camada regulatória que requer a camada técnica.

### Onde isto encaixa na Fase 18

As lições 22-23 são sobre o que o modelo emite (dados privados, sinal de proveniência). A lição 27 abrange a governança de dados de formação. A lição 24 é o quadro regulamentar que exige essas medidas técnicas.

```figure
an-watermark-greenlist
```

## Usá-lo

`code/main.py`O sistema de detecção de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de

## Envia-o

Esta lição produz`outputs/skill-provenance-audit.md`- Tendo em conta uma implantação de conteúdos com uma alegação de proveniência, verifica: o mecanismo de marca de água (se houver), a cadeia de assinatura C2PA (se houver), a robustez adversária de cada um deles e a cobertura por modalidade.

## Exercícios

1. Corra .`code/main.py`. Relatar os resultados z para a geração de 1000 tokens com marca de água versus texto escrito por humanos. Identificar a taxa de falsos positivos no limiar de confiança de 95%.

2. Implementar um ataque parafrase que substitua 30% dos tokens por sinônimos.

3. Leia Kirchenbauer et al. 2023 Secção 6 sobre robustez. Por que as marcas de água de texto falham sob parafrase, mas as marcas de água de imagem sobrevivem ao corte?

4. Desenhar uma implementação que use SynthID-text + C2PA metadados. Descrever a cadeia de proveniência que um consumidor vê. Identificar um modo de falha de cada componente.

5. O resultado de 2024 "Signature estável é instável" mostra que o ajuste fino remove a marca de água da imagem.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| SynthID | "Google's watermark" | Cross-modal provenance signal; text, image, audio, video |
| Token watermark | "Kirchenbauer-style" | Biased-sampling text watermark detectable via green-token z-score |
| Stable Signature | "image watermark" | Fine-tuned-decoder watermark; ICCV 2023 |
| C2PA | "the metadata standard" | Cryptographically signed tamper-evident provenance metadata |
| Paraphrase robustness | "does rewording break it" | Text watermark property; currently limited |
| Fine-tune removal | "adversarial unwatermark" | Attack that removes image watermark via decoder fine-tuning |
| Cross-modal detector | "unified SynthID" | November 2025 unified API across modalities |

## Mais leitura

- [Kirchenbauer et al. — A Watermark for Large Language Models (ICML 2023, arXiv:2301.10226)](https://arxiv.org/abs/2301.10226) o mecanismo de marca de água de tokens
- [Fernandez et al. — Stable Signature (ICCV 2023, arXiv:2303.15435)](https://arxiv.org/abs/2303.15435) papel de marca de água de imagem
- ["Stable Signature is Unstable" (arXiv:2405.07145)](https://arxiv.org/abs/2405.07145) o ataque de remoção
- [Google DeepMind — SynthID](https://deepmind.google/models/synthid/) a marca de água transmodal
- [C2PA 2.2 Explainer (2025)](https://c2pa.org/specifications/specifications/2.2/explainer/Explainer.html) Padrão de metadados
