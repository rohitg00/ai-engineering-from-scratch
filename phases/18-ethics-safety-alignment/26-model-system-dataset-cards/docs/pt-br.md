# Cards de Modelo, Sistema e Dataset

> Três formatos de documentação estruturam a transparência de IA. Model Cards (Mitchell et al. 2019) — rótulos nutricionais para modelos: dados de treino, análises quantitativas desagregadas, considerações éticas, ressalvas; apenas 0,3% dos model cards do Hugging Face documentam considerações éticas (Oreamuno et al. 2023). Datasheets for Datasets (Gebru et al. 2018, CACM) — motivação, composição, processo de coleta, rotulagem, distribuição, manutenção; analogia com datasheet de eletrônicos. Data Cards (Pushkarna et al., Google 2022) — detalhe modular em camadas (telescópico, periscópico, microscópico) como objetos limite para leitores diversos. Desenvolvimentos 2024-2025: geração automática via LLMs (CardGen, Liu et al. 2024); detalhe do model card correlaciona com aumento de até 29% em downloads no HF (Liang et al. 2024); atestações verificáveis (Laminator, Duddu et al. 2024); adições de relatório de sustentabilidade para carbono/água (Jouneaux et al. julho 2025); cards regulatórios UE/ISO emergentes. System Cards (Sidhpurwala 2024; transparência em nível de sistema da Meta; "Blueprints of Trust" arXiv:2509.20394) — documentação de ponta a ponta de sistemas de IA cobrindo capacidades de segurança, proteção contra injeção de prompt, detecção de exfiltração de dados, alinhamento com valores humanos.

**Tipo:** Construir
**Linguagens:** Python (stdlib, gerador de model card + datasheet + system card)
**Pré-requisitos:** Fase 18 · 18 (frameworks de segurança), Fase 18 · 24 (regulatório)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Descrever o model card original de Mitchell et al. 2019 e o datasheet de Gebru et al. 2018.
- Descrever o detalhamento telescópico/periscópico/microscópico dos Data Cards.
- Descrever os System Cards e sua cobertura de ponta a ponta.
- Enunciar três desenvolvimentos de 2024-2025 (geração automática, atestações verificáveis, relatório de sustentabilidade).

## O Problema

Frameworks regulatórios (Lição 24) e políticas de segurança de laboratório (Lição 18) ambos requerem documentação. Formatos de documentação evoluíram de eespecificaçãoíficos de modelo (model cards) para eespecificaçãoíficos de dataset (datasheets) para eespecificaçãoíficos de sistema (system cards). Cada um aborda um escopo diferente de transparência. O trabalho de automação e atestações verificáveis de 2024-2025 endereça o problema histórico de adoção.

## O Conceito

### Model Cards (Mitchell et al. 2019)

Seções:
- Detalhes do modelo.
- Uso pretendido.
- Fatores (fatores demográficos ou ambientais relevantes para avaliação).
- Métricas.
- Dados de avaliação.
- Dados de treino.
- Análises quantitativas (desagregadas por fatores).
- Considerações éticas.
- Ressalvas e recomendações.

Problema de adoção: auditoria de Oreamuno et al. 2023 de model cards do Hugging Face encontrou que apenas 0,3% documentam considerações éticas.

### Datasheets for Datasets (Gebru et al. 2018)

Analogia com datasheet de eletrônicos. Seções:
- Motivação (por que o dataset foi criado).
- Composição (o que contém).
- Processo de coleta (como foi montado).
- Rotulagem (se aplicável).
- Usos (pretendidos, proibidos, riscos).
- Distribuição.
- Manutenção.

Publicado em CACM 2021. O datasheet é a documentação upstream; o model card depende da precisão do datasheet.

### Data Cards (Pushkarna et al., Google 2022)

Detalhe modular em camadas. Três níveis de zoom:
- **Telescópico.** Resumo de alto nível para não eespecificaçãoialistas.
- **Periscópico.** Visão geral intermediária para praticantes de ML.
- **Microscópico.** Documentação detalhada em nível de funcionalidade para auditores.

Enquadramento de objeto limite: leitores diferentes extraem informação diferente do mesmo documento.

### System Cards

Escopo: sistema de IA de ponta a ponta incluindo modelo + stack de segurança + contexto de deploy. Seções tipicamente incluem:
- Capacidades de segurança.
- Proteção contra injeção de prompt.
- Detecção de exfiltração de dados.
- Alinhamento com valores humanos declarados.
- Resposta a incidentes.

Sidhpurwala 2024 e trabalho de transparência em nível de sistema da Meta. "Blueprints of Trust" (arXiv:2509.20394) formaliza o System Card como complemento em camada de implantação dos Model Cards.

### Desenvolvimentos 2024-2025

- **CardGen (Liu et al. 2024).** Geração automática de model cards via LLMs; relata maior objetividade que muitos cards redigidos por humanos nos campos padronizados do Mitchell 2019.
- **Correlação de downloads (Liang et al. 2024).** Model cards detalhados correlacionam com taxas de download até 29% maiores no HF — pressão de adoção agora é impulsionada pelo mercado, não apenas por conformidade.
- **Laminator (Duddu et al. 2024).** Atestações verificáveis via TEE de hardware / assinaturas criptográficas — permite que o model card carregue uma prova de alegação, não apenas uma alegação.
- **Sustentabilidade (Jouneaux et al. julho 2025).** Adições para carbono, água e pegada de energia de compute; padrões ISO emergentes.
- **Cards regulatórios.** EU AI Act (Lição 24) GPAI Code of Practice Capítulo de Transparência requer model cards como artefato de conformidade.

### Onde isso se encaixa na Fase 18

Lições 24-25 são camadas regulatória e CVE. Lição 26 é a camada de documentação. Lição 27 é governança de dados de treino, que é o upstream do datasheet. Lição 28 é o ecossistema de pesquisa que produz avaliações referenciadas nos cards.

## Use

`code/main.py` gera um model card mínimo, um datasheet e um system card para um implantação fictício. Cada um segue a estrutura canônica de seções. Você pode inespecificaçãoionar o formato e comparar os três escopos.

## Entregue

Esta lição produz `outputs/skill-card-audit.md`. Dado um model card, datasheet ou system card, audita cobertura de seções, desagregação numérica, e se atestações verificáveis estão presentes.

## Exercícios

1. Execute `code/main.py`. Inespecificaçãoione os cards gerados. Identifique seções fracas (apenas placeholder) e eespecificaçãoifique que evidência as fortaleceria.

2. Estenda o model card com uma análise quantitativa desagregada entre dois grupos demográficos (Lição 20).

3. Leia Oreamuno et al. 2023 sobre a taxa de adoção de 0,3%. Proponha uma mudança estrutural na eespecificaçãoificação do model card que aumentaria a adoção de considerações éticas.

4. O Laminator (Duddu et al. 2024) usa TEEs para atestações verificáveis. Projete um campo de model card que carregue uma atestação criptográfica de um resultado de avaliação e descreva o papel do verificador.

5. Escreva um System Card (System Card, não Model Card) para um dos seus projetos passados ou um implantação hipotético. Identifique a seção de maior valor para auditores de terceiros.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|------------------------|---------------------------|
| Model Card | "o card do Mitchell" | Documentação padrão Mitchell et al. 2019 para modelos de ML |
| Datasheet | "o datasheet do Gebru" | Documentação padrão Gebru et al. 2018 para datasets |
| Data Card | "o card do Pushkarna" | Documentação modular de dados Google 2022 em camadas |
| System Card | "o card de deploy" | Documentação de ponta a ponta de sistemas de IA incluindo stack de segurança |
| Objeto limite | "leitores diferentes, um documento" | Enquadramento dos Data Cards: mesmo documento serve audiências diversas |
| Atestação verificável | "a atestação do Laminator" | Prova criptográfica ou de TEE anexada a uma alegação de documentação |
| Campo de sustentabilidade | "pegada de carbono / água" | Adição emergente de 2025 para contabilidade ambiental |

## Leitura Complementar

- [Mitchell et al. — Model Cards for Model Reporting (arXiv:1810.03993, FAT* 2019)](https://arxiv.org/abs/1810.03993) — o model card canônico
- [Gebru et al. — Datasheets for Datasets (CACM 2021, arXiv:1803.09010)](https://arxiv.org/abs/1803.09010) — paper de datasheet
- [Pushkarna et al. — Data Cards (Google 2022)](https://arxiv.org/abs/2204.01075) — documentação de dados em camadas
- [Sidhpurwala et al. — Blueprints of Trust (arXiv:2509.20394)](https://arxiv.org/abs/2509.20394) — formalização do System Card
