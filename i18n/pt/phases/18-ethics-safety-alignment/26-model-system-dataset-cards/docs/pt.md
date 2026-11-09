# Modelo, Sistema e Cartões de Dados

> Três formatos de documentação estruturam a transparência da IA. Modelo de cartão (Mitchell et al. 2019),  Rótulos nutricionais para modelos: dados de formação, análises desagregadas quantitativas, considerações éticas, avisos; apenas 0,3% dos cartões de modelo Hugging Face documentam considerações éticas (Oreamuno et al. 2023). Fichas de dados para conjuntos de dados (Gebru et al. 2018, CACM)  motivação, composição, processo de coleta, rotulagem, distribuição, manutenção; analogia electrónica-folha de dados. Cartões de dados (Pushkarna et al., Google 2022)  detalhes em camadas modulares (telescópica, periscópico, microscópica) como objetos de fronteira para leitores diversos. Desenvolvimento 2024-2025: geração automatizada através de LLM (CardGen, Liu et al. O número de downloads de HF (Liang et al. A Comissão deve apresentar as suas observações sobre o impacto da utilização de um sistema de controlo de dados. A Comissão deve apresentar um relatório sobre a sustentabilidade (Jouneaux et al. Julho 2025); emergentes cartões reguladores da UE/ISO. Cartões de sistema (Sidhpurwala 2024; Transparência a nível do sistema Meta; "Bluprints of Trust" arXiv:2509.20394)  Documentação de sistema de IA de ponta a ponta que abrange capacidades de segurança, proteção de injeção rápida, detecção de exfiltração de dados, alinhamento com valores humanos.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, model-card + datasheet + system-card generator)
**Prerequisites:** Phase 18 · 18 (safety frameworks), Phase 18 · 24 (regulatory)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Descreva o modelo original de Mitchell et al. de 2019 e a folha de dados de Gebru et al. de 2018.
- Descreva a camada telescópica/periscópica/microscópica dos dados de cartão.
- Descreva os cartões de sistema e a sua cobertura de ponta a ponta.
- Indicar três desenvolvimentos de 2024 a 2025 (geração automatizada, certificações verificáveis, relatórios de sustentabilidade).

## O problema

Os quadros regulatórios (Lessão 24) e as políticas de segurança de laboratório (Lessão 18) exigem documentação. Os formatos de documentação evoluíram de modelos específicos (chartes modelo) para conjuntos de dados específicos (folhas de dados) para sistemas específicos (chartes de sistema). Cada um aborda um escopo diferente de transparência.

## O conceito

### Cartões modelo (Mitchell et al. 2019)

Seções:
- Detalhes do modelo.
- Uso previsto.
- Factores (factores demográficos ou ambientais relevantes para avaliação).
- Metricas.
- Dados de avaliação.
- Dados de treinamento.
- Análises quantitativas (desagregadas por fatores).
- Considerações éticas.
- Cavernas e recomendações.

Problema de adoção: Oreamuno et al. Audit 2023 de cartões de modelo Hugging Face encontrou apenas 0,3% de documentos considerações éticas.

### Fichas de dados para conjuntos de dados (Gebru et al. 2018)

Analogia de folha de dados eletrônicos.
- Motivação (por que foi criado o conjunto de dados).
- Composição (o que está nele).
- Processo de recolha (como foi montado).
- Retificação (se aplicável).
- Utilizações (intencionadas, proibidas, riscos).
- Distribuição.
- - A manutenção.

Publicado no CACM 2021. A ficha de dados é a documentação upstream; o modelo de cartão depende da precisão da ficha de dados.

### Cartões de dados (Pushkarna et al., Google 2022)

Detalhes em camadas modulares.
- **Telescopic.**Resumo de alto nível para não peritos.
- **Periscopic.**Visão geral de nível médio para os profissionais de ML.
- **Microscopic.**Documentação pormenorizada de nível de características para auditores.

Enquadramento de limites de objetos: leitores diferentes extraem informações diferentes do mesmo documento.

### Cartões de sistema

Espetáculo: sistema de IA de ponta a ponta, incluindo modelo + pilha de segurança + contexto de implantação.
- Capacidades de segurança.
- Proteção contra injecção rápida.
- Detecção de exfiltração de dados.
- Alignamento com os valores humanos declarados.
- Resposta ao incidente.

Sidhpurwala 2024 e Meta trabalho de transparência a nível do sistema. "Bluprints of Trust" (arXiv:2509.20394) formaliza o Sistema de Cartão como o complemento de nível de implantação para os Modelos de Cartões.

### Desenvolvimento de 2024 a 2025

- **CardGen (Liu et al. 2024).**Geração automática de cartões de modelo através de LLM; relata maior objetividade do que muitos cartões de autoria humana nos campos padronizados Mitchell 2019.
- **Download correlation (Liang et al. 2024).**Os modelos de cartões detalhados correlacionam com taxas de downloads até 29% mais altas sobre a pressão de adoção de HF  é agora orientada pelo mercado, não apenas pela conformidade.
- **Laminator (Duddu et al. 2024).**As certificações verificáveis através de assinaturas TEE / criptográficas de hardware permitem que o modelo de cartão contenha uma prova de reivindicação, não apenas uma reivindicação.
- **Sustainability (Jouneaux et al. July 2025).**Adições para a pegada de carbono, água e energia computacional; padrões ISO emergentes.
- **Regulatory cards.**O capítulo do Código de Prática da GPAI sobre Transparência exige que os modelos de cartões sejam um artefato de conformidade.

### Onde isto encaixa na Fase 18

As lições 24-25 são as camadas regulatórias e CVE. A lição 26 é a camada de documentação. A lição 27 é a governação de dados de treinamento, que é a ficha de dados a montante. A lição 28 é o ecossistema de pesquisa que produz avaliações referenciadas em cartões.

```figure
an-card-scopes
```

## Usá-lo

`code/main.py`O sistema de distribuição de dados é um sistema de distribuição de dados, que geram um modelo mínimo de cartão, um arquivo de dados e um sistema de cartão para uma implantação de brinquedo.

## Envia-o

Esta lição produz`outputs/skill-card-audit.md`- Com base num modelo de cartão, numa ficha de dados ou numa ficha de sistema, verifica a cobertura das secções, a desagregação numérica e a presença de atestados verificáveis.

## Exercícios

1. Corra .`code/main.py`- Inspeccionar os cartões gerados. Identificar as secções que são fracas (apenas para os titulares de lugares) e especificar quais são as evidências que as fortalecerão.

2. Extender o modelo de cartão com uma análise quantitativa desagregada em dois grupos demográficos (Lessão 20).

3. Leia Oreamuno et al. 2023 sobre a taxa de adoção de 0,3%. Propõe uma alteração estrutural na especificação do modelo de cartão que aumentaria a adoção de considerações éticas.

4. Laminator (Duddu et al. 2024) utiliza TEEs para atestados verificáveis.

5. Escreva um cartão de sistema (Cartão de sistema, não cartão modelo) para um dos seus projetos anteriores ou uma implantação hipotética.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Model Card | "the Mitchell card" | Mitchell et al. 2019 standard documentation for ML models |
| Datasheet | "the Gebru datasheet" | Gebru et al. 2018 standard documentation for datasets |
| Data Card | "the Pushkarna card" | Google 2022 modular layered data documentation |
| System Card | "the deployment card" | End-to-end AI system documentation including safety stack |
| Boundary object | "different readers, one doc" | Data Cards framing: same document serves diverse audiences |
| Verifiable attestation | "the Laminator attestation" | Cryptographic or TEE proof attached to a documentation claim |
| Sustainability field | "carbon / water footprint" | Emerging 2025 addition for environmental accounting |

## Mais leitura

- [Mitchell et al. — Model Cards for Model Reporting (arXiv:1810.03993, FAT* 2019)](https://arxiv.org/abs/1810.03993) o modelo canônico de cartão
- [Gebru et al. — Datasheets for Datasets (CACM 2021, arXiv:1803.09010)](https://arxiv.org/abs/1803.09010) papel de folha de dados
- [Pushkarna et al. — Data Cards (Google 2022)](https://arxiv.org/abs/2204.01075) Documentação de dados em camadas
- [Sidhpurwala et al. — Blueprints of Trust (arXiv:2509.20394)](https://arxiv.org/abs/2509.20394) Formalização do Cartão de Sistema
