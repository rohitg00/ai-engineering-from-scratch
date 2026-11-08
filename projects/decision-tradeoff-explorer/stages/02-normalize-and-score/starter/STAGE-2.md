`normalize(c:Criterion,v:number):number`; `score(data,weights={}):Row[]` sorted by descending score then ID. A row has `{id,label,score,missing,violations,normalized}`. Weight overrides are raw nonnegative magnitudes; invalid or all-zero weights throw.

Normalize units without hiding missing values or hard constraints.
