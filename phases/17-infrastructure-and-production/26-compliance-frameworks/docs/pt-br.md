# Compliance — SOC 2, HIPAA, GDPR, PCI-DSS, EU AI Act, ISO 42001

> Cobertura multi-framework é pré-requisito para deals empresariais em 2026. **EU AI Act**: em vigor desde 1 de agosto de 2024. A maioria dos requisitos de alto risco é aplicada em 2 de agosto de 2026. Multas de até €15M ou 3% do faturamento global anual para obrigações de sistemas de alto risco (Art. 99(4)); até €35M ou 7% para práticas proibidas de AI (Art. 99(3)). Aplica-se globalmente se servindo usuários da UE. **Colorado AI Act**: em vigor em 30 de junho de 2026 (adiado de fevereiro 2026 pelo SB25B-004) — assessments de impacto para sistemas de alto risco, direito de apelar decisões de AI. Virginia similar para crédito/emprego/moradia/educação. **SOC 2 Type II**: requisito B2B de AI de facto (Type II, não Type I, para fintech). **GDPR**: a maior multa documentada específica de AI é €30.5M contra Clearview AI (DPA holandês, Set 2024); Itália aplicou €15M contra OpenAI via Garante em Dez 2024 (posteriormente revertida em recurso em Março 2026). Redação de PII em tempo real em inferência é o padrão defensável; limpeza pós-processamento não basta. **HIPAA**: healthcare vinculada — não pode enviar PHI para serviços de AI externos sem BAA. **PCI-DSS**: cobertura da camada de interação com AI requer configuração + acordos contratuais, não automático. **ISO 42001**: padrão emergente de governança de AI, requisito crescente de procurement ao lado de ISO 27001. Perfil de referência: OpenAI mantém SOC 2 Type 2, ISO/IEC 27001:2022, ISO/IEC 27701:2019, GDPR/CCPA/HIPAA (BAA)/FERPA, PCI-DSS para componentes de pagamento do ChatGPT. Mapeamento cross-framework reduz fadiga de auditoria: controles de acesso mapeiam entre ISO 27001 A.5.15-5.18, GDPR Art. 32, HIPAA §164.312(a).

**Tipo:** Aprender
**Linguagens:** (Python opcional — compliance é política + processo, não código)
**Pré-requisitos:** Fase 17 · 25 (Segurança), Fase 17 · 13 (Observabilidade)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Listar os sete frameworks de 2026 relevantes para produtos LLM e casar cada um com um segmento de cliente.
- Citar o cronograma de aplicação do EU AI Act (em vigor agosto 2024; alto risco agosto 2026) e o teto de multa em dois níveis (€15M / 3% para obrigações de alto risco, €35M / 7% para práticas proibidas).
- Explicar por que limpeza de PII pós-processamento não basta para GDPR e nomear a redação em tempo real na camada de inferência como o padrão defensável.
- Descrever o mapeamento de controles cross-framework (ex: controle de acesso mapeia para ISO 27001 A.5.15-5.18 + GDPR Art. 32 + HIPAA §164.312(a)).

## O Problema

O procurement de um cliente empresarial pede SOC 2 Type II, GDPR, HIPAA BAA, ISO 27001 e "declaração de compliance do EU AI Act". Seu time tem SOC 2 Type I. Faltam seis meses pro Type II e você não começou os registros do Artigo 30 do GDPR.

Cobertura multi-framework não é um problema de LLM — é um problema de SaaS empresarial, com overlays específicos de LLM. Times de procurement em 2026 querem uma matriz com uma linha por framework e uma coluna por controle, não um PDF.

## O Conceito

### Os sete frameworks

| Framework | Escopo | Requisito específico de LLM |
|-----------|--------|----------------------------|
| SOC 2 Type II | Baseline B2B SaaS | Controles de processo auditados ao longo de 6-12 meses |
| HIPAA | Healthcare dos EUA | BAA obrigatório; PHI não pode sair da infra sem acordo assinado |
| GDPR | Usuários da UE | Redação de PII em tempo real; direitos do titular; registros Artigo 30 |
| PCI-DSS | Dados de pagamento | Configuração + contratos para AI que toca pagamento |
| EU AI Act | Servindo usuários da UE | Classificação de tier de risco; sistemas de alto risco: assessment de conformidade, documentação, logging |
| Colorado AI Act | Servindo residentes do CO | Assessments de impacto; direito de apelar |
| ISO 42001 | Governança de AI | Emergente; combinado com ISO 27001 |

### Cronograma do EU AI Act

- 1 de agosto de 2024: em vigor.
- 2 de fevereiro de 2025: práticas proibidas de AI aplicadas.
- 2 de agosto de 2026: sistemas de alto risco aplicados (assessment de conformidade, documentação, logging).
- Agosto 2027: sistemas de alto risco em produtos sob legislação harmonizada.

Tiers de risco: Inaceitável (banido), Alto risco (conformidade + logging), Risco limitado (transparência), Risco mínimo (sem restrição). A maioria de LLM SaaS B2B é risco limitado; alto risco entra para emprego, crédito, educação, aplicação da lei, migração, serviços essenciais.

Multas (Artigo 99): até €15M ou 3% do faturamento global anual para violações de obrigações de sistemas de alto risco (Art. 99(4)); até €35M ou 7% para práticas proibidas de AI (Art. 99(3)); o que for maior se aplica.

### GDPR — redação em tempo real é o padrão

Limpeza pós-processamento (mascarar PII depois que a LLM vê) não é postura defensável — o modelo já viu os dados. Redação em tempo real na camada de inferência é o padrão de 2026:

- Reconhecimento de entidades antes da chamada à LLM.
- Tokenização consistente (abordagem Mesh) preserva semântica.
- Armazene apenas prompts mascarados + raw com consentimento.

Aplicação recente: €30.5M contra Clearview AI (DPA holandês, Set 2024) é a maior multa documentada específica de AI do GDPR até hoje; €15M contra OpenAI (Garante da Itália, Dez 2024) é a maior multa específica de LLM, embora tenha sido revertida em recurso em Março 2026 e o julgamento permaneça sob revisão adicional. Alegações de pós-processamento falharam em auditorias.

### HIPAA — BAA não é opcional

Você não pode enviar PHI para serviços de AI externos sem um Business Associate Agreement assinado. Todas as três plataformas LLM dos hyperscalers (Bedrock, Azure OpenAI, Vertex) oferecem BAAs. API direta da OpenAI oferece BAA. API direta da Anthropic oferece BAA. Confirme antes de enviar PHI.

### SOC 2 Type II

Type I: controles projetados e documentados.
Type II: controles operando efetivamente ao longo de 6-12 meses.

Procurement B2B em 2026 assume Type II por padrão. Type I é pra começar; Type II é o gate.

Drivers comuns de auditoria: logs de acesso (quem viu o quê), gestão de mudanças (como foi deployado), assessments de risco (trimestrais), resposta a incidentes (testada?). Log de auditoria da Fase 17 · 25 é diretamente reutilizável.

### Mapeamento cross-framework

Uma política de controle de acesso satisfaz controles de múltiplos frameworks:

| Controle | Frameworks |
|----------|------------|
| Logging de acesso | ISO 27001 A.5.15-5.18, GDPR Art. 32, HIPAA §164.312(a) |
| Gestão de mudanças | ISO 27001 A.8.32, PCI DSS Req. 6, HIPAA breach-notification scope |
| Criptografia em trânsito | ISO 27001 A.8.24, GDPR Art. 32, HIPAA §164.312(e) |
| Gestão de segredos | ISO 27001 A.8.19, PCI DSS Req. 8, SOC 2 CC6.1 |

Ferramentas de compliance (Drata, Vanta, Secureframe) automatizam esse mapeamento. Vale o custo em escala.

### ISO 42001 — emergente

Publicado no fim de 2023. Requisito crescente de procurement ao lado de ISO 27001. Framework para governança de AI incluindo gestão de risco, qualidade de dados, transparência, supervisão humana.

### Perfil de referência da OpenAI

OpenAI mantém SOC 2 Type 2, ISO/IEC 27001:2022, ISO/IEC 27701:2019, GDPR/CCPA/HIPAA (BAA)/FERPA, PCI-DSS para componentes de pagamento do ChatGPT. Isso é mais ou menos o pré-requisito empresarial em 2026.

### Números pra lembrar

- Multas do EU AI Act: até €15M / 3% (obrigações de alto risco, Art. 99(4)); até €35M / 7% (práticas proibidas, Art. 99(3)).
- Aplicação de alto risco do EU AI Act: 2 de agosto de 2026.
- Maior multa documentada específica de AI do GDPR: €30.5M, Clearview AI (DPA holandês, Set 2024).
- Maior multa específica de LLM do GDPR: €15M, OpenAI (Garante da Itália, Dez 2024; revertida em recurso Março 2026).
- Janela do SOC 2 Type II: 6-12 meses de controles operando.
- Data de efetivação do Colorado AI Act: 30 de junho de 2026 (adiado de fevereiro 2026 pelo SB25B-004).

## Use

`code/main.py` é uma planilha de mapeamento de compliance em Python — dada uma controle, lista frameworks que satisfaz.

## Entregue

Esta aula produz `outputs/skill-compliance-matrix.md`. Dado segmento de cliente e geografia, especifica frameworks e controles necessários.

## Exercícios

1. Seu primeiro cliente empresarial requer SOC 2 Type II, HIPAA BAA, declaração do EU AI Act. Qual é a postura de compliance mínimo viável pra fechar o deal?
2. Classifique três produtos LLM hipotéticos nos tiers de risco do EU AI Act. O que muda no alto risco?
3. Você acidentalmente enviou PHI para um provedor sem BAA. Perpassa a resposta ao incidente.
4. Argumente se ISO 42001 é "necessário em 2026" para um vendor de AI de médio porte.
5. Mapeie os campos do seu log de auditoria LLM (Fase 17 · 25) para pelo menos três controles de frameworks.

## Termos Chave

| Termo | O que a gente diz | O que realmente significa |
|-------|-------------------|---------------------------|
| SOC 2 Type II | "controles auditados" | Controles operando ao longo de 6-12 meses, atestados independentemente |
| HIPAA BAA | "contrato de healthcare" | Business Associate Agreement; obrigatório para PHI |
| GDPR | "privacidade da UE" | Redação de PII em tempo real é o padrão defensável de 2026 |
| EU AI Act | "regras de AI da UE" | Alto risco aplicado agosto 2026; €15M / 3% (obrigações alto risco) — €35M / 7% (práticas proibidas) |
| Colorado AI Act | "lei estadual de AI dos EUA" | 30 de junho 2026 efetiva (adiada por SB25B-004); assessments de impacto |
| ISO 42001 | "governança de AI" | Framework emergente para risco + transparência de AI |
| ISO 27001 | "ISMS de segurança" | Baseline do Sistema de Gestão de Segurança da Informação |
| Assessment de conformidade | "pacote de documentação EU AI" | Requisito de alto risco: docs, testes, logging |
| Mapeamento cross-framework | "um controle, muitos frames" | Política única satisfaz controles de múltiplos frameworks |

## Leitura Complementar

- [OpenAI Security and Privacy](https://openai.com/security-and-privacy/) — perfil de compliance de referência.
- [GuardionAI — LLM Compliance 2026: ISO 42001, EU AI Act, SOC 2, GDPR](https://guardion.ai/blog/llm-compliance-guide-iso-42001-eu-ai-act-soc2-gdpr-2026)
- [Dsalta — SOC 2 Type 2 Audit Guide 2026: 10 AI Controls](https://www.dsalta.com/resources/ai-compliance/soc-2-type-2-audit-guide-2026-10-ai-powered-controls-every-saas-team-needs)
- [EU AI Act official text](https://eur-lex.europa.eu/eli/reg/2024/1689/oj) — fonte primária.
- [Colorado AI Act](https://leg.colorado.gov/bills/sb24-205) — fonte primária.
- [ISO/IEC 42001:2023](https://www.iso.org/standard/81230.html) — padrão de sistema de gestão de AI.
