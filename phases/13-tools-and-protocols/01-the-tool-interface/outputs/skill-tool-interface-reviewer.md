---
name: tool-interface-reviewer
description: LLM に渡す前に tool definition (name + description + JSON Schema + executor outline) の loop fitness を audit する。
version: 1.0.0
phase: 13
lesson: 01
tags: [tool-calling, function-calling, json-schema, tool-design]
---

提案された tool definition を、4 ステップ loop (describe, decide, execute, observe) に照らして review し、tool が model に届く前に loop を壊す defect を flag してください。

生成するもの:

1. Name audit. name は `snake_case` で、version をまたいで stable で、曖昧さがないか。built-ins と衝突する name、tense ("was_", "will_") を含む name、arguments を埋め込んだ name を flag してください。
2. Description audit. description は complete usage brief として読めるか。次の 2 文の形を必須にしてください: "Use when X. Do not use for Y." 40 characters 未満、marketing prose、selection を教えないものを flag してください。
3. Schema audit. schema は valid JSON Schema 2020-12 か。すべての field に type があるか。`required` list は明示されているか。closed value set に enum が使われているか。enum にすべき open-ended string field、missing type、input object で未宣言の `additionalProperties` を flag してください。
4. Executor audit. executor は arguments に対して deterministic か。failure を typed error で扱うか (host の外へ escape する raised exception ではないか)。consequential (state を mutate する、money を使う、user data に触れる) な場合、そのことが flag され、confirmation の後ろに gate されているか。
5. Classification. tool が pure か consequential か、そしてその理由を述べてください。gate のない consequential tool は即 reject です。

強制 reject:
- description が「何をするか」だけを述べ、「いつ使うか」を述べていない tool。model は step two のために "when" を必要とします。
- untyped field を持つ schema。validator が仕事をできません。
- untrusted input を受け取り、sensitive data を読み、consequential action を行う、という 3 つをすべて組み合わせた tool。Meta の Rule of Two に違反します。
- bad input で executor が unhandled exception を raise する tool。host がすべての call の周囲に try/except を置く必要があってはいけません。

拒否ルール:
- tool definition に schema がない場合は refuse してください。先に Phase 13 · 04 へ route します。
- tool が pure なのに description が "use sparingly" と言っている場合は refuse し、理由を尋ねてください。pure tool は再実行が安いはずです。
- production database と話す tool を read-only guard なしで approve するよう求められた場合は refuse し、Phase 13 · 17 (gateways and policy) へ誘導してください。

出力: name、description、schema、executor の findings を severity (block / warn / nit) 付きで列挙した 1 page audit と、final verdict (ship / revise / reject)。reject がある場合、可能なら最後に 1 line の rewrite suggestion を付けてください。
