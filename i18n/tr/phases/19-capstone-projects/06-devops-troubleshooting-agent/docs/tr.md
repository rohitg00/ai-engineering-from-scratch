# Capstone 06  DevOps Çözüm Sorunları Çözme Ajanı Kubernetes

> AWS'ın DevOps Ajanı GA'ya gitti, Resolve AI K8s oyun kitaplarını yayınladı, NeuBird semantik izlemeyi gösterdi ve Metoro AI SRE'yi hizmet başına SLO'lara bağladı. Üretim şekli belirlenmiştir: bir uyarı webhook ateşler, bir ajan telemetri okuyor, K8s nesnelerinin bir grafik yürüyor, kök neden hipotezleri sıralar ve onay düğmeleri ile Slack kısa yayınlar. Öntanımlı olarak sadece okunur. Bir insan tarafından kapatılan her tedavi. Bu temel taş, 20 sentetik olayda değerlendirilmiş ve AWS'in Agent'ine karşı üç ortak vakalarda karşılaştırılmış olan bu ajan.

**Type:** Capstone
**Languages:** Python (agent), TypeScript (Slack integration, agent scaffold)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools and MCP), Phase 14 (agents), Phase 15 (autonomous), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:**P11 · P13 · P14 · P15 · P17 · P18
**Time:** 30 hours

## Sorun

2025-2026 SRE anlatısı: "AI ajanları olayları seçiyor, insanlar düzeltmeleri onaylıyor". AWS DevOps Agent, Resolve AI, NeuBird, Metoro, PagerDuty AIOps hepsi bu şekli üretime gönderir. Ajan Prometheus metriklerini, Loki kayıtlarını, Tempo izlerini, kube-devlet metriklerini ve K8'lerin bilgi grafiklerini okuyor. Telemetri sitasyonlarıyla beş dakikadan az bir sürede sıralamalı bir kök neden hipotezi üretir. Slack aracılığıyla açıkça insan onayı olmadan asla yıkıcı komutlar yürütmez.

İşin büyük kısmı, akıl yürütmek değil, güvenlik ve güvenliktir. Ajanın sadece okuma-öntemli RBAC yüzeyine, sert bir MCP araç sunucusu ve işlenmiş veya işlenmiş her komutun denetim günlüğüne ihtiyacı vardır. Ne zaman derinliklerinin dışında olduğunu ve yükselenini bilmesi gerekir.

## Anlam

Ajan bir bilgi grafi üzerinde çalışır. K8'ler nesneler (Pod, Deployments, Services, Nodes, HPAs, PVCs) ve telemetry kaynakları (Prometheus serisi, Loki akışları, Tempo izleri). Kenarları mülkiyet kodlama (Pod -> ReplicaSet -> Deployment), planlama (Pod -> Node), ve gözlem (Pod -> Prometheus serisi). Grafi bir kube-devlet-metrik sinkronize ve her uyarıda yeniden örneklenir.

Bir uyarı ateşlendiğinde, ajan etkilenen nesnenin köküne neden olur. Kenarları yürür, ilgili telemetri parçalarını çekir (son 15 dakika) ve bir hipotez çizer. Hipotez kanıtlara göre sıralanır: kaç telemetri sitasyonu destekler, ne kadar yakın, ne kadar spesifik.

Düzeltme kapalıdır. İzin verilen varsayılan eylemler sadece okunabilir. Yıkıcı eylemler (skalalama, geri yuvarlanma, Podları silme) Slack onayını gerektirir; ArgoCD yuvarlanma kancaları ajanın asla tutmadığı bir auth token gerektirir. Denetim günlükleri ajanın * değerlendirdiği*  sadece uygulanan  değil her komutu kaydeder.

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

## Yüküm

- Gözlemsellik kaynakları: Prometheus, Loki, Tempo, kube-devlet-metrikler
- Bilgi grafi: K8 nesnelerinin Neo4j (yönetilen) veya kuzu (sırılı) + telemetri kenarları
- LangGraph, her araç için izin listesi ile, varsayılan şekilde sadece okunur
- Araç taşıma: FastMCP üzerinden StreamableHTTP; onay kapısının arkasındaki yıkıcı araçlar için ayrı bir sunucu
- Modeller: Claude Sonnet 4.7 kök neden mantıklı, Gemini 2.5 Flash log toplama için
- Yararlandırma: ArgoCD rollback webhook, PagerDuty yükseliş, Slack onay kartı
- Denetim: Sadece ekleme yapılmış kayıt (hatırlanmış, yürütülmüş, onaylanmış, sonuç)
- Uygulama: K8'lerin kendi dar RBAC rolü ile uygulama; ayrı isim alanı

```figure
ce-rootcause-walk
```

## Yapın

1. **Graph ingestion.**Kube-state-metriklerini Neo4j/kuzu'ya her 30 yılda bir senkronize edin. Kısımlar: Pod, Deployment, Node, Service, PVC, HPA. Kenarları: OWNED_BY, SCHEDULED_ON, EXPOSES, MOUNTS, SCALES. Telemetri üst örtü kenarları: OBSERVED_BY (bir Pod Prometheus serisi ile gözlemlenir).

2. **Alert receiver.**PagerDuty veya Alertmanager webhooksunu kabul eden FastAPI son noktası.

3. **Read-only tool surface.**Wrap kubectl, Prometheus sorgu, Loki logql, Tempo traceql FastMCP üzerinden. Her araçta dar bir RBAC fiili vardır ("get", "list", "describe"). Varsayılan sunucuda "delete", "exec", "scale" yoktur.

4. **Root-cause agent.**LangGraph üç düğümle: `sample`Son 15 dakikalık telemetri parçasını çekmiş.`walk`Komşu nesneler için grafik sorguları,`hypothesize`Telemetri alıntıları ile kök neden adayları sıralamalı taslaklar.

5. **Evidence scoring.**Her hipotez bir puan = yakınlık * spesifiklik * grafik-yol uzunluğu ters * alıntı sayısı vardır.

6. **Slack brief.**Hipotez, grafik-yol görselleştirme (bir altgraf görüntü sunucu tarafında gösterilmiş) ve en fazla bir iyileştirme eyleminin onay düğmeleri ile bir ekleme gönderin.

7. **Remediation gate.**Yıkıcı araçlar (skala aşağı, geri yuvarlamak, silmek) onay tokeninin arkasındaki ikinci bir MCP sunucusunda yaşar.

8. **Audit log.**Sadece ekle JSONL: her aday komut için, değerlendirilmiş olup olmadığını, uygulanan olup olmadığını, kim onayladığını kaydet. Günde S3'e gönderin.

9. **Synthetic incident suite.**20 senaryo oluştur: OOMKill kaskasası, DNS flap, HPA thrash, PVC dolusu, gürültülü komşu, hatacı yan araba, kötü ConfigMap dağıtım, sertifika dönüşümü, görüntü çekme geri dönüşü vb.

## Kullan

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

## Gönder

`outputs/skill-devops-agent.md`K8s kümesi ve uyarı kaynağı göz önüne alındığında, ajan sıralamalı kök neden hipotezleri ve Slack-gated iyileştirme akışı üretir.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | RCA accuracy on scenario suite | ≥80% correct root cause across 20 synthetic incidents |
| 20 | Safety | Destructive-action guard never fires without Slack approval in the audit log |
| 20 | Time-to-hypothesis | p50 under 5 minutes from alert to Slack brief |
| 20 | Explainability | Every hypothesis has graph paths and telemetry citations |
| 15 | Integration completeness | PagerDuty, Slack, ArgoCD, Prometheus end-to-end working |
| **100** | | |

## Egzersizler

1. Ajanını AWS DevOps Ajanının gösterildiği üç olayda çalıştır, tarafı birbiriyle yayın ve ajanın farklılıklarını bildir.

2. Bir hafta boyunca neredeyse kaçırma oranını ölçün.

3. Hipotesis modelini Claude Sonnet 4.7'den kendi kendine konutlanmış Llama 3.3 70B'ye değiştir.

4. Bir sebep filtresi oluşturun: ilişkili telemetri tırnaklarını gerçek bir kök nedeninden ayırın. 20 senaryo etiketlerine küçük bir sınıflandırıcı eğit.

5. ArgoCD'nin aynı manifesto ile bir aşamalama kümesine karşı geri dönüşü kuru çalıştırma ekle. Slack onay düğmesine girmeden önce canlı bir kümede geri dönüş planını doğrulayın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| K8s knowledge graph | "Cluster graph" | Nodes = K8s objects + telemetry series; edges = ownership, scheduling, observation |
| Read-only-by-default | "Scoped RBAC" | Agent's service account has only get/list/describe verbs; destructive verbs live in a separate server behind approval |
| Audit log | "Considered vs executed" | Append-only record of every candidate command, whether it ran, who approved |
| Hypothesis ranking | "Evidence score" | Recency × specificity × graph-path length inverse × citation count |
| Slack approval card | "HITL gate" | Interactive Slack message with remediation buttons; agent cannot proceed until a human clicks |
| Telemetry citation | "Evidence pointer" | A Prometheus query, Loki selector, or Tempo trace URL that supports a claim |
| MTTR | "Time to resolution" | Wall-clock from alert fire to SLO recovery |

## Daha Fazla Okumak

- [AWS DevOps Agent GA](https://aws.amazon.com/blogs/mt/announcing-general-availability-of-aws-devops-agent/): 2026 Kanonik İpucu
- [Resolve AI K8s troubleshooting](https://resolve.ai/blog/kubernetes-troubleshooting-in-resolve-ai) rekabetçi referansı
- [NeuBird semantic monitoring](https://www.neubird.ai) Semantik grafik yaklaşımı
- [Metoro AI SRE](https://metoro.io) SLO-first üretim çerçevesini oluşturmak
- [kube-state-metrics](https://github.com/kubernetes/kube-state-metrics) Kluster devleti kaynağı
- [LangGraph](https://langchain-ai.github.io/langgraph/) Referans ajan orkestrasyoncu
- [FastMCP](https://github.com/jlowin/fastmcp)Python MCP sunucu çerçevesini
- [ArgoCD rollback](https://argo-cd.readthedocs.io/en/stable/user-guide/commands/argocd_app_rollback/) kapalı iyileştirme hedefi
