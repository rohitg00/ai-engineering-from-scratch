# Evidence: cheatsheets/dialogue-systems.md

Abbreviations: P05 = phases/05-nlp-foundations-to-advanced. CB = P05/17-chatbots-rule-to-neural, DST = P05/29-dialogue-state-tracking, CE = phases/11-llm-engineering/05-context-engineering. d = docs/en.md, c = code/main.py.

## Hybrid routing (architecture, 7 nodes, 7 edges)
- User input into hybrid_chat: CB/d:168
- Destructive check with danger words: CB/d:169, 179-181
- Structured flow, confirmation for destructive actions: CB/d:170, 207, 235
- FAQ retrieval with threshold=0.6: CB/d:172-174
- FAQ returns None below threshold, escalate: CB/d:111-116
- LLM agent loop with RAG and tool calls: CB/d:50, 176, 194
- Tools are callable functions: CB/d:161
- Reply: CB/d:157, 174

## The agent loop (flow, 6 steps)
1. history starts with the user message, range(max_steps): CB/d:136-138
2. llm(history, tools=tools), response.get("tool_call"): CB/d:139-140
3. unknown tool name or non-dict args append an error and continue: CB/d:144-151
4. fn(**args) runs, call and result appended to history: CB/d:152-155
5. no tool_call returns response["content"]: CB/d:156-157, 161
6. step budget message: CB/d:158, 161

## Tasks in code (task-table, 8 rows)
- faq_respond(user_input, threshold=0.5), returns None: CB/d:107-113
- is_destructive_action(text): CB/d:179
- agent_loop(user_message, tools, llm, max_steps=5): CB/d:136
- joint_goal_accuracy(predicted_states, gold_states): DST/d:129-131
- ContextBudget(max_tokens=128000, generation_reserve=4000): CE/c:17, 307
- budget.allocate("tools", tool_text, max_tokens=2000): CE/c:271
- select_tools(query, token_budget=2000): CE/c:227
- reorder_lost_in_middle(items, scores): CE/c:68-79

## Rule-based state update (annotated-code, 13 lines)
- SLOT_EXTRACTORS dict with four extractors: DST/c:56-61
- update_state copies the state: DST/c:73-74; never reset untouched slots: DST/d:96
- extractor value overwrites slot: DST/c:75-79; correction must overwrite: DST/d:98
- is_negation clears the slot: DST/c:80-81, 68-70; negation must clear: DST/d:97
- return new_state: DST/c:82

## LLM tracker with a schema (annotated-code, 10 lines)
- RestaurantState fields and Literal sets: DST/d:107-112
- day free-form slot: DST/d:112, 154
- llm_dst prompt with render(history), "Output only the JSON state.": DST/d:115-120
- llm(prompt, response_model=RestaurantState): DST/d:121
- regenerate whole state from history: DST/d:146

## Assemble context per query (flow, 6 steps)
1. system_prompt first, max_tokens=1000: CE/c:267, CE/d:67
2. classify_intent then select_tools, max_tokens=2000: CE/c:228, 269-271, CE/d:151-152
3. score_relevance, threshold filter, max_tokens=3000: CE/c:273-284
4. reorder_lost_in_middle, best at start and end: CE/c:282, CE/d:243
5. history from get_context, summaries plus recent, max_tokens=5000: CE/c:126-136, 286-288
6. user_query last, max_tokens=500, generation reserve: CE/c:290, 20, CE/d:68

## Paradigms and DST terms (concepts, 8 bullets)
- Rule-based patterns, intents, slot filling, fails outside scope: CB/d:44
- Retrieval-based nearest stored response, no hallucination: CB/d:46
- Neural seq2seq generic outputs, factual drift: CB/d:48
- LLM agent plan, call tool, observe, decide: CB/d:50
- Slot named parameter (cuisine, date): DST/d:205, CB/d:249
- Classification DST yes/no per (slot, candidate_value), closed vocab: DST/d:32
- Generation DST free text, open vocab, modern default: DST/d:33
- JGA every slot correct, all-or-nothing: DST/d:35, 207

## Defaults and numbers (defaults, 8 rows)
- max_tokens 128000: CE/c:17
- generation_reserve 4000, reserve 2,000-4,000: CE/c:17, CE/d:102
- max_history_tokens 5000, drop two oldest turns into a summary: CE/c:96, 110-114
- token_budget 2000: CE/c:227
- relevance threshold 0.05 in code, 0.1 in docs: CE/c:274, CE/d:453
- 1.3 tokens per word: CE/c:9
- max_steps 5: CB/d:136
- FAQ threshold 0.5, hybrid uses 0.6: CB/d:107, 172

## Troubleshooting (troubleshooting, 8 rows)
- Confident fabrication, never claim without successful tool return: CB/d:202
- Prompt injection, untrusted input, PVE, confirmation: CB/d:203, 207
- Infinite loops, step budget, dedup: CB/d:211
- Context window exhaustion, summarize or retrieve old turns: CB/d:212
- Lost in the middle, important first, query last: CE/d:61-69
- Correction must not clear other slots: DST/d:50, 96
- Case sensitivity, normalize everywhere: DST/d:152
- Schema drift, version schema: DST/d:151

## Abbreviations (glossary, 8 bullets)
- DST maintain slot-value dict: DST/d:204
- JGA, MultiWOZ 2.4 top 80-83%: DST/d:134, 207
- MultiWOZ multi-domain WOZ dataset: DST/d:208
- LDST LLaMA + LoRA, domain-slot prompting: DST/d:41
- TripPy copy-based with BERT, pre-LLM standard: DST/d:40
- PVE Plan-Verify-Execute: CB/d:207
- RAG retrieve docs then ground: CB/d:250
- Lost-in-the-middle 85-90% at ends, 60-70% in middle: CE/d:63

## Questions (qa, 5 bullets)
- No single architecture handles every request well: CB/d:198
- Rule-based for destructive actions: CB/d:184, 235
- Regenerate whole state handles corrections: DST/d:146
- O(n^2) total tokens, cap or summarize: DST/d:150
- Curated 10K often beats dumped 100K: CE/d:26

## Tips (tips, 6 bullets)
- Return None and escalate: CB/d:116
- Log every step (observability), off-task rate evaluations: CB/d:163, 210
- Free-form vs closed-set slots: DST/d:154
- Always pass the full history: DST/d:153
- Tool pruning 60-80%: CE/d:94, 580
- Two to three few-shot examples: CE/d:100
