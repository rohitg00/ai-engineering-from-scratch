---
name: handoff-generator
description: workbench artifacts から session-end handoff packets を生成し、7つの canonical fields に対応する human-readable Markdown と machine-readable JSON の両方を作る。
version: 1.0.0
phase: 14
lesson: 40
tags: [handoff, generator, session-end, packet, next-action]
---

workbench (state、verdict、review、feedback log、diff) を受け取り、agent runtime に接続された session-end handoff generator を作成してください。

作成するもの:

1. `generate_handoff(snapshot) -> (markdown, payload)` を公開する `tools/generate_handoff.py`。
2. `outputs/handoff/<session_id>/handoff.md` と `handoff.json`。
3. 7つの required fields と feedback tail format を cover する `handoff.schema.json`。
4. generator を実行し、field が欠けていれば session close を拒否する session-end hook script。
5. 7つの fields、それぞれの sources、trimming policy を列挙する `docs/handoff.md`。

ハード拒否条件:

- `next_action` のない handoff。handoff を装った status report は次 session を汚染する。
- summary を手書きする generator。agent の仕事は workbench を生成可能な state に残すこと。
- JSON と食い違う markdown packet。JSON が source で、markdown は JSON の render。
- 30 entries を超える feedback tail。full log は version control にあり、packet は小さく保つ。

拒否ルール:

- verification report が欠けている場合、packet 生成を拒否する。verdict のない handoff は願望。
- review report が欠けていて human reviewer が期待されていた場合、拒否して review pass を先に要求する。
- diff summary が empty だが session が5分を超えていた場合、生成前に anomaly を surface する。real no-op ではなく wedged session を疑う。

出力構成:

```
<repo>/
├── outputs/handoff/<session_id>/
│   ├── handoff.md
│   └── handoff.json
├── tools/generate_handoff.py
├── handoff.schema.json
└── docs/handoff.md
```

最後に "what to read next" として次を示してください。

- real-style sample app での end-to-end exercise は Lesson 41。
- generator を capstone workbench pack に package する Lesson 42。
- session-end を queue、event、cron triggers に接続する Lesson 29 (Production Runtimes)。
