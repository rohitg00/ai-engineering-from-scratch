# Güvenlik  Gizlilik, API Anahtar Dönüşüm, Denetim Günlükleri, Gardails

> Merkezi kasayı (HashiCorp Vault, AWS Gizemleri Yöneticisi, Azure Anahtar Kasası) kullanarak gizli yayılma ortadan kaldırın. İtirafları asla konfigüratör dosyalarda, VCS'deki env dosyalarında, kalıp sayfalarında saklama. Statik anahtarlar yerine IAM rollerini kullanın; CI/CD için OIDC. AI-gateway örneği 2026 çözümüdür: uygulama → gateway → model sağlayıcısı, gateway çalıştırma zamanında kasadan kredi bilgileri çekmektedir. Altınlıkta dön ve tüm uygulamalar dakika içinde yüklenir. Rotasyon politikası ≤90 gün; her commit'de TruffleHog / GitGuardian / Gitleaks ile tarama. ZERO-trust: MFA, SSO, RBAC/ABAC, kısa ömürlü tokenler, cihaz duruşu. PII temizleme, PHI/PII'yi göndermeden önce gizlemek için kuruluş tanınmasını kullanır; tutarlı işaretleme (Mesh yaklaşımı) sabit yer sahiplerine hassas değerleri haritası yapar, böylece LLM kod/ ilişki semantiğini korur. Ağ çıkışı: Sadece özel VPC/VNet alt ağlarında LLM hizmetleri`api.openai.com`- Evet .`api.anthropic.com`2026 olay sürücüsü: Vercel tedarik zinciri saldırısı, tehlikeye atılan CI/CD kimlikleri ile binlerce müşteri dağıtımında çevreyi sızdırdı.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy PII-scrubber + audit-log writer)
**Prerequisites:** Phase 17 · 19 (AI Gateways), Phase 17 · 13 (Observability)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- Gizli yönetim için kullanılan dört anti-önemlemeyi (VCS'deki yapılandırma dosyaları, sert kodlanmış env, kalıp sayfaları, statik anahtarlar) listeleyin ve onların yerine geçirilmesini belirleyin.
- AI-gateway-pull-from-vault modelini 2026 üretim standardı olarak açıklayın.
- Semantik hayatta kalmak için tutarlı bir tokenizasyonla (eşit değer → aynı yer tutma) bir PII scrubber uygulamak.
- Vercel 2026 tedarik zinciri olayını ve CI/CD sertifika hijyenine dair neyi öğrettiğini söyleyin.

## Sorun

Bir stajyer yaptırıyor.`.env`API anahtarları ile. Hemen silinir. Anahtarlar git tarihinde zaten  GitGuardian taraması yakalar, dönüşüm süreci "Timi yavaşlat, 40 yapılandırma dosyasını güncelle, tüm hizmetleri yeniden dağıt". 8 saat sonra, hizmetlerin yarısı canlı ve yarısı pencereleri dağıtmayı bekliyor.

Bu nedenle, bu uygulamaların kullanıcısı tarafından gönderilen bilgiler için, bu uygulamaların kullanıcısı tarafından gönderilen bilgiler için kullanılabilir.

Ayrı bir şekilde, EKS klüsterinizin LLM kapsülü herhangi bir internet barındırmacıya ulaşabilir.

LLM hizmetleri için güvenlik üç vektörü de ele almak ve sonra kanıtlamak zorundadır.

## Anlaşım

### Merkezi kas + IAM rol çekimi

**Vault**HashiCorp Vault, AWS Gizemleri Yöneticisi, Azure Anahtar Vault, GCP Gizemli Yöneticisi.

**IAM role**: app/gateway, statik bir anahtar değil, IAM kimliği ile doğruluğu doğruluyor. Vault, token'ın ömür boyu sırrı iade eder.

**The AI-gateway pattern**: geçit çekimleri `OPENAI_API_KEY`Arama vakti için kasadan. Kasada döndürün, bir sonraki aramak yeni anahtar alır.

### Dönüş politikası ≤ 90 gün

Tüm API anahtarları, kasanın kök belirtileri, CI/CD kimlikleri, mümkünse otomatik dönüşüm, elle dönüşüm kaydedildi ve izlendi.

### Gizli tarama

- **TruffleHog** Komitlerde regex + entropi.
- **GitGuardian** Ticari, yüksek doğruluk.
- **Gitleaks**- OSS, CI'de çalışıyor.

Her seferinde çalış, yeni bir sır keşfedildiğinde PR'yi engelle.

### Zira güvenli duruş

- Tüm hesaplarda MFA gereklidir.
- SSO'nun SAML/OIDC üzerinden gönderilmesi.
- RBAC (rol tabanlı) veya ABAC (attribut tabanlı) ince tanelerle erişmek için.
- Kısa ömürlü tokenler (saatler, günler değil).
- Cihaz duruşu  Sadece disk şifreleme ile corp cihazları.

### PII / PHI temizleme

İndirme mesajı alt kısmını terk etmeden önce:

1. Birim tanınması (spaCy NER, Presidio, ticari).
2. Maske eşleşen varlıklar: `"My SSN is 123-45-6789"`→ `"My SSN is [SSN_TOKEN_A3F]"`- Evet .
3. Düzgün bir işaretleme (Mesh yaklaşımı): aynı değerleri aynı yer sahibi için haritanlar böylece LLM ilişkileri korur.
4. LLM tepkisi için seçeneği geri haritası.

Statik regex filtreleri temel desenleri yakalar, NER daha fazla yakalar.

### Giriş + çıkış koruma rayları

Giriş: Bilinen jailbreaks'i engelle, yasak konuları; kullanıcı başına ücret sınırları.

Çıktı: sızmış sırlar için regex scrub (API anahtar kalıpları, reddedilme bağlamlarında e-posta kalıpları), politika ihlalleri için sınıflandırıcı.

### Ağ çıkış beyaz listesi

Özel bir alt ağta LLM hizmetleri:
- Beyaz listesi:`api.openai.com`- Evet .`api.anthropic.com`, vektör DB son noktaları, kasanın son noktaları.
- Diğer her şey: bırak.
- DNS'in sadece izin listesi çözücü aracılığıyla (DNS tünel çıkışından kaçının).

### Denetim günlüğü

Her LLM görüşmesinin değişmez kayıtları:
- Zaman damgası.
- Kullanıcı / kiracı.
- Hızlı haş (özellikle özel olmak için ham hızlı değil).
- Model + versiyon.
- İşaret sayılır.
- - Maliyet.
- Cevap hash.
- Herhangi bir koruma yolculuğu.

Yönetim gerekliliklerine göre tutma (SOC 2 1 yıl, HIPAA 6 yıl).

### 2026 Vercel olayı

Tedarik zinciri saldırısı: Tehlikeli CI/CD kimlikleri binlerce müşteri dağıtımında çevreyi sızdırıyor. Ders: CI/CD kimlikleri prod-e eşittir. Kasada saklayın. Sınır dar. Ateşli bir şekilde döndürün.

### Hatırlamalısın numaralar

- Dönüş politikası: ≤ 90 gün.
- Her commit'i tarayın: TruffleHog / GitGuardian / Gitleaks.
- Vercel 2026: CI/CD kredileri bozulmuş → Binlerce müşteri çevresi sızmış.
- Denetim günlüğü tutuluşu: SOC 2 = 1 yıl, HIPAA = 6 yıl.

```figure
i4-vault-rotation
```

## Kullan

`code/main.py`tutarlı bir tokenleşme ile oyuncak PII temizleyicisi ve yalnızca ekleme denetim günlüğü uygulanır.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-llm-security-plan.md`Yönetim kapsamı ve mevcut durum göz önüne alındığında, kasayı göç, temizleme, çıkış, denetim kayıtlarını planlıyor.

## Egzersizler

1. Çık .`code/main.py`Aynı SSN'ye referans eden iki mesaj gönderin.
2. OpenAI + Anthropic + Weaviate olarak adlandırılan vLLM-on-EKS dağıtımı için ağ çıkış politikasını tasarlayın.
3. Git tarihinde bir anahtar bulursanız doğru cevap nedir? anahtarı döndürün, tarih silin, ya da her ikisi de?
4. Denetim kayıtlarınız günde 10 GB büyüyor.
5. Geri dönüştürülmüş tokenizasyonun (gerçek değerlerin yeniden LLM tepkisine değiştirilmesi) yer tutanları görünür tutmakla karşılaştırıldığında karmaşıklığa değer olup olmadığını tartışın.

## Anahtar Terimler

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

## Daha Fazla Okumak

- [Doppler — Advanced LLM Security](https://www.doppler.com/blog/advanced-llm-security)
- [Portkey — Manage LLM API keys with secret references](https://portkey.ai/blog/secret-references-ai-api-key-management/)
- [Datadog — LLM Guardrails Best Practices](https://www.datadoghq.com/blog/llm-guardrails-best-practices/)
- [JumpServer — Secrets Management Best Practices 2026](https://www.jumpserver.com/blog/secret-management-best-practices-2026)
- [Microsoft Presidio](https://github.com/microsoft/presidio) PII tespit ve anonimleştirme.
- [HashiCorp Vault docs](https://developer.hashicorp.com/vault/docs)
