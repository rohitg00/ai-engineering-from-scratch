# Segurança  Segredos, rotação de chaves API, registros de auditoria, guardrails

> Eliminar a expansão secreta através de cofres centralizadas (HashiCorp Vault, AWS Secrets Manager, Azure Key Vault). Nunca armazenem credenciais em arquivos de configuração, arquivos env em VCS, planilhas. Usar roles IAM em vez de chaves estáticas; OIDC para CI/CD. O padrão de gateway da IA é a solução 2026: aplicativos → gateway → provedor de modelo, com gateway tirando credenciais do cofre no tempo de execução. Rote em cofre e todos os aplicativos captam em minutos. Sem redistribuições, sem mensagens do Slack "quem tem a nova chave". Política de rotação ≤ 90 dias; escaneamento com TruffleHog / GitGuardian / Gitleaks em cada compromisso. Capacidade de segurança zero: MFA, SSO, RBAC/ABAC, tokens de curta duração, postura do dispositivo. A limpeza de PII utiliza o reconhecimento de entidades para mascarar o PHI/PII antes da encaminhamento; a tokenização consistente (abordagem Mesh) mapeia valores sensíveis para titulares de posições estáveis, de modo que o MLL preserva a semântica de código/relação. A saída da rede: serviços de LLM em sub-rede VPC/VNet dedicada apenas em lista branca `api.openai.com`- Não .`api.anthropic.com`O motor de incidente de 2026: ataque da cadeia de suprimentos Vercel através de credenciais de CI/CD comprometidas, filtrado em milhares de implantações de clientes.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy PII-scrubber + audit-log writer)
**Prerequisites:** Phase 17 · 19 (AI Gateways), Phase 17 · 13 (Observability)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Enumere os quatro padrões anti-gestão secreta (arquivos de configuração em VCS, env codificado com código rígido, planilhas, chaves estáticas) e nomeie os seus substitutores.
- Explicar o padrão de AI-gateway-puls-out-vault como padrão de produção de 2026.
- Implementar um esfregador de PII com tokenização consistente (o mesmo valor → mesmo reservatório) para que a semântica sobreviva.
- Cite o incidente da cadeia de suprimentos da Vercel de 2026 e o que ele ensinou sobre a higiene de credenciais CI/CD.

## O problema

Um estagiário comete `.env`As chaves já estão no histórico de git  GitGuardian scan capta-o, o seu processo de rotação é "Relax a equipe, atualizar 40 arquivos de configuração, redistribuir todos os serviços". 8 horas depois, metade dos seus serviços estão em funcionamento e metade estão esperando para a implantação de janelas.

Separadamente, as instruções do usuário incluem "Meu SSN é 123-45-6789." A instrução vai para OpenAI. Você tem um BAA, mas sua política interna é mascarar PII antes de reenviar.

Separadamente, o módulo de LLM do seu cluster EKS pode chegar a qualquer hospedeiro de Internet. Alguém exfila dados através da busca DNS para um domínio controlado pelo atacante. Nada o bloqueou.

A segurança dos serviços LLM tem que abordar os três vetores e prová-lo depois. Credenciais com segurança de cofre.

## O conceito

### Segurança de segurança

**Vault**HashiCorp Vault, AWS Secrets Manager, Azure Key Vault, GCP Secret Manager. Uma fonte de verdade.

**IAM role**O aplicativo/gateway autentica através da sua identidade IAM, não de uma chave estática.

**The AI-gateway pattern**: gateway pulls `OPENAI_API_KEY`A próxima solicitação recebe a nova chave.

### Política de rotação ≤ 90 dias

Todas as chaves API, token de raiz do cofre, credenciais CI/CD, rotação automática quando possível, rotação manual registrada e rastreada.

### Escanagem secreta

- **TruffleHog** regex + entropia em commits.
- **GitGuardian** comercial, alta precisão.
- **Gitleaks**OSS, em CI.

Corra em cada compromisso, bloqueia as relações públicas se descobrirem um novo segredo.

### Posição de confiança zero

- A MFA é exigida em todas as contas.
- OSS através do SAML/OIDC.
- RBAC (baseado em funções) ou ABAC (baseado em atributos) para acesso a grãos finos.
- Tokens de curta duração (horas, não dias).
- Posição do dispositivo  apenas dispositivos corporativos com criptografia de disco.

### Esfriamento PII/PHI

Antes que o aviso deixe a sua infra:

1. Reconhecimento da entidade (spaCy NER, Presidio, comercial).
2. Mascaras de equiparamento: `"My SSN is 123-45-6789"`→ `"My SSN is [SSN_TOKEN_A3F]"`- Não .
3. Tokenization consistente (approche Mesh): mapas de valores iguais para o mesmo titular de lugar para que o MLL preserve as relações.
4. Mapeamento opcional para resposta ao Mestrado em Direito Jurídico.

Os filtros estáticos regex capturam padrões básicos, o NER capturam mais.

### Proteção de entrada + saída

Entrada: bloquear os jailbreaks conhecidos, tópicos proibidos; limite de taxa por usuário.

Resultado: scrub regex para segredos vazados (patrões de chave API, padrões de e-mail em contextos de recusa), classificador para violações de políticas.

### Lista branca de saída da rede

Serviços de MLL numa subrede dedicada:
- Lista branca: `api.openai.com`- Não .`api.anthropic.com`, pontos finais do vector DB, pontos finais do cofre.
- Tudo o resto: lança.
- DNS via resolvedor de apenas alistado (evitar exfil de túnel DNS).

### Registo de auditoria

Registo imutável de cada chamada de LLM com:
- - O tempo.
- Utilizador/arrendador.
- Hash de imediato (não de imediato para privacidade).
- Modelo + versão.
- Os tokens contam.
- - O custo.
- Resposta hash.
- Qualquer viagem de guarda.

Reter por exigência regulatória (SOC 2 1 ano, HIPAA 6 anos).

### O incidente de Vercel de 2026

Ataque de cadeia de suprimentos: credenciais de CI/CD comprometidas filtradas em milhares de implantações de clientes. Lição: credenciais de CI/CD são equivalentes a prod. Armazenar em cofre. Capacidade estreita. Rotar agressivamente.

### Números que você deve lembrar

- Política de rotação: ≤ 90 dias.
- Escanar em cada compromisso: TruffleHog / GitGuardian / Gitleaks.
- Vercel 2026: Créditos de CI/CD comprometidos → milhares de clientes em contacto com a empresa foram vazados.
- Retenção do registro de auditoria: SOC 2 = 1 ano, HIPAA = 6 anos.

```figure
i4-vault-rotation
```

## Usá-lo

`code/main.py`Implementa um esfregador de PII de brinquedo com tokenização consistente e um registro de auditoria apenas apêndice.

## Envia-o

Esta lição produz`outputs/skill-llm-security-plan.md`Considerando o âmbito regulamentar e o estado atual, planeja a migração do cofre, a limpeza, a saída, o registro de auditoria.

## Exercícios

1. Corra .`code/main.py`Envie duas mensagens com a mesma identidade de nome e confirme que ambos têm o mesmo nome.
2. Desenhar a política de saída de rede para uma implantação vLLM-on-EKS chamando OpenAI + Anthropic + Weaviate.
3. Você descobre uma chave no histórico de git (2 anos). Qual é a resposta correta  rodar a chave, esfregar o histórico, ou ambos?
4. O seu registro de auditoria cresce 10 GB/dia. Níveis de retenção de design (caldo 30 dias, quente 12 meses, frio 6 anos).
5. Argumentar se a tokenização inversa (substituindo os valores reais de volta para a resposta de LLM) vale a pena a complexidade versus manter os titulares de lugar visíveis.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Vault | "secrets store" | Centralized credential management service |
| IAM role | "identity-based auth" | Role assumed by app; returns short-lived creds |
| OIDC for CI/CD | "cloud-issued tokens" | No static keys in CI — identity via OIDC |
| TruffleHog / GitGuardian / Gitleaks | "secret scanners" | Commit-time secret detection |
| RBAC / ABAC | "access control" | Role-based vs attribute-based |
| PII scrubbing | "data masking" | Remove or tokenize sensitive entities |
| Consistent tokenization | "stable placeholders" | Same value → same token each time |
| Mesh approach | "Mesh tokenization" | Semantic-preserving tokenization pattern |
| Egress whitelist | "outbound allowlist" | Only permitted domains reachable |
| Audit log | "immutable history" | Append-only record for compliance |

## Mais leitura

- [Doppler — Advanced LLM Security](https://www.doppler.com/blog/advanced-llm-security)
- [Portkey — Manage LLM API keys with secret references](https://portkey.ai/blog/secret-references-ai-api-key-management/)
- [Datadog — LLM Guardrails Best Practices](https://www.datadoghq.com/blog/llm-guardrails-best-practices/)
- [JumpServer — Secrets Management Best Practices 2026](https://www.jumpserver.com/blog/secret-management-best-practices-2026)
- [Microsoft Presidio](https://github.com/microsoft/presidio) Detecção e anonimização de PII.
- [HashiCorp Vault docs](https://developer.hashicorp.com/vault/docs)
