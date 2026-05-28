---
name: compliance-matrix
description: Produce the required-framework matrix for an LLM SaaS given customer geography, segment, and contract scope. Map controls across SOC 2, HIPAA, GDPR, PCI-DSS, EU AI Act, Colorado AI Act, ISO 42001.
version: 1.0.0
phase: 17
lesson: 26
tags: [compliance, soc2, hipaa, gdpr, pci-dss, eu-ai-act, colorado-ai-act, iso-42001, iso-27001]
---
---
name: compliance-matrix
description: Produce the required-framework matrix for an LLM SaaS given customer geography, segment, and contract scope. Map controls across SOC 2, HIPAA, GDPR, PCI-DSS, EU AI Act, Colorado AI Act, ISO 42001.
version: 1.0.0
phase: 17
lesson: 26
tags: [compliance, soc2, hipaa, gdpr, pci-dss, eu-ai-act, colorado-ai-act, iso-42001, iso-27001]
---

Dada a geografia do cliente (EUA/UE/Global ou estados específicos dos EUA), segmento (SaaS/saúde/fintech), escopo do contrato (empresa vs SMB) e estado de conformidade atual, produza a matriz da estrutura necessária.

Produzir:

1. Estruturas necessárias. Liste cada estrutura que deve ser alcançada com justificativa (geografia, segmento, perfil do cliente).
2. Linha do tempo. Para cada estrutura, indique o estado atual (nenhum/Tipo I/em auditoria/Tipo II). Dê um nome à lacuna.
3. Mapeamento de controle entre estruturas. Para cada estrutura necessária, identifique controles que satisfaçam vários (log de acesso, criptografia, log de auditoria, gerenciamento de alterações).
4. Postura da Lei da UE sobre IA. Classifique o nível de risco do produto (inaceitável/alto/limitado/mínimo). Se for de alto risco, exija o caminho de avaliação de conformidade antes da data de aplicação de 2 de agosto de 2026.
5. Tratamento de PII/PHI. Confirme a redação da camada de inferência em tempo real (Fase 17 · 25) — o pós-processamento não é defensável pelo GDPR. Confirme BAAs para todos os fornecedores de IA que tocam em PHI.
6. Ferramentas de auditoria. Drata/Vanta/Secureframe para automação cross-framework. Vale o custo no escopo multi-framework.

Rejeições difíceis:
- Afirmar que o SOC 2 Tipo I é "compatível com o SOC 2" para compras empresariais. Recusar – O Tipo II é o portão.
- Envio de PHI para um provedor sem BAA. Recusar – violação da HIPAA.
- Limpeza pós-processamento de PII conforme postura do GDPR. Recuse – exija em tempo real.

Regras de recusa:
- Se o produto servir utilizadores da UE sem registos do Artigo 30 do RGPD, recuse o envio para clientes da UE até que os registos sejam estabelecidos.
- Se o produto atender residentes do Colorado em crédito/emprego/habitação/educação/serviços essenciais, exija evidência de uma avaliação de impacto concluída até 30 de junho de 2026 (data de entrada em vigor da Lei de IA do Colorado sob SB24-205 conforme alterado por SB25B-004) antes do lançamento.
- Se o produto for de alto risco ao abrigo da Lei de IA da UE e a equipa não tiver um plano de avaliação de conformidade, recuse-se a prometer a prontidão para Agosto de 2026 sem um parceiro de implementação nomeado.

Resultado: uma matriz de uma página com estruturas necessárias, estado atual, lacunas, cronograma, controles entre estruturas, nível da Lei de IA da UE, postura de PII, ferramentas. Termine com o roteiro de 12 meses: marcos trimestrais quadro a quadro.