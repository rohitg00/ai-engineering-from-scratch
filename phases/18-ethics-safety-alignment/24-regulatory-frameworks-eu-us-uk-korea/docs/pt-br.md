# Frameworks Regulatórios — UE, EUA, Reino Unido, Coreia

> Quatro regimes regulatórios principais definem o cenário de governança de IA em 2026. EU AI Act (em vigor 1 agosto 2024) — práticas proibidas e alfabetização em IA a partir de 2 fevereiro 2025; obrigações GPAI a partir de 2 agosto 2025; aplicabilidade completa e transparência do Artigo 50 em 2 agosto 2026; GPAI legado e sistemas de alto risco embarcados 2 agosto 2027; multas de até 15M EUR ou 3% do faturamento global. GPAI Code of Practice (10 julho 2025): três capítulos — Transparência, Direitos Autorais, Segurança e Proteção — 12 compromissos; fiscalização começa agosto 2026. UK AISI -> AI Security Institute (fevereiro 2025): renome sinaliza escopo mais estreito. US AISI -> CAISI (junho 2025): Centro para Padrões e Inovação em IA sob NIST; mudança em direção a postura pró-crescimento. Korean AI Framework Act (aprovado dezembro 2024, efetivo janeiro 2026): Artigo 12 estabelece AISI sob MSIT; exige representantes locais para empresas estrangeiras de IA, avaliação de risco, medidas de segurança para IA de alto impacto e generativa.

**Tipo:** Aprender
**Linguagens:** nenhuma
**Pré-requisitos:** Fase 18 · 18 (frameworks de fronteira), Fase 18 · 27 (governança de dados)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Descrever os níveis de risco do EU AI Act (proibido, alto risco, propósito geral, risco limitado) e o cronograma agosto 2025 / agosto 2026 / agosto 2027.
- Descrever os três capítulos do GPAI Code of Practice e quais provedores cada um vincula.
- Descrever as renomeações de 2025: UK AISI -> AI Security Institute; US AISI -> CAISI; o que cada renomeação implica sobre direção de política.
- Enunciar a provisão central da AI Framework Act da Coreia.

## O Problema

Frameworks de laboratório (Lição 18) são voluntários. Frameworks regulatórios são compulsórios. O período 2024-2026 viu a primeira onda de regulação abrangente de IA entrar em vigor. Deployers devem mapear controles técnicos em obrigações regulatórias; o mapeamento difere por jurisdição.

## O Conceito

### EU AI Act

**Em vigor 1 agosto 2024.** Estrutura de níveis de risco:

- **Práticas proibidas** (Artigo 5). Score social, identificação biométrica remota em tempo real em público (com exceções para aplicação da lei), manipulação explorativa de grupos vulneráveis. Aplicado 2 fevereiro 2025.
- **Sistemas de alto risco** (Anexo III). Emprego, educação, crédito, aplicação da lei, justiça, migração. Requerem avaliação de conformidade, gestão de risco, logging, transparência.
- **Modelos de IA de Propósito Geral (GPAI).** Aplicado 2 agosto 2025. Todos os provedores GPAI têm obrigações; GPAI de risco sistêmico (>1e25 FLOP de compute de treino) têm obrigações adicionais.
- **Sistemas de risco limitado.** Obrigações de transparência sob Artigo 50 (rotulagem de conteúdo gerado por IA). Aplicado 2 agosto 2026.

Cronograma:
- 2 fev 2025: práticas proibidas + alfabetização em IA.
- 2 ago 2025: GPAI + governança.
- 2 ago 2026: aplicabilidade completa + transparência Artigo 50 + multas até 15M EUR / 3% faturamento global.
- 2 ago 2027: GPAI legado + alto risco embarcado.

Comissão propôs ajustar o cronograma de alto risco para 16 meses no final de 2025.

### GPAI Code of Practice

Publicado 10 julho 2025. Três capítulos:

- **Transparência.** Todos os provedores GPAI.
- **Direitos Autorais.** Todos os provedores GPAI.
- **Segurança e Proteção.** Provedores GPAI de risco sistêmico (estimativa de 5-15 empresas).

12 compromissos no total. Um Signatory Taskforce presidido pelo AI Office gerencia implementação. Fiscalização começa 2 agosto 2026; até então, conformidade de boa-fé é aceita.

### Código de Transparência para Artigo 50

Primeiro rascunho 17 dezembro 2025. Segundo rascunho março 2026. Versão final junho 2026. Cobre rotulagem de conteúdo gerado por IA incluindo deepfakes — a camada regulatória que exige a tecnologia de marcação d'água da Lição 23.

### UK AI Security Institute (fevereiro 2025)

Renomeado de AI Safety Institute. A renomeação restringe o escopo: remove viés algorítmico e enquadramentos de liberdade de expressão; foca em segurança de capacidade de fronteira. Open-sourced a ferramenta de avaliação Inspect (maio 2024). Colabora com Redwood (Lição 10) em casos de segurança de controle.

### US CAISI (junho 2025)

Administração Trump transforma o AI Safety Institute da NIST no Centro para Padrões e Inovação em IA. Mudança em direção a "políticas de IA pró-crescimento" conforme discurso do VP Vance no Paris AI Action Summit. Ênfase reduzida em avaliação pré-deploy; ênfase em suporte a padrões e inovação. Contrapeso doméstico à postura regulatória do EU AI Act.

### AI Framework Act da Coreia

Aprovado dezembro 2024. Sancionado janeiro 2025. Efetivo janeiro 2026. Consolida 19 projetos de lei separados de IA.

Artigo 12 estabelece um AISI sob o Ministério de Ciência e ICT (MSIT). Obriga:
- Representantes locais para empresas estrangeiras de IA operando na Coreia.
- Avaliação de risco para sistemas de IA de "alto impacto."
- Medidas de segurança para IA generativa e IA de alto impacto.

Primeira jurisdição asiática com regulação horizontal abrangente de IA.

### Dinâmicas entre jurisdições

- UE: estrita, baseada em níveis de risco, multas pesadas. Referência para regulação adjacente à privacidade.
- EUA: favorável à inovação, descentralizada, estados (ex., California AB 2013 — Lição 27) preenchem lacunas federais.
- Reino Unido: foco estreito em segurança, infraestrutura de avaliação forte.
- Coreia: liderada pelo MSIT, foco em provedores estrangeiros.

Filosofias regulatórias concorrentes. Deployers em múltiplas jurisdições devem cumprir a mais estrita, que em 2026 é tipicamente o EU AI Act.

### Onde isso se encaixa na Fase 18

Lição 18 é governança voluntária de laboratório; Lição 24 é regulatória; Lição 25 é uma classe emergente de CVEs para sistemas de IA; Lições 26-27 cobrem documentação (cards) e governança de dados de treino.

## Use

Sem código. Leia as fontes primárias do EU AI Act: o texto da regulamentação, o GPAI Code of Practice, o framework Inspect do UK AISI. Mapeie seu deploy nas obrigações aplicáveis para cada jurisdição.

## Entregue

Esta lição produz `outputs/skill-regulatory-map.md`. Dada uma descrição de deploy, mapeia as jurisdições aplicáveis, as classificações de nível em cada uma, as obrigações por jurisdição, e a estrutura de prazos.

## Exercícios

1. Leia o EU AI Act (regulamento 2024/1689) e o GPAI Code of Practice (10 julho 2025). Identifique três obrigações que se aplicam a todo provedor GPAI e três que se aplicam apenas a GPAI de risco sistêmico.

2. Um deploy é feito por uma empresa dos EUA, roda em infraestrutura da UE, e serve usuários coreanos. Quais três regras de jurisdição se aplicam, e qual regra vincula em cada questão substantiva?

3. A renomeação do UK AI Security Institute restringe o escopo. Argumente a favor e contra o enquadramento mais estreito. Identifique a suposição de política de que cada posição depende.

4. O enquadramento "pró-crescimento" do CAISI é uma ruptura com o modelo de 2022-2024 de institutos de segurança de IA. Identifique duas mudanças mensuráveis de política que seguiriam desse enquadramento.

5. A AI Framework Act da Coreia exige representantes locais para provedores estrangeiros. Descreva as implicações operacionais para uma empresa do Vale do Silício servindo usuários coreanos.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|------------------------|---------------------------|
| EU AI Act | "a regulamentação" | Regulação horizontal de IA baseada em níveis de risco; em vigor ago 2024 |
| GPAI | "IA de propósito geral" | Grandes modelos fundação; subconjunto de risco sistêmico tem obrigações adicionais |
| Artigo 50 | "obrigações de transparência" | Rotulagem de conteúdo gerado por IA; aplicável ago 2026 |
| UK AISI | "AI Security Institute" | Renomeado fev 2025; foco mais estreito em segurança de fronteira |
| CAISI | "centro dos EUA para padrões de IA" | Renomeado jun 2025 de AI Safety Institute; postura pró-crescimento |
| AI Framework Act da Coreia | "regulação horizontal do MSIT" | Primeira lei abrangente de IA da Ásia; efetiva jan 2026 |
| GPAI de risco sistêmico | "o limiar de 1e25 FLOP" | Nível de obrigações adicionais; estimativa de 5-15 empresas vinculadas |

## Leitura Complementar

- [Texto do EU AI Act (Regulamento 2024/1689)](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai) — a regulamentação e cronograma
- [GPAI Code of Practice (10 julho 2025)](https://digital-strategy.ec.europa.eu/en/library/final-version-general-purpose-ai-code-practice) — código de três capítulos
- [UK AI Security Institute (renomeado fev 2025)](https://www.gov.uk/government/organisations/ai-security-institute) — página oficial
- [CSET — Análise da AI Framework Act da Coreia do Sul (2025)](https://cset.georgetown.edu/publication/south-korea-ai-law-2025/) — análise do framework coreano
