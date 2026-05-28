# Segredos, Rotação de Chaves de API, Logs de Auditoria, Guardrails

> Elimine a dispersão de segredos via vaults centralizados (HashiCorp Vault, AWS Secrets Manager, Azure Key Vault). Nunca armazene credenciais em arquivos de config, env files no VCS, planilhas. Use funções IAM ao invés de chaves estáticas; OIDC para CI/CD. O padrão de AI-gateway é a solução de 2026: apps → gateway → provedor de modelo, com o gateway puxando credenciais do vault em tempo de execução. Rotacione no vault e todos os apps pegam em minutos — sem deploys, sem mensagens no Slack "quem tem a nova chave". Política de rotação ≤90 dias; escaneie com TruffleHog / GitGuardian / Gitleaks em todo commit. Zero trust: MFA, SSO, RBAC/ABAC, tokens de curta duração, postura de dispositivo. Limpeza de PII usa reconhecimento de entidades para mascarar PHI/PII antes de encaminhar; tokenização consistente (abordagem Mesh) mapeia valores sensíveis para placeholders estáveis para que a LLM preserve semântica de código/relacionamentos. Egress de rede: serviços LLM em subnet dedicada VPC/VNet com whitelist apenas de `api.openai.com`, `api.anthropic.com` etc; bloqueie todo o restante do tráfego de saída. O incidente motor de 2026: ataque de supply-chain da Vercel via credenciais de CI/CD comprometidas exfiltraram env vars de milhares de deploys de clientes.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, limpador brincadeira de PII + escritor de log de auditoria)
**Pré-requisitos:** Fase 17 · 19 (AI Gateways), Fase 17 · 13 (Observabilidade)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Listar os quatro anti-padrões de gestão de segredos (arquivos de config no VCS, env hardcoded, planilhas, chaves estáticas) e nomear seus substitutos.
- Explicar o padrão de AI-gateway-puxando-do-vault como padrão de produção de 2026.
- Implementar um limpador de PII com tokenização consistente (mesmo valor → mesmo placeholder) para que a semântica sobreviva.
- Nomear o incidente de supply-chain da Vercel em 2026 e o que ensinou sobre higiene de credenciais de CI/CD.

## O Problema

Um estagiário commita `.env` com chaves de API. Ele deleta rápido. As chaves já estão no histórico do git — escaneamento do GitGuardian pega, seu processo de rotação é "avisar o time no Slack, atualizar 40 arquivos de config, redeployar todos os serviços". 8 horas depois, metade dos seus serviços está no ar e metade esperando janelas de deploy.

Separadamente, prompts de usuários incluem "Meu CPF é 123.456.789-00". Prompt vai pra OpenAI. Você tem um BAA mas sua política interna é mascarar PII antes de encaminhar. Você não mascarou.

Separadamente, o pod LLM do seu cluster EKS consegue acessar qualquer host da internet. Alguém exfiltra dados via lookup DNS para um domínio controlado pelo atacante. Nada bloqueou.

Segurança para serviços LLM tem que endereçar todos os três vetores. Credenciais com base em vault. Limpeza de PII. Filtro de egress de rede. Logs de auditoria.

## O Conceito

### Vault centralizado + puxada por IAM role

**Vault**: HashiCorp Vault, AWS Secrets Manager, Azure Key Vault, GCP Secret Manager. Uma única fonte da verdade.

**IAM role**: app/gateway autentica via sua identidade IAM, não uma chave estática. Vault retorna o segredo pela duração do token.

**O padrão de AI-gateway**: gateway puxa `OPENAI_API_KEY` do vault no momento da request. Rotacione no vault; a próxima request recebe a chave nova. Sem deploys.

### Política de rotação ≤ 90 dias

Todas as chaves de API, root tokens do vault, credenciais de CI/CD. Rotação automatizada onde possível. Rotação manual registrada e rastreada.

### Escaneamento de segredos

- **TruffleHog** — regex + entropia em commits.
- **GitGuardian** — comercial, alta precisão.
- **Gitleaks** — OSS, roda no CI.

Rode em todo commit. Bloqueie PR se segredo novo detectado.

### Postura de zero trust

- MFA obrigatório em todas as contas.
- SSO via SAML/OIDC.
- RBAC (baseado em função) ou ABAC (baseado em atributo) para controle de acesso refinado.
- Tokens de curta duração (horas, não dias).
- Postura de dispositivo — só dispositivos corporativos com criptografia de disco.

### Limpeza de PII / PHI

Antes do prompt sair da sua infra:

1. Reconhecimento de entidades (spaCy NER, Presidio, comercial).
2. Mascarar entidades encontradas: `"Meu CPF é 123.456.789-00"` → `"Meu CPF é [SSN_TOKEN_A3F]"`.
3. Tokenização consistente (abordagem Mesh): mesmo valor mapeia para o mesmo placeholder para que a LLM preserve relacionamentos.
4. Mapeamento reverso opcional para resposta da LLM.

Filtros regex estáticos pegam padrões básicos; NER pega mais. Use os dois.

### Guardrails de entrada e saída

Entrada: bloqueie jailbreaks conhecidos, tópicos proibidos; rate-limit por usuário.

Saída: limpeza regex para segredos vazados (padrões de chave de API, padrões de email em contextos de recusa), classificador para violações de política.

### Whitelist de egress de rede

Serviços LLM em subnet dedicada:
- Whitelist: `api.openai.com`, `api.anthropic.com`, endpoints de banco vetorial, endpoints de vault.
- Todo o resto: descarte.
- DNS via resolução com allowlist apenas (evite exfiltração por DNS tunneling).

### Log de auditoria

Log imutável de toda chamada LLM com:
- Timestamp.
- Usuário / tenant.
- Hash do prompt (não o prompt bruto por privacidade).
- Modelo + versão.
- Contagem de tokens.
- Custo.
- Hash da resposta.
- Qualquer ativação de guardrail.

Retenção conforme exigência regulatória (SOC 2 1 ano, HIPAA 6 anos).

### O incidente da Vercel em 2026

Ataque de supply-chain: credenciais de CI/CD comprometidas exfiltraram env vars de milhares de deploys de clientes. Lição: credenciais de CI/CD são equivalentes a produção. Armazene no vault. Delimite o escopo agressivamente. Rotacione agressivamente.

### Números pra lembrar

- Política de rotação: ≤ 90 dias.
- Escaneie em todo commit: TruffleHog / GitGuardian / Gitleaks.
- Vercel 2026: credenciais de CI/CD comprometidas → milhares de env vars de clientes vazadas.
- Retenção de log de auditoria: SOC 2 = 1 ano, HIPAA = 6 anos.

## Use

`code/main.py` implementa um limpador de PII brincadeira com tokenização consistente e um log de auditoria append-only.

## Entregue

Esta aula produz `outputs/skill-llm-security-plan.md`. Dado escopo regulatório e estado atual, planeja a migração do vault, limpador, egress, log de auditoria.

## Exercícios

1. Execute `code/main.py`. Envie dois prompts referenciando o mesmo CPF. Confirme que ambos recebem o mesmo placeholder.
2. Projet a política de egress de rede para um implantação vLLM-on-EKS chamando OpenAI + Anthropic + Weaviate.
3. Você descobre uma chave no histórico do git (2 anos de idade). Qual é a resposta correta — rotacionar a chave, limpar o histórico, ou os dois? Justifique.
4. Seu log de auditoria cresce 10 GB/dia. Projet níveis de retenção (quente 30d, morno 12mo, frio 6anos).
5. Argumente se a tokenização reversa (substituir valores reais de volta na resposta da LLM) vale a complexidade versus manter placeholders visíveis.

## Termos Chave

| Termo | O que a gente diz | O que realmente significa |
|-------|-------------------|---------------------------|
| Vault | "loja de segredos" | Serviço centralizado de gestão de credenciais |
| IAM role | "autenticação baseada em identidade" | Função assumida pelo app; retorna credenciais de curta duração |
| OIDC para CI/CD | "tokens emitidos pela cloud" | Sem chaves estáticas no CI — identidade via OIDC |
| TruffleHog / GitGuardian / Gitleaks | "escaneadores de segredos" | Detecção de segredos no momento do commit |
| RBAC / ABAC | "controle de acesso" | Baseado em função vs baseado em atributo |
| Limpeza de PII | "máscara de dados" | Remover ou tokenizar entidades sensíveis |
| Tokenização consistente | "placeholders estáveis" | Mesmo valor → mesmo token toda vez |
| Abordagem Mesh | "tokenização Mesh" | Padrão de tokenização que preserva semântica |
| Whitelist de egress | "allowlist de saída" | Só domínios permitidos alcançáveis |
| Log de auditoria | "histórico imutável" | Registro append-only para conformidade |

## Leitura Complementar

- [Doppler — Advanced LLM Security](https://www.doppler.com/blog/advanced-llm-security)
- [Portkey — Manage LLM API keys with secret references](https://portkey.ai/blog/secret-references-ai-api-key-management/)
- [Datadog — LLM Guardrails Best Practices](https://www.datadoghq.com/blog/llm-guardrails-best-practices/)
- [JumpServer — Secrets Management Best Practices 2026](https://www.jumpserver.com/blog/secret-management-best-practices-2026)
- [Microsoft Presidio](https://github.com/microsoft/presidio) — PII detection and anonymization.
- [HashiCorp Vault docs](https://developer.hashicorp.com/vault/docs)
