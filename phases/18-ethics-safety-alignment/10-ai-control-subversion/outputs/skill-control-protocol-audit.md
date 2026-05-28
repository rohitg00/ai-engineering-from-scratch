---
name: control-protocol-audit
description: AI Control threat model のもとで deployment protocol を audit する。
version: 1.0.0
phase: 18
lesson: 10
tags: [ai-control, subversion, trusted-editing, untrusted-monitoring, safety-case]
---

deployment protocol description が与えられたら、AI Control threat model、U (untrusted strong)、T (trusted weak)、H (trusted human) のもとで audit し、protocol の usefulness-safety frontier 上の位置を測ってください。

作成するもの:

1. Role assignment。どの model が U で、どれが T かを特定します。T が U の別 instance なら、collusion risk を即座に flag します。
2. Audit budget accounting。H はどう allocated されていますか。uniform、random、flag-directed のどれですか。期待値として outputs の何割が audited されますか。
3. Collusion-vector enumeration。untrusted components の各 pair (U-producer + U-monitor、U-producer + U-editor) について、collusion vectors、steganographic cues、shared-training prior exploitation、timing channels を列挙します。
4. Capability-gap analysis。T は U よりどの程度弱いですか。どの時点で T の editing signal は noise になりますか (例: T が U の backdoors を reliably detect できない)。
5. Worst-case threat model。U が protocol を完全に知る adversarial model だと仮定すると、adversary の best strategy は何ですか。red-team attempts の何割が成功しますか。

強い拒否条件:
- collusion-resistance mechanism なしに U を自身の monitor として使う protocol description。
- red team が protocol visibility を持つ evaluation なしの "near-zero backdoor rate" という protocol claim。
- T-to-U capability gap と H budget を明確にしない protocol audit。

拒否ルール:
- user が "is this protocol safe" と聞いたら、(a) red-team result、(b) capability-gap estimate、(c) H budget の 3 点 evidence なしには拒否してください。
- user が alignment と control を混同したら ("we aligned U so we don't need a protocol")、拒否し Lesson 9 (alignment faking) を指してください。alignment は U の性質で、control は protocol の性質です。

出力: 上記 5 sections を埋め、weakest link (通常は T-to-U capability gap または collusion resistance) を名指しし、最大の unaddressed failure mode を述べる 1 ページ audit。threat-model source として Greenblatt et al. (arXiv:2312.06942) を 1 回引用してください。
