# Conformidade  SOC 2, HIPAA, GDPR, PCI-DSS, EU AI Act, ISO 42001

> A cobertura multi-quadro é a participação de mesa em 2026 acordos empresariais. **EU AI Act**A maioria dos requisitos de alto risco são aplicados em 2 de agosto de 2026. Impelas de até 15 milhões de euros ou 3% do volume de negócios global por obrigações de sistemas de alto risco (artigo 99(4); até 35 milhões de euros ou 7% por práticas proibidas de IA (artigo 99(3)).**Colorado AI Act**A Comissão propõe que a Comissão adopte um novo regulamento que estabelece as regras de aplicação do artigo 107.o, n.o 1, do Regulamento (CE) n.o 1083/2008.**SOC 2 Type II**: exigência de facto de IA B2B (tipo II, não tipo I, para fintech). **GDPR**A maior multa documentada específica de IA é de € 30,5 milhões contra a Clearview AI (DPA holandesa, setembro 2024); Garante da Itália emitiu € 15 milhões contra a OpenAI em dezembro de 2024 (mais tarde revogada em recurso em março de 2026).**HIPAA**: saúde obrigada  não pode enviar PHI para serviços externos de IA sem BAA. **PCI-DSS**: A cobertura de camadas de interação com IA requer configuração + acordos contratuais, não automática. **ISO 42001**O perfil de referência: OpenAI mantém SOC 2 Tipo 2, ISO/IEC 27001:2022, ISO/IEC 27701:2019, GDPR/CCPA/HIPAA (BAA) / FERPA, PCI-DSS para componentes de pagamento ChatGPT. O mapeamento cruzado reduz a fadiga de auditoria: controle de acesso mapa em toda a ISO 27001 A.5.15-5.18, GDPR Art. 32, HIPAA §164.312(a).

**Type:** Learn
**Languages:** (Python, TypeScript optional: compliance is policy + process, not code)
**Prerequisites:** Phase 17 · 25 (Security), Phase 17 · 13 (Observability)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Enumerar os sete quadros de 2026 relevantes para os produtos LLM e combinar cada um com um segmento de clientes.
- Citar o calendário de aplicação da Lei da IA da UE (em vigor em agosto de 2024; aplicação de riscos elevados em agosto de 2026) e o limite máximo de multa de dois níveis (€ 15 milhões / 3% para obrigações de alto risco, € 35 milhões / 7% para práticas proibidas).
- Explique por que a limpeza de PII pós-processamento não é suficiente para o GDPR e nomee a redação em tempo real da camada de inferência como o padrão defensivel.
- Descrever o mapeamento de controle transframe (por exemplo, mapas de controle de acesso para a ISO 27001 A.5.15-5.18 + GDPR Art. 32 + HIPAA §164.312 ((a)).

## O problema

A aquisição de um cliente empresarial pede SOC 2 Tipo II, GDPR, HIPAA BAA, ISO 27001, e "Declaração de conformidade com a Lei de IA da UE". Sua equipe tem SOC 2 Tipo I. Você tem seis meses do Tipo II e não iniciou os registros do Artigo 30 do GDPR.

A cobertura multi-quadro não é um problema de LLM  é um problema de Enterprise-SaaS, com sobreposições específicas de LLM. As equipes de aquisição em 2026 querem uma matriz com uma linha por framework e uma coluna por controle, não um PDF.

## O conceito

### Os sete quadros

| Framework | Scope | LLM-specific requirement |
|-----------|-------|--------------------------|
| SOC 2 Type II | B2B SaaS baseline | Process controls audited over 6-12 months |
| HIPAA | US healthcare | BAA required; PHI cannot leave infrastructure without signed agreement |
| GDPR | EU users | Real-time PII redaction; data subject rights; Article 30 records |
| PCI-DSS | Payment data | Configuration + contracts for AI touching payment |
| EU AI Act | Serving EU users | Risk tier classification; high-risk systems: conformity assessment, documentation, logging |
| Colorado AI Act | Serving CO residents | Impact assessments; right to appeal |
| ISO 42001 | AI governance | Emerging; pairs with ISO 27001 |

### Linha de tempo do Ato da IA da UE

- 1 de agosto de 2024: em vigor.
- 2 de fevereiro de 2025: aplicadas as práticas proibidas de IA.
- 2 de agosto de 2026: aplicação de sistemas de alto risco (avaliação da conformidade, documentação, registos).
- Agosto 2027: sistemas de alto risco em produtos, sob legislação harmonizada.

Níveis de risco: Inaceitável (proibido), Alto risco (conformidade + registros), Risco limitado (transparência), Risco mínimo (sem restrições). A maioria dos B2B LLM SaaS é de risco limitado; lançamentos de alto risco para emprego, crédito, educação, aplicação da lei, migração, serviços essenciais.

As multas (artigo 99): até 15 milhões de euros ou 3% do volume de negócios global anual por violação de obrigações de sistema de alto risco (artigo 99 ((4)); até 35 milhões de euros ou 7% para práticas proibidas de IA (artigo 99 ((3)); consoante o montante mais elevado.

### GDPR  Redigir em tempo real é o padrão

A limpeza pós-processamento (redigir PII depois que o LLM vê) não é uma postura defensiva  o modelo já viu os dados.

- Reconhecimento da entidade antes da convocatória de LLM.
- A tokenização consistente (abordagem Mesh) preserva a semântica.
- Armazenar apenas as instruções editadas + consentimento opt-in crudo.

Recentemente aplicada: € 30,5 milhões contra a Clearview AI (DPA holandesa, setembro 2024) é a maior multa GDPR documentada específica da IA até à data; € 15 milhões contra a OpenAI (Garante da Itália, dezembro 2024) é a maior multa específica da LLM, embora tenha sido revogada em recurso em março de 2026 e a decisão permanece sob revisão adicional.

### HIPAA  BAA não é opcional

Você não pode enviar PHI para serviços externos de IA sem um Acordo de Asociado de Negócios assinado. Todas as três plataformas de LLM hipercaler (Bedrock, Azure OpenAI, Vertex) oferecem BAAs. OpenAI diretamente API oferece BAA. Antropic diretamente API oferece BAA. Confirme antes de enviar PHI.

### SOC 2 Tipo II

Tipo I: controles concebidos e documentados.
Tipo II: os controles funcionam eficazmente durante 6 a 12 meses.

As compras B2B em 2026 são padrões para o tipo II. O tipo I é um iniciador; o tipo II é o portão.

Os principais factores de auditoria: registos de acesso (quem viu o quê), gestão de alterações (como foi implementada), avaliações de riscos (quarta-feira), resposta a incidentes (testada)?

### Mapeamento transversal

Uma política de controlo de acesso satisfaz vários controlos-quadro:

| Control | Frameworks |
|---------|-----------|
| Access logging | ISO 27001 A.5.15-5.18, GDPR Art. 32, HIPAA §164.312(a) |
| Change management | ISO 27001 A.8.32, PCI DSS Req. 6, HIPAA breach-notification scope |
| Encryption in transit | ISO 27001 A.8.24, GDPR Art. 32, HIPAA §164.312(e) |
| Secrets management | ISO 27001 A.8.19, PCI DSS Req. 8, SOC 2 CC6.1 |

As ferramentas de conformidade (Drata, Vanta, Secureframe) automatizam este mapeamento.

### ISO 42001  emergente

Publicado no final de 2023. Requisitos crescentes de aquisição junto com a ISO 27001.

### Profil de referência da OpenAI

A OpenAI mantém SOC 2 Tipo 2, ISO/IEC 27001:2022, ISO/IEC 27701:2019, GDPR/CCPA/HIPAA (BAA) / FERPA, PCI-DSS para componentes de pagamento ChatGPT. Isso é aproximadamente a mesa da empresa em 2026.

### Números que você deve lembrar

- As multas previstas na Lei da IA da UE: até 15 milhões de euros / 3% (obrigações de alto risco, artigo 99? 4)); até 35 milhões de euros / 7% (práticas proibidas, artigo 99? 3)).
- A aplicação da Lei da UE sobre IA em risco elevado: 2 de agosto de 2026.
- A maior multa do GDPR documentada específica da IA: € 30,5 milhões, Clearview AI (DPA holandês, setembro 2024).
- A maior multa do RGPD específica do LLM: 15 milhões de euros, OpenAI (Garante da Itália, de dezembro de 2024; revogada em recurso em março de 2026).
- O sistema SOC 2 Tipo II: 6 a 12 meses de controlo operacional.
- Data de entrada em vigor da Lei de IA do Colorado: 30 de junho de 2026 (retrasado a partir de fevereiro de 2026 pela SB25B-004).

```figure
i4-control-matrix
```

## Usá-lo

`code/main.py`é uma planilha de mapeamento de conformidade em Python  dado um controle, lista os quadros que satisfaz.

## Envia-o

Esta lição produz`outputs/skill-compliance-matrix.md`- Especifica os quadros e os controles necessários, tendo em conta o segmento de clientes e a sua geografia.

## Exercícios

1. O seu primeiro cliente empresarial requer SOC 2 Tipo II, HIPAA BAA, declaração da Lei de IA da UE. Qual é a postura mínima viável de conformidade para ganhar o negócio?
2. Classificar três produtos hipotéticos de LLM sob os níveis de risco da Lei da IA da UE.
3. Enviaste o PHI acidentalmente a um provedor sem BAA.
4. Argumentar se a ISO 42001 é "necessária em 2026" para um fornecedor de IA de mercado médio.
5. Mapear os campos de registro de auditoria do Mestrado em Direito (Fase 17 · 25) para pelo menos três controles estruturais.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| SOC 2 Type II | "audited controls" | Controls operating over 6-12 months, independently attested |
| HIPAA BAA | "healthcare contract" | Business Associate Agreement; required for PHI |
| GDPR | "EU privacy" | Real-time PII redaction is the defensible 2026 standard |
| EU AI Act | "EU AI rules" | High-risk enforcement August 2026; €15M / 3% (high-risk obligations) — €35M / 7% (prohibited practices) |
| Colorado AI Act | "US AI state law" | June 30, 2026 effective (delayed by SB25B-004); impact assessments |
| ISO 42001 | "AI governance" | Emerging framework for AI risk + transparency |
| ISO 27001 | "security ISMS" | Information Security Management System baseline |
| Conformity assessment | "EU AI doc package" | High-risk requirement: docs, testing, logging |
| Cross-framework mapping | "one control, many frames" | Single policy satisfies multiple framework controls |

## Mais leitura

- [OpenAI Security and Privacy](https://openai.com/security-and-privacy/) perfil de referência de conformidade.
- [GuardionAI — LLM Compliance 2026: ISO 42001, EU AI Act, SOC 2, GDPR](https://guardion.ai/blog/llm-compliance-guide-iso-42001-eu-ai-act-soc2-gdpr-2026)
- [Dsalta — SOC 2 Type 2 Audit Guide 2026: 10 AI Controls](https://www.dsalta.com/resources/ai-compliance/soc-2-type-2-audit-guide-2026-10-ai-powered-controls-every-saas-team-needs)
- [EU AI Act official text](https://eur-lex.europa.eu/eli/reg/2024/1689/oj) fonte primária.
- [Colorado AI Act](https://leg.colorado.gov/bills/sb24-205) fonte primária.
- [ISO/IEC 42001:2023](https://www.iso.org/standard/81230.html) Padrão de sistema de gestão de IA.
