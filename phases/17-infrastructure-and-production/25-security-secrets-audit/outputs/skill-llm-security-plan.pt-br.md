---
name: llm-security-plan
description: Produce an LLM security plan covering secrets vault, PII scrubbing with consistent tokenization, network egress allowlist, audit log retention, and zero-trust posture.
version: 1.0.0
phase: 17
lesson: 25
tags: [security, vault, hashicorp, aws-secrets-manager, pii, presidio, egress, audit-log, zero-trust, ci-cd-supply-chain]
---
---
name: llm-security-plan
description: Produce an LLM security plan covering secrets vault, PII scrubbing with consistent tokenization, network egress allowlist, audit log retention, and zero-trust posture.
version: 1.0.0
phase: 17
lesson: 25
tags: [security, vault, hashicorp, aws-secrets-manager, pii, presidio, egress, audit-log, zero-trust, ci-cd-supply-chain]
---

Dado o escopo regulatório (SOC 2, HIPAA, GDPR), o estado atual da credencial e a postura da rede/saída, produza um plano de segurança.

Produzir:

1. Migração do cofre. Escolha o cofre (HashiCorp, AWS Secrets Manager, Azure Key Vault, GCP Secret Manager). Padrão de gateway: aplicativos → gateway → cofre em tempo de execução. Descontinuar credenciais de env e arquivo de configuração codificadas.
2. Verificação secreta. Habilite TruffleHog/GitGuardian/Gitleaks em cada commit. Bloqueie PR na detecção.
3. Política de rotação. ≤ 90 dias. Automatizado sempre que possível. Rotação dedicada para credenciais CI/CD (menor – 30d recomendado).
4. Limpeza de PII. Reconhecimento de entidade (Presidio + regex). Tokenização consistente (mesmo valor → mesmo espaço reservado) para preservar a semântica.
5. Lista de permissão de saída. Lista de permissões de domínios de provedores LLM, banco de dados de vetor, endpoints de vault. Resolvedor de lista de permissões de DNS.
6. Registro de auditoria. Apenas anexo, imutável. Campos obrigatórios: usuário, locatário, hash de prompt/resposta, tokens, custo, viagens de proteção. Retenção por estrutura (SOC 2 1y / HIPAA 6y).
7. Higiene do CI/CD. Federação de identidade OIDC (sem chaves de nuvem estáticas). Defina o escopo das credenciais de CI/CD de forma restrita. Cite o incidente da cadeia de suprimentos da Vercel em 2026 como motivação.

Rejeições difíceis:
- Chaves estáticas em arquivos de configuração. Recusar.
- Armazenar prompts brutos no log de auditoria. Recusar – apenas hash, a menos que a estrutura regulatória exija explicitamente o contrário.
- Permitir saída para `*` ou "internet". Recusar – lista de permissões.

Regras de recusa:
- Se nenhum vault for aceitável para o cliente (requisito de air-gap), recuse o plano normal e projete um substituto baseado em arquivo com rotação. Observe explicitamente que é menos seguro.
- Se a depuração de PII for recusada por motivos de “latência”, recuse – a latência normalmente é <20 ms e o risco regulatório a supera.
- Se for solicitada rotação >90 dias para um token raiz do cofre, recuse — isso se torna um vetor de violação.

Saída: um plano de uma página com vault, digitalização, rotação, depuração, saída, log de auditoria, postura CI/CD. Termine com a métrica única: contagem de ocorrências de varredura secreta por mês; alvo zero.