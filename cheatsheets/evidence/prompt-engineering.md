# Evidence: cheatsheets/prompt-engineering.md

Abbreviations: P11 = phases/11-llm-engineering. L01 = P11/01-prompt-engineering, L02 = P11/02-few-shot-cot, L05 = P11/05-context-engineering, L15 = P11/15-prompt-caching. d = docs/en.md. Code files: L01/c = code/prompt_engineering.py, L02/c = code/advanced_prompting.py, L05/c = code/main.py.

## Architecture: What goes in the window (8 nodes, 7 edges)
- System prompt ~500: L05/d:40
- Tool definitions ~2K-8K: L05/d:41
- Retrieved context ~2K-10K: L05/d:42
- Conversation history ~2K-20K: L05/d:43
- Few-shot examples ~1K-3K: L05/d:44
- User query ~100-500: L05/d:45
- Generation budget ~2K-8K: L05/d:46
- Context window is input plus output: L01/d:172, L05/d:574
- edges follow the order in the window diagram: L05/d:40-45

## Flow: Assemble context per query (7 steps)
1. available = max_tokens - generation_reserve: L05/c:16-20
2. system_prompt allocated first, max_tokens=1000: L05/c:267
3. select_tools with classify_intent, token_budget=2000: L05/c:203-238, 270-271
4. score_relevance, threshold = 0.05: L05/c:82-93, 273-278. (docs version uses 0.1: L05/d:453)
5. reorder_lost_in_middle, best at both ends, max_tokens=3000: L05/c:68-80, 280-284, L05/d:243
6. ConversationManager summaries plus recent turns, max_tokens=5000: L05/c:95-137, 286-288
7. user_query last, max_tokens=500: L05/c:290, query last: L05/d:68

## Tasks in code (task-table, 8)
- build_prompt("persona", ...): L01/c:170, L01/d:851
- build_multi_turn(pattern_name, turns): L01/c:194
- score_response(response_text, criteria): L01/c:321
- build_cot_prompt(question, examples, num_examples=3): L02/c:123
- self_consistency_solve(..., n_samples=5): L02/c:191
- solve_with_escalation(question, examples, client, model): L02/c:336
- ContextBudget(max_tokens=128000, generation_reserve=4000): L05/c:16-17
- select_tools(query, token_budget=2000): L05/c:227

## Self-consistency vote (annotated-code, 12 lines)
- build_cot_prompt, 3 examples default: L02/c:123, 192
- loop n_samples, call_llm temperature=0.7: L02/c:196-197
- extract_answer reads "The answer is": L02/c:104-121, 199
- answers.append: L02/c:200-201
- Counter, most_common, confidence: L02/c:206-208
- confidence >= 0.8 and single_answer == sc_answer: L02/c:343
- tree_of_thought_solve(question, client, model, breadth=3, depth=2): L02/c:352-354

## Pick a reasoning technique (command-table, 8)
- Zero-shot: L02/d:313
- Few-shot: L02/d:314
- Zero-shot CoT: L02/d:315
- Few-shot CoT: L02/d:316
- Self-consistency, N=5: L02/d:317
- Tree-of-Thought: L02/d:319
- ReAct: L02/d:320
- Prompt chaining: L02/d:321
- "Let's think step by step": L02/d:104

## Prompt anatomy and patterns (concepts, 8)
- System message: L01/d:62, 1008
- User message: L01/d:64
- Assistant prefill "{": L01/d:66, 926, 935
- Role narrows distribution: L01/d:72, 83
- Negative, positive, conditional constraints: L01/d:134-138
- XML delimiters <analysis>: L01/d:121-126
- Clarity rules format, length, audience, include and exclude, one example: L01/d:101-107
- Lost in the middle 85-90% vs 60-70%: L05/d:63

## Defaults and numbers (defaults, 8)
- 0.0 / top-p 1.0 extraction, classification, code: L01/d:162. temperature 0 for tests: L01/d:298
- 0.3 / 0.9 summarization: L01/d:163
- 0.7 / 0.95 general Q&A: L01/d:164
- 3-5 examples, one per label: L02/d:63
- n_samples 5 at 0.7, N=3 minimum: L02/c:191, 197, L02/d:141
- 0.8 confidence, else ToT: L02/c:343, L02/d:447-454
- generation_reserve 4000: L05/c:17, reserve at least 2,000-4,000: L05/d:102
- system prompt under 500 tokens: L01/d:284

## Troubleshooting (troubleshooting, 8)
- generic output, vague and generic role: L01/d:78, 87, 101-107
- confident nonsense from too-rare role: L01/d:83
- contradictory instructions: L01/d:286
- over-constraining, 2,000 words, under 500 tokens: L01/d:284
- prompt injection mitigations: L01/d:282
- temperature 0.0 gives identical samples: L02/d:408
- fixed answer format needed for voting: L02/d:374, L02/c:127-128
- lost in the middle, first or last, duplicate at end: L05/d:61-70

## Abbreviations (glossary, 7)
- CoT: L02/d:67, 561
- ToT: L02/d:145, 186-190, 563
- ReAct: L02/d:198, 564
- Self-consistency: L02/d:562
- Top-p: L01/d:168, 1010
- Few-shot 2-10 examples: L01/d:1011
- NIAH: L05/d:9, 24, 591

## Questions (qa, 5)
- CoT extends computation depth: L02/d:86
- CoT hurts on recall, 50-200 tokens: L02/d:108
- reasoning models already do CoT: L02/d:100
- temperature 0 isolates prompt quality: L01/d:298
- temperature or top-p, not both: L01/d:168

## Tips (tips, 6)
- similar examples, label diversity: L02/d:57-61
- critical first, query last: L05/d:67-68
- relevance filtering, bad retrieval worse than none: L05/d:96, 108
- tool pruning 60-80%: L05/d:94
- summarize history past 5,000 tokens: L05/d:106
- stable top, variable bottom for caching: L15/d:32
