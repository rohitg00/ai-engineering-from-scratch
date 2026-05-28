# Reliability Policy

workbench は、業界で繰り返し発生する5つの failure modes を吸収します。

1. Hallucinated action — rule set + verification gate で捕捉する。
2. Scope creep — scope contract diff check で捕捉する。
3. Cascading errors — feedback records + refuse-on-null-exit で捕捉する。
4. Context loss — repo memory で吸収する。chat は source of truth ではない。
5. Tool misuse — reviewer rubric の verification dimension で捕捉する。

policy は verification gate により enforce されます。override path は signed
and audited です。agents は self-override できません。
