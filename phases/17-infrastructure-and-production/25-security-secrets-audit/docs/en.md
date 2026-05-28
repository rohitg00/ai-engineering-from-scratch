# Security — Secrets、API Key Rotation、Audit Logs、Guardrails

> centralized vaults (HashiCorp Vault、AWS Secrets Manager、Azure Key Vault) により secret sprawl をなくします。credentials を config files、VCS 内の env files、spreadsheets に保存してはいけません。static keys より IAM roles を使い、CI/CD には OIDC を使います。AI-gateway pattern が 2026 年の解です。apps → gateway → model provider という流れで、gateway が runtime に vault から credentials を取得します。vault 内で rotate すれば、すべての apps が数分で新しい key を拾います。redeploy も Slack の「新しい key は誰が持ってる?」も不要です。Rotation policy は 90 日以下。TruffleHog / GitGuardian / Gitleaks で every commit を scan します。Zero-trust: MFA、SSO、RBAC/ABAC、short-lived tokens、device posture。PII scrubbing は entity recognition を使い、forwarding 前に PHI/PII を mask します。consistent tokenization (Mesh approach) は sensitive values を安定した placeholders に map するため、LLM は code/relationship semantics を保持できます。Network egress: LLM services は dedicated VPC/VNet subnet に置き、`api.openai.com`、`api.anthropic.com` などだけを whitelist し、他の outbound はすべて block します。2026 年の incident driver: compromised CI/CD credentials を使った Vercel supply-chain attack により、数千の customer deployments から env vars が exfiltrate されました。

**種類:** Learn
**言語:** Python (標準ライブラリ、PII-scrubber + audit-log writer のトイ実装)
**前提:** Phase 17 · 19 (AI Gateways), Phase 17 · 13 (Observability)
**時間:** 約 60 分

## 学習目標

- 4 つの secret-management anti-patterns (VCS 内 config files、hardcoded env、spreadsheets、static keys) を列挙し、それぞれの置き換え先を言えるようにする。
- AI-gateway-pulls-from-vault pattern を 2026 年の production standard として説明する。
- semantics を保つため、consistent tokenization (same value → same placeholder) を持つ PII scrubber を実装する。
- 2026 年の Vercel supply-chain incident と、それが CI/CD credential hygiene について教えたことを説明する。

## 問題

インターンが API keys 入りの `.env` を commit しました。すぐに削除しました。しかし keys は既に git history にあります。GitGuardian scan が検知します。あなたの rotation process は「team に Slack、40 個の config files を更新、全 services を redeploy」です。8 時間後、半分の services は live で、残り半分は deploy window 待ちです。

別の問題として、user prompts に「My SSN is 123-45-6789.」が含まれています。prompt は OpenAI に送られます。BAA はありますが、internal policy は forwarding 前に PII を mask することです。あなたは mask しませんでした。

さらに別の問題として、EKS cluster の LLM pod は任意の internet host に到達できます。誰かが attacker-controlled domain への DNS lookup で data を exfil します。何も block しません。

LLM services の security は、この 3 つの vectors すべてに対応しなければなりません。Vault-backed credentials。PII scrubbing。Network egress filtering。Audit logs。

## コンセプト

### Centralized vault + IAM-role pull

**Vault**: HashiCorp Vault、AWS Secrets Manager、Azure Key Vault、GCP Secret Manager。single source of truth です。

**IAM role**: app/gateway は static key ではなく IAM identity で authenticate します。Vault は token lifetime の間だけ secret を返します。

**AI-gateway pattern**: gateway は request time に vault から `OPENAI_API_KEY` を取得します。vault 内で rotate すれば、次の request は新しい key を取得します。redeploy は不要です。

### Rotation policy は 90 日以下

すべての API keys、vault root tokens、CI/CD credentials が対象です。可能なものは automated rotation。manual rotation は log し、track します。

### Secret scanning

- **TruffleHog** — regex + entropy on commits.
- **GitGuardian** — commercial、高精度。
- **Gitleaks** — OSS、CI で実行。

every commit で実行します。新しい secret が検出されたら PR を block します。

### Zero-trust posture

- すべての accounts で MFA を必須にする。
- SAML/OIDC による SSO。
- fine grained access のための RBAC (role-based) または ABAC (attribute-based)。
- short-lived tokens (days ではなく hours)。
- device posture — disk encryption ありの corp devices のみ。

### PII / PHI scrubbing

prompt が自社 infra を離れる前に:

1. Entity recognition (spaCy NER、Presidio、commercial)。
2. matched entities を mask する: `"My SSN is 123-45-6789"` → `"My SSN is [SSN_TOKEN_A3F]"`。
3. Consistent tokenization (Mesh approach): same value は same placeholder に map されるため、LLM は relationships を保持する。
4. LLM response 用の optional reverse mapping。

static regex filters は基本 pattern を捕まえ、NER はより多くを捕まえます。両方使います。

### Input + output guardrails

Input: known jailbreaks、forbidden topics を block し、per-user で rate-limit する。

Output: leaked secrets (API key patterns、refusal contexts 内の email patterns) を regex scrub し、policy violations は classifier で検出する。

### Network egress whitelist

LLM services を dedicated subnet に置きます:
- Whitelist: `api.openai.com`、`api.anthropic.com`、vector DB endpoints、vault endpoints。
- その他すべて: drop。
- DNS は allowlist-only resolver 経由 (DNS-tunneling exfil を避ける)。

### Audit log

すべての LLM call について immutable log を残します:
- Timestamp。
- User / tenant。
- Prompt hash (privacy のため raw prompt ではない)。
- Model + version。
- Token counts。
- Cost。
- Response hash。
- Any guardrail trips。

regulatory requirement に従って retain します (SOC 2 は 1 年、HIPAA は 6 年)。

### 2026 年の Vercel incident

Supply-chain attack: compromised CI/CD credentials により、数千の customer deployments から env vars が exfiltrate されました。教訓: CI/CD credentials は prod-equivalent です。vault に保存し、狭く scope し、積極的に rotate します。

### 覚えておくべき数字

- Rotation policy: 90 日以下。
- every commit で scan: TruffleHog / GitGuardian / Gitleaks。
- Vercel 2026: CI/CD creds compromised → 数千の customer env vars leaked。
- Audit log retention: SOC 2 = 1 年、HIPAA = 6 年。

## 使ってみる

`code/main.py` は consistent tokenization と append-only audit log を持つ PII scrubber のトイ実装です。

## 成果物

この lesson では `outputs/skill-llm-security-plan.md` を作ります。regulatory scope と current state を受け取り、vault migration、scrubber、egress、audit log を計画します。

## 演習

1. `code/main.py` を実行してください。同じ SSN を参照する 2 つの prompts を送ります。両方が同じ placeholder になることを確認してください。
2. OpenAI + Anthropic + Weaviate を呼び出す vLLM-on-EKS deployment の network egress policy を設計してください。
3. git history に key (2 年前) を発見しました。正しい対応は key rotation、history scrub、それとも両方ですか。正当化してください。
4. audit log が 10 GB/day で増えています。retention tiers (hot 30d、warm 12mo、cold 6yr) を設計してください。
5. reverse-tokenization (LLM response に real values を戻す) が、placeholders を見えるままにする場合と比べて複雑さに見合うかを論じてください。

## 重要語句

| 用語 | よくある言い方 | 実際の意味 |
|------|----------------|------------------------|
| Vault | 「secrets store」 | centralized credential management service |
| IAM role | 「identity-based auth」 | app が assume する role。short-lived creds を返す |
| OIDC for CI/CD | 「cloud-issued tokens」 | CI に static keys を置かず、OIDC で identity を使う |
| TruffleHog / GitGuardian / Gitleaks | 「secret scanners」 | commit-time secret detection |
| RBAC / ABAC | 「access control」 | role-based と attribute-based |
| PII scrubbing | 「data masking」 | sensitive entities を remove または tokenize する |
| Consistent tokenization | 「stable placeholders」 | 同じ value → 毎回同じ token |
| Mesh approach | 「Mesh tokenization」 | semantics-preserving tokenization pattern |
| Egress whitelist | 「outbound allowlist」 | 許可された domains だけ到達可能 |
| Audit log | 「immutable history」 | compliance 用の append-only record |

## 参考資料

- [Doppler — Advanced LLM Security](https://www.doppler.com/blog/advanced-llm-security)
- [Portkey — Manage LLM API keys with secret references](https://portkey.ai/blog/secret-references-ai-api-key-management/)
- [Datadog — LLM Guardrails Best Practices](https://www.datadoghq.com/blog/llm-guardrails-best-practices/)
- [JumpServer — Secrets Management Best Practices 2026](https://www.jumpserver.com/blog/secret-management-best-practices-2026)
- [Microsoft Presidio](https://github.com/microsoft/presidio) — PII detection and anonymization.
- [HashiCorp Vault docs](https://developer.hashicorp.com/vault/docs)
