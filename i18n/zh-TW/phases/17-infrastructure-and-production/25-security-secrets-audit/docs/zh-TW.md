# 安全工程——金鑰管理、API 金鑰輪換、稽核記錄與防護欄（Security — Secrets, API Key Rotation, Audit Logs, Guardrails）

> 透過集中化保險庫（HashiCorp Vault、AWS Secrets Manager、Azure Key Vault）徹底消滅金鑰擴散（Secret sprawl）。嚴禁將機密憑證散落在設定檔、Git 版本控制系統中的環境變數檔，或是試算表之中。全面採用動態 IAM 角色取代傳統靜態金鑰；CI/CD 使用 OIDC。AI Gateway 閘道架構是 2026 年的正式環境標準解法：微服務應用 → 智慧閘道 → 底層模型供應商，閘道在執行時期直接從 Vault 保險庫動態提取最新憑證。只需在保險庫中完成一次金鑰輪換，全線應用程式便會在數分鐘內自動無感生效——無需重新部署，更無需在 Slack 群組中焦急呼喊「誰拿到了新金鑰」。強制金鑰輪換週期不得超過 90 天；在每一次 commit 時透過 TruffleHog / GitGuardian / Gitleaks 進行強制掃描。落實零信任架構：MFA 多因素驗證、SSO 單一登入、RBAC/ABAC 細粒度授權、短時效 Token 以及終端裝置合規態勢校驗。敏感資訊脫敏（PII scrubbing）利用實體辨識技術在請求轉發前即時遮罩 PHI/PII；一致性 tokenization（Consistent tokenization，如 Mesh 方案）將敏感數值映射至穩定的佔位符，使 LLM 能保留程式碼語意與關聯語意。網路出站限制：推論服務必須長駐於專屬 VPC/VNet 子網內部，嚴格僅將 `api.openai.com`、`api.anthropic.com` 等白名單網域放行，徹底封殺一切非授權出站連線。2026 年標誌性資安事件：Vercel 供應鏈遭受攻擊，攻擊者透過被外洩的 CI/CD 憑證盜取了數千個客戶部署的環境變數。

**Type:** Learn
**Languages:** Python (stdlib, toy PII-scrubber + audit-log writer)
**Prerequisites:** Phase 17 · 19 (AI Gateways), Phase 17 · 13 (Observability)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 列出四大常見的金鑰管理反模式（版本庫包含設定檔、程式碼硬編碼環境變數、試算表共享、靜態長期金鑰），並給出標準的現代防禦架構。
- 深刻理解「AI 閘道在執行時期從保險庫動態取得憑證」為何是 2026 年正式環境的標準做法。
- 實作具備一致性 tokenization 能力的 PII 脫敏處理器（相同真實值映射至相同佔位符），確保語意關聯在脫敏後依然完好無損。
- 剖析 2026 年 Vercel 供應鏈資安大案，並汲取關於 CI/CD 憑證安全衛生的深刻教訓。

## The Problem｜問題

一名實習生將含有 API 金鑰的 `.env` 檔案 commit 進 Git。雖然他很快就刪除了檔案，但金鑰早已留在 Git 歷史中——GitGuardian 掃描發現了它，而你們的輪換流程是「在 Slack 通知團隊、更新 40 個設定檔、重新部署所有服務」。8 小時後，一半服務已上線，另一半仍在等待部署時段。

在另一個維度，使用者的輸入 Prompt 中包含了「我的社會安全碼是 123-45-6789」。這段文字被直接發送給了 OpenAI。雖然貴公司簽署了 BAA，但內部政策要求在轉送前遮罩 PII。然而你們的系統完全沒有做。

更嚴重的是，你的 EKS 叢集中的 LLM Pod 預設允許存取網際網路上的任何主機。惡意攻擊者透過向受控網域發起 DNS 查詢，悄悄將機密資料穿透外洩。網路層毫無攔截。

LLM 服務的資訊安全必須同時封死這三大致命受攻擊面：基於保險庫的動態憑證管理、出站前的敏感資料脫敏、嚴苛的網路出站白名單過濾，以及防篡改的稽核記錄。

## The Concept｜核心概念

### 集中化保險庫 + 基於 IAM 角色的即時取得（Centralized vault + IAM-role pull）

**Vault 保險庫**：HashiCorp Vault、AWS Secrets Manager、Azure Key Vault、GCP Secret Manager。建立唯一的單一真實信任源。

**IAM 角色**：應用程式或閘道透過其 IAM 身分進行驗證，而非使用靜態金鑰。Vault 會在 token 有效期間回傳 secret。

**AI 閘道模式**：AI 閘道在接收到外部請求的瞬間，在執行時期動態從 Vault 提取 `OPENAI_API_KEY`。當在保險庫中完成金鑰輪換後，下一個抵達的請求自動享用新金鑰。不需要重新部署。

### 輪換週期小於等於 90 天（Rotation policy ≤ 90 days）

所有 API 金鑰、保險庫 Root Token 與 CI/CD 憑證，強制設定 90 天以內的輪換硬約束。盡可能採用自動化無感輪換；手動輪換須記錄並追蹤。

### 原始碼金鑰掃描（Secret scanning）

- **TruffleHog**——使用正規表示式與熵值掃描 commit。
- **GitGuardian**——企業級商用方案，具備極高的準確率。
- **Gitleaks**——輕量開源，專門整合進 CI/CD 自動化阻斷管線。

每次 commit 時執行掃描。一旦偵測到新的秘密，就阻擋 PR。

### 零信任安全架構（Zero-trust posture）

- 所有帳號都必須啟用 MFA 多因素驗證。
- 全面基於 SAML / OIDC 實施企業級 SSO 單一登入。
- 採用 RBAC（基於角色）或 ABAC（基於屬性）提供細緻的權限控制。
- 簽發短時效存取憑證（時效以小時計，絕不可長達數天）。
- 裝置合規性校驗——僅允許硬碟全盤加密且受控的企業裝置接入。

### PII／PHI 脫敏（PII / PHI scrubbing）

在 Prompt 跨出內部安全邊界之前：

1. 命名實體辨識（spaCy NER、微軟 Presidio 或商業級專案）。
2. 對命中實體進行安全遮罩：`"My SSN is 123-45-6789"` → `"My SSN is [SSN_TOKEN_A3F]"`。
3. 一致性 tokenization（Consistent tokenization，Mesh 模式）：完全相同的原始數值必須精確映射至完全相同的佔位符，確保 LLM 能保留關聯語意。
4. 在模型吐出最終回應後，選擇性將真實數值反向還原回傳給使用者。

純靜態正規表示式只能攔截固定格式；NER 能捕捉更多。兩者應搭配使用。

### 輸入與輸出雙向安全防護欄（Input + output guardrails）

輸入端：主動攔截已知的 Prompt 越獄注入、過濾禁止的話題、依據使用者 ID 實施嚴格限流。

輸出端：以正規表示式掃描模型輸出，檢查是否意外洩漏內部 API Key、敏感憑證，或拒答情境中的電子郵件格式；並由輕量分類器審查是否違背合規規範。

### 網路出站白名單（Network egress whitelist）

推論服務必須嚴格部署於獨立的專屬私有子網內部：
- 白名單網域：僅放行 `api.openai.com`、`api.anthropic.com`、專屬向量資料庫端點與 Vault 保險庫 API。
- 其餘所有未授權連線：預設直接全部 Drop 丟棄。
- DNS 解析：僅允許透過企業內部受控的白名單解析器處理，以避免透過 DNS 隧道外洩資料。

### 不可篡改的稽核記錄（Audit log）

為每一次 LLM 呼叫生成具備不可篡改的結構化記錄：
- 精確時間戳記。
- 呼叫 API 的使用者與所屬租戶。
- Prompt 雜湊值（基於隱私考量，不記錄原始 Prompt）。
- 實際呼叫的模型名稱與具體版本號。
- 輸入與輸出 Token 消耗統計。
- 該次呼叫的實質財務費用。
- 模型回應的雜湊值。
- 是否觸發了任何安全防護欄警報。

依監管要求保留（SOC 2 1 年，HIPAA 6 年）。

### 2026 年 Vercel 供應鏈資安事件警示（The 2026 Vercel incident）

供應鏈攻擊：遭入侵的 CI/CD 憑證使數千個客戶部署的環境變數外洩。教訓：CI/CD 憑證應視同正式環境憑證。存放於 Vault。限制權限範圍。積極輪換。

### 務必銘記的核心數字指標（Numbers you should remember）

- 金鑰強制定時輪換週期：不得超過 90 天。
- Commit 級即時掃描工具：TruffleHog / GitGuardian / Gitleaks。
- Vercel 2026：CI/CD 憑證遭入侵，數千個客戶部署的環境變數外洩。
- 稽核記錄保留期間：SOC 2 1 年，HIPAA 6 年。

```figure
i4-vault-rotation
```

## Use It｜實際應用

`code/main.py` 實作了一套具備一致性 tokenization 能力的微型 PII 脫敏處理器，以及一個嚴格追加寫入（Append-only）的稽核記錄寫入器。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-llm-security-plan.md`。根據法規範疇與現況，該 Skill 規劃保險庫遷移、PII 脫敏、網路出站限制與稽核記錄。

## Exercises｜練習

1. 執行 `code/main.py`。連續發送兩條引用同一組 SSN 的 Prompt。確認兩者是否被精準替換為了完全相同的佔位符。
2. 為一個在 EKS 上運作、需要同時存取 OpenAI、Anthropic 與 Weaviate 向量資料庫的推論微服務，設計一套網路出站安全政策。
3. 你在 Git 歷史中發現一把兩年前的金鑰。正確的回應是什麼——輪換金鑰、清理歷史，還是兩者都做？請說明理由。
4. 企業的推論稽核記錄每日以 10 GB 的速度暴增。設計一套標準的生命週期分層階梯儲存方案（熱資料長駐 30 天、溫資料長駐 12 個月、冷資料歸檔 6 年）。
5. 深入辯論「反向 tokenization（將真實數值重新替換回模型回應中）」相較於直接向終端使用者呈現安全佔位符，其所增加的架構複雜度是否真正值得？

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|------|----------------|------------------------|
| Vault | 「機密儲存庫」 | 集中管理憑證的服務 |
| IAM role | 「以身分為基礎的驗證」 | 應用程式承擔的角色；會提供短效憑證 |
| OIDC for CI/CD | 「雲端簽發的 token」 | CI 不使用靜態金鑰，改以 OIDC 驗證身分 |
| TruffleHog / GitGuardian / Gitleaks | 「機密掃描器」 | 在 commit 時偵測機密 |
| RBAC / ABAC | 「存取控制」 | 以角色為基礎與以屬性為基礎的控制方式 |
| PII scrubbing | 「資料遮罩」 | 移除或套用 tokenization |
| Consistent tokenization | 「穩定佔位符」 | 同一個值每次都映射到相同 token |
| Mesh approach | 「Mesh tokenization」 | 保留語意的 tokenization 模式 |
| Egress whitelist | 「出站允許清單」 | 僅允許連線至核准網域 |
| Audit log | 「不可變歷史記錄」 | 僅追加寫入的合規記錄 |

## Further Reading｜延伸閱讀

- [Doppler — Advanced LLM Security](https://www.doppler.com/blog/advanced-llm-security)
- [Portkey — Manage LLM API keys with secret references](https://portkey.ai/blog/secret-references-ai-api-key-management/)
- [Datadog — LLM Guardrails Best Practices](https://www.datadoghq.com/blog/llm-guardrails-best-practices/)
- [JumpServer — Secrets Management Best Practices 2026](https://www.jumpserver.com/blog/secret-management-best-practices-2026)
- [Microsoft Presidio](https://github.com/microsoft/presidio) — PII 偵測與匿名化。
- [HashiCorp Vault docs](https://developer.hashicorp.com/vault/docs)
