# Bitirme Taşı 06 — Kubernetes için DevOps Sorun Giderme Agent

> AWS'nin DevOps Agent GA'ya geçti, Resolve AI, K8'lerin taktik kitaplarını yayınladı, NeuBird anlamsal izleme demosu yaptı ve Metoro, AI SRE'yi hizmet başına SLO'lara bağladı. Üretim şekli belirlendi: bir uyarı web kancası tetikleniyor, bir agent telemetriyi okuyor, K8 nesnelerinin grafiğini yürütüyor, temel neden hipotezlerini sıralıyor ve onay düğmelerini içeren bir Slack özeti yayınlıyor. Varsayılan olarak salt okunurdur. Her iyileştirme bir insan tarafından kontrol edilir. Bu sonuç, 20 sentetik olay üzerinde değerlendirilen ve paylaşılan üç vakada AWS'nin Agent ile karşılaştırılan agent'dır.

**Tür:** Kapak taşı
**Diller:** Python (agent), TypeScript (Slack entegrasyonu)
**Önkoşullar:** Aşama 11 (LLM mühendisliği), Aşama 13 (araçlar ve MCP), Aşama 14 (agents), Aşama 15 (otonom), Aşama 17 (altyapı), Aşama 18 (güvenlik)
**Uygulanan aşamalar:** P11 · P13 · P14 · P15 · P17 · P18
**Süre:** 30 saat

## Sorun

2025-2026 SRE anlatısı şu şekildeydi: "Yapay zekanın agentolayları önceliklendirmesi, insanların iyileştirmeleri onaylaması." AWS DevOps Agent, Resolve AI, NeuBird, Metoro, PagerDuty AIOps'un tümü üretimde bu şekli sunuyor. agent, Prometheus metriklerini, Loki günlüklerini, Tempo izlerini, kube durumu metriklerini ve K8s nesnelerinin bilgi grafiğini okur. Beş dakikadan kısa bir sürede telemetri alıntılarıyla sıralanmış bir kök neden hipotezi üretir. Slack aracılığıyla açık bir insan onayı olmadan asla yıkıcı komutları yürütmez.

Zor işin çoğu, muhakeme değil, kapsam belirleme ve güvenliktir. agent, varsayılan olarak salt okunur bir RBAC yüzeyine, güçlendirilmiş bir MCP araç sunucusuna ve dikkate alınan ve yürütülen her komutun denetim günlüklerine ihtiyaç duyar. Kendi derinliğinin dışına çıkıp yükseldiğini bilmesi gerekiyor. Ve OOM-öldürme basamaklarının 5 bin dolarlık agent dolarlık bir fatura oluşturmayacağı kadar ucuz çalışması gerekiyor.

## Konsept

agent bir bilgi grafiği üzerinde çalışır. Düğümler, K8 nesneleri (Pod'lar, Deployment'lar, Hizmetler, Düğümler, HPA'lar, PVC'ler) artı telemetri kaynaklarıdır (Prometheus serisi, Loki akışları, Tempo izleri). Kenarlar, sahipliği (Pod -> ReplicaSet -> Deployment), planlamayı (Pod -> Düğüm) ve gözlemi (Pod -> Prometheus serisi) kodlar. Grafik, kube durumu ölçümleri senkronizasyonu ile güncel tutulur ve her uyarıda yeniden örneklenir.

Bir uyarı tetiklendiğinde, agent etkilenen nesnenin kök nedenlerini oluşturur. Kenarlarda yürür, ilgili telemetri dilimlerini çeker (son 15 dakika) ve bir hipotez taslağı hazırlar. Hipotez kanıtlara göre sıralanır: kaç tane telemetri alıntısı onu destekliyor, ne kadar yeni, ne kadar spesifik. İlk 3 hipotez, grafik yolu görselleştirmeleri ve iyileştirme eylemleri için onay düğmeleriyle Slack'e gidiyor.

İyileştirme kapılıdır. İzin verilen varsayılan eylemler salt okunurdur. Yıkıcı eylemler (ölçek küçültme, geri alma, Pod'ları silme) Slack onayı gerektirir; ArgoCD geri alma kancaları, agent'ın hiçbir zaman sahip olmadığı bir kimlik doğrulaması token gerektirir. Denetim günlüğü, agent'ın *dikkate aldığı* her komutu (yalnızca yürütülen değil) kaydeder, böylece inceleme süreci ramak kala durumları yakalar.

## Mimarlık

```
PagerDuty / Alertmanager webhook
           |
           v
     FastAPI receiver
           |
           v
   LangGraph root-cause agent
           |
           +---- read-only MCP tools ----+
           |                             |
           v                             v
   K8s knowledge graph              telemetry slices
     (Neo4j / kuzu)              Prometheus, Loki, Tempo
   ownership + scheduling          last 15m, scoped
           |
           v
   hypothesis ranking (evidence weight)
           |
           v
   Slack brief + approval buttons
           |
           v (approved)
   ArgoCD rollback hook / PagerDuty escalate
           |
           v
   audit log: considered vs executed, every command
```

## Yığın

- Observability kaynak: Prometheus, Loki, Tempo, kube-state-metrics
- Bilgi grafiği: K8s nesnelerinin Neo4j (yönetilen) veya kuzu (gömülü) + telemetri kenarları
- Agent: Araç başına izin verilenler listesine sahip LangGraph, varsayılan olarak salt okunur
- Araç aktarımı: StreamableHTTP üzerinden FastMCP; Onay kapısının arkasındaki yıkıcı araçlar için ayrı sunucu
- Modeller: Temel neden muhakemesi için Claude Sonnet 4.7, günlük özetleme için Gemini 2.5 Flash
- Düzeltme: ArgoCD geri alma web kancası, PagerDuty yükseltme, Slack onay kartı
- Denetim: yalnızca eklemeli yapılandırılmış günlük (dikkate alındı, yürütüldü, onaylandı, sonuç)
- Deployment: Kendi dar RBAC rolüne sahip K8'ler deployment; ayrı ad alanı

## Build It — Kendin Geliştir

1. **Grafik alımı.** Kube durumu ölçümlerini her 30 saniyede bir Neo4j/kuzu ile senkronize edin. Düğümler: Pod, Deployment, Düğüm, Hizmet, PVC, HPA. Kenarlar: OWNED_BY, SCHEDULED_ON, EXPOSES, MOUNTS, SCALES. Telemetri yer paylaşımı kenarları: OBSERVED_BY (bir Pod, Prometheus serisi tarafından gözlemlenir).

2. **Uyarı alıcısı.** PagerDuty veya Alertmanager web kancalarını kabul eden FastAPI uç noktası. Etkilenen nesneleri ve SLO ihlalini çıkarın.

3. **Salt okunur araç yüzeyi.** Kubectl, Prometheus query, Loki logql, Tempo traceql'i FastMCP aracılığıyla sarın. Her aracın dar bir RBAC fiili vardır ("al", "listele", "tanımla"). Varsayılan sunucuda "sil", "yürüt", "ölçek" yok.

4. **Kök neden agent.** Üç düğümlü LangGraph: `sample` son 15 dakikalık telemetri dilimini çeker, `walk` grafiği komşu nesneler için sorgular, `hypothesize` telemetri alıntılarıyla kök neden adaylarını sıralar.

5. **Kanıt puanlaması.** Her hipotezin bir puanı = güncellik * özgüllük * grafik yolu uzunluğunun tersi * alıntı sayısı vardır. İlk 3'e dön.

6. **Gevşek özet.** Hipotezi, grafik yolu görselleştirmesini (sunucu tarafında oluşturulan bir alt grafik görüntüsü) ve en fazla bir düzeltme eylemi için onay düğmelerini içeren bir ek yayınlayın.

7. **İyileştirme kapısı.** Yıkıcı araçlar (ölçek küçültme, geri alma, silme), token onayının ardından ikinci bir MCP sunucusunda yayınlanır. agent onları ancak Slack kartı bir insan tarafından onaylandıktan sonra arayabilir.

8. **Denetim günlüğü.** Yalnızca ekleme JSONL: her aday komut için, dikkate alınıp alınmadığını, yürütülüp yürütülmediğini ve onu kimin onayladığını günlüğe kaydedin. Her gün S3'e gönderin.

9. **Sentetik olay paketi.** 20 senaryo oluşturun: OOMKill kademesi, DNS flap'ı, HPA thrash, PVC dolgusu, gürültülü komşu, hatalı sepet, hatalı ConfigMap sunumu, sertifika rotasyonu, görüntü geri çekme, vb. Temel neden doğruluğu ve hipoteze kadar geçen süre açısından agent puanını alın.

## Use It — Hazır Araçla Uygula

```
webhook: alert.pagerduty.com -> checkout-api SLO breach, error rate 14%
[graph]   affected: Deployment checkout-api (3 Pods, Node ip-10-2-3-4)
[walk]    neighbors: ReplicaSet checkout-api-abc, Service checkout-api,
           recent rollout 14m ago
[sample]  prometheus error_rate 14%, up-trend; loki 500s on /api/v2/pay
[hypo]    #1 bad rollout: latest image checkout-api:v2.41 fails /healthz
          citations: deploy.yaml (rev 42), prometheus errorRate, loki 500 stack
[slack]   [ROLL BACK to v2.40]  [ESCALATE]  [IGNORE]
          (approval required; agent does not roll back unilaterally)
```

## Ship It — Kullanıma Sun

`outputs/skill-devops-agent.md` teslim edilebilirdir. Bir K8s kümesi ve uyarı kaynağı verildiğinde, agent sıralanmış kök neden hipotezleri ve Slack kapılı bir iyileştirme akışı üretir.

| Ağırlık | Kriter | Nasıl ölçülür |
|:-:|---|---|
| 25 | Senaryo paketinde RCA doğruluğu | 20 sentetik olayda ≥%80 doğru temel neden |
| 20 | Güvenlik | Yıkıcı eylem koruması, denetim günlüğünde Slack onayı olmadan asla harekete geçmez |
| 20 | Hipotez zamanı | p50 uyarıdan Slack özetine kadar 5 dakikadan az |
| 20 | Açıklanabilirlik | Her hipotezin grafik yolları ve telemetri alıntıları vardır |
| 15 | Entegrasyonun bütünlüğü | PagerDuty, Slack, ArgoCD, Prometheus uçtan uca çalışma |
| **100** | | |

## Egzersizler

1. agent cihazınızı, AWS'nin DevOps Agent demosunun yapıldığı aynı üç olay üzerinde çalıştırın. Yan yana yayınlayın. agent'ın nerede ayrıştığını bildirin.

2. agent *düşündüğü* onay olmadan yıkıcı olabilecek herhangi bir komutu işaretleyen bir "neredeyse ıskalama" denetimi ekleyin. Bir hafta boyunca ramak kala oranını ölçün.

3. Hipotez modelini Claude Sonnet 4.7'den kendi kendine barındırılan Lama 3.3 70B'ye değiştirin. RCA doğruluk deltasını ve olay başına doları ölçün.

4. Nedensel bir filtre oluşturun: ilişkili telemetri artışlarını gerçek temel nedenden ayırın. 20 senaryo etiketi üzerinde küçük bir sınıflandırıcıyı eğitin.

5. Geri alma provası ekleyin: Aynı bildirime sahip bir hazırlama kümesine karşı ArgoCD geri alma. Slack onay düğmesinden önce canlı bir kümedeki geri alma planını doğrulayın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| K8'in bilgi grafiği | "Küme grafiği" | Düğümler = K8 nesneleri + telemetri serisi; kenarlar = sahiplik, planlama, gözlem |
| Varsayılan olarak salt okunur | "Kapsamlı RBAC" | Agent'nin hizmet hesabında yalnızca al/listele/tanımla fiilleri var; yıkıcı fiiller onayın arkasında ayrı bir sunucuda yaşar |
| Denetim günlüğü | "Değerlendirildi ve uygulandı" | Her aday komutun yalnızca ekleme kaydı, çalıştırılıp çalıştırılmadığı, kimin onayladığı |
| Hipotez sıralaması | "Kanıt puanı" | Yenilik × özgüllük × grafik yolu uzunluğunun tersi × alıntı sayısı |
| Gevşek onay kartı | "HITL kapısı" | Düzeltme düğmeleriyle etkileşimli Slack mesajı; agent bir insan tıklayana kadar ilerleyemez |
| Telemetri alıntısı | "Kanıt işaretçisi" | Bir talebi destekleyen Prometheus sorgusu, Loki seçici veya Tempo izleme URL'si |
| MTTR | "Çözüm zamanı" | Yangın alarmından SLO kurtarmaya kadar duvar saati |

## Daha Fazla Okuma

- [AWS DevOps Agent GA](https://aws.amazon.com/blogs/aws/aws-devops-agent-helps-you-accelerate-incident-response-and-improve-system-reliability-preview/) — standart 2026 referansı
- [AI K8 sorunlarını giderin](https://resolve.ai/blog/kubernetes-troubleshooting-in-resolve-ai) — rakip referansı
- [NeuBird anlamsal izleme](https://www.neubird.ai) — anlamsal grafik yaklaşımı
- [Metoro AI SRE](https://metoro.io) — SLO-ilk üretim çerçeveleme
- [kube-state-metrics](https://github.com/kubernetes/kube-state-metrics) — küme durumu kaynağı
- [LangGraph](https://langchain-ai.github.io/langgraph/) — agent orkestratöre referans ver
- [FastMCP](https://github.com/jlowin/fastmcp) — Python MCP sunucusu framework
- [ArgoCD geri alma](https://argo-cd.readthedocs.io/en/stable/user-guide/commands/argocd_app_rollback/) — geçitli iyileştirme hedefi
