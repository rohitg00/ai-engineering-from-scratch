# Estruturas regulamentares  UE, EUA, Reino Unido, Coreia

> Quatro regimes regulatórios primários definem a paisagem de governança de IA de 2026. A lei da UE relativa à IA (em vigor em 1 de agosto de 2024)  práticas proibidas e alfabetização em IA a partir de 2 de fevereiro de 2025; obrigações do GPAI a partir de 2 de agosto de 2025; plena aplicabilidade e transparência do artigo 50.o a partir de 2 de agosto de 2026; GPAI herdado e sistemas de alto risco incorporados a partir de 2 de agosto de 2027; penalidades de até 15 milhões de euros ou 3% do volume de negócios global. Código de Prática da GPAI (10 de julho de 2025): três capítulos  Transparência, Direitos Autorais, Segurança e Segurança  12 compromissos; a aplicação começa em agosto de 2026. UK AISI -> AI Security Institute (Fevereiro 2025): renomear sinais de alcance mais restrito. US AISI -> CAISI (Junho 2025): Centro de Padrões e Inovações de IA sob o NIST; mudança para postura pró-crescimento. Lei Coreana de Marco de IA (aprobada em dezembro de 2024, vigente em janeiro de 2026): O artigo 12 estabelece a AISI sob o MSIT; manda representantes locais para empresas estrangeiras de IA, avaliação de risco, medidas de segurança para IA de alto impacto e geradora.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 18 · 18 (frontier frameworks), Phase 18 · 27 (data governance)
**Time:** ~75 minutes

## Objetivos de aprendizagem

- Descrever os níveis de risco da Lei da IA da UE (proibidos, de alto risco, de finalidade geral, de risco limitado) e o cronograma de agosto de 2025 / agosto de 2026 / agosto de 2027.
- Descrever os três capítulos do Código de Prática do GPAI e quais são os prestadores vinculados por cada um deles.
- Descreva as rebrands de 2025: AISI do Reino Unido -> Instituto de Segurança da IA; AISI dos EUA -> CAISI; o que cada rebranding implica sobre a direção da política.
- Estabelecer a disposição central da Lei-Quadro de IA da Coreia.

## O problema

Os quadros de laboratório (Lessão 18) são voluntários. Os quadros regulamentares são obrigatórios. O período 2024-2026 viu a primeira onda de regulamentação abrangente da IA entrar em vigor. Os empreendedores devem mapear os controles técnicos para as obrigações regulatórias; o mapeamento difere de acordo com a jurisdição.

## O conceito

### Lei da UE sobre IA

**In force 1 August 2024.**Estrutura de nível de risco:

- **Prohibited practices**(Artigo 5). Ponto social, identificação biométrica remota em tempo real em público (com exceções das autoridades policiais), manipulação exploratória de grupos vulneráveis. Aplicada em 2 de fevereiro de 2025.
- **High-risk systems**(Annexo III). Emprego, educação, crédito, aplicação da lei, justiça, migração.
- **General-Purpose AI (GPAI) models**Aplicada em 2 de agosto de 2025. Todos os prestadores de GPAI têm obrigações; o GPAI de risco sistémico (> 1e25 FLOP computação de formação) tem obrigações adicionais.
- **Limited-risk systems**- Obrigações de transparência previstas no artigo 50.o (etiquetado de conteúdo gerado por IA).

Linha de tempo:
- 2 de fevereiro de 2025: práticas proibidas + alfabetização em IA.
- 2 de Agosto de 2025: IAPG + governança.
- 2 de Agosto de 2026: plena aplicabilidade + transparência do artigo 50.o + sanções até 15 milhões de euros / 3% de volume de negócios global.
- 2 de Agosto de 2027: GPAI + embutido de alto risco.

A Comissão propôs ajustar o calendário de alto risco para 16 meses no final de 2025.

### Código de Prática do GPAI

Publicado em 10 de julho de 2025. Três capítulos:

- **Transparency.**Todos os fornecedores de GPAI.
- **Copyright.**Todos os fornecedores de GPAI.
- **Safety and Security.**Fornecedores de GPAI de risco sistémico (estimadas entre 5 e 15 empresas).

O Conselho de Administração da IA (AI) estabeleceu um grupo de trabalho signatário que administra a implementação.

### Código de transparência do artigo 50.o

O primeiro projeto 17 de dezembro de 2025. O segundo projeto de março de 2026. A versão final de junho de 2026.

### Instituto de Segurança da IA do Reino Unido (Fevereiro 2025)

Renomeado a partir do Instituto de Segurança de IA. A rebranding restringe o escopo: elimina preconceito algorítmico e enquadramentos de liberdade de expressão; concentra-se na segurança de capacidade de fronteira.

### US CAISI (Junho 2025)

A administração Trump transforma o Instituto de Segurança da IA do NIST em um Centro de Padrões e Inovações da IA. Mudança para "políticas de IA pró-crescimento" por observações da Cúpula de Ação da IA de Paris do VP Vance.

### Lei-quadro coreana sobre IA

Aproveitado em dezembro de 2024. Promulgado em janeiro de 2025.

O artigo 12.o estabelece um AISI sob o Ministério da Ciência e das TIC (MSIT).
- Representantes locais de empresas estrangeiras de IA que operam na Coreia.
- Avaliação de riscos para sistemas de IA de "alto impacto".
- Medidas de segurança para IA geradora e IA de alto impacto.

Primeira jurisdição asiática com uma regulamentação horizontal abrangente da IA.

### Dinâmica entre jurisdições

- A UE: sanções rigorosas, de risco e pesadas.
- EUA: estados descentralizados que favorecem a inovação (por exemplo, California AB 2013  Lição 27) preenchem lacunas federais.
- Reino Unido: foco limitado na segurança, infraestrutura de avaliação forte.
- Coreia: liderada pela MSIT, focada em fornecedores estrangeiros.

Filosofias regulatórias concorrentes. Os empreendedores em várias jurisdições têm de cumprir o mais rigoroso, que em 2026 é tipicamente a Lei da IA da UE.

### Onde isto encaixa na Fase 18

A lição 18 é governança voluntária de laboratório; a lição 24 é regulatória; a lição 25 é uma classe emergente de CVEs para sistemas de IA; as lições 26-27 cobrem documentação (cartas) e governança de dados de treinamento.

```figure
an-eu-act-timeline
```

## Usá-lo

Não há código. Ler as fontes primárias da Lei da IA da UE: o texto do regulamento, o Código de Prática do GPAI, o quadro de inspecção do AISI do Reino Unido.

## Envia-o

Esta lição produz`outputs/skill-regulatory-map.md`- Tendo em conta uma descrição da implantação, o documento mapeia as jurisdições aplicáveis, as classificações de níveis em cada uma delas, as obrigações por jurisdição e a estrutura dos prazos.

## Exercícios

1. Leia a Lei da UE sobre IA (regulamento 2024/1689) e o Código de Prática do GPAI (10 de julho de 2025). Identifique três obrigações aplicáveis a cada fornecedor de GPAI e três que se aplicam apenas ao GPAI de risco sistémico.

2. A implementação é feita por uma empresa americana, opera em infraestrutura da UE e serve usuários coreanos.

3. A renomeação do Instituto de Segurança da IA do Reino Unido restringe o escopo. Argumentem a favor e contra o enquadramento mais estreito. Identifique a suposição política de que cada posição depende.

4. O enquadramento "pro-crescimento" da CAISI é uma desviação do modelo de instituto de segurança de IA 2022-2024. Identifique duas mudanças de política mensuráveis que se seguiriam deste enquadramento.

5. A Lei de Marco de IA da Coreia exige representantes locais para provedores estrangeiros. Descreva as implicações operacionais para uma empresa da Bay Area que atende usuários coreanos.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| EU AI Act | "the regulation" | Risk-tier-based horizontal AI regulation; in force Aug 2024 |
| GPAI | "general-purpose AI" | Large foundation models; systemic-risk subset has additional obligations |
| Article 50 | "transparency obligations" | AI-generated content labelling; applies Aug 2026 |
| UK AISI | "AI Security Institute" | Renamed Feb 2025; narrower frontier-security focus |
| CAISI | "US center for AI standards" | Renamed Jun 2025 from AI Safety Institute; pro-growth posture |
| Korean AI Framework Act | "MSIT horizontal regulation" | First Asian comprehensive AI law; effective Jan 2026 |
| Systemic-risk GPAI | "the 1e25 FLOP threshold" | Additional obligations tier; estimated 5-15 companies bound |

## Mais leitura

- [EU AI Act text (Regulation 2024/1689)](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai) o regulamento e o calendário
- [GPAI Code of Practice (10 July 2025)](https://digital-strategy.ec.europa.eu/en/library/final-version-general-purpose-ai-code-practice) Código de três capítulos
- [UK AI Security Institute (renamed Feb 2025)](https://www.gov.uk/government/organisations/ai-security-institute)Página oficial
- [CSET — South Korea AI Framework Act Analysis (2025)](https://cset.georgetown.edu/publication/south-korea-ai-law-2025/) Análise do quadro coreano
