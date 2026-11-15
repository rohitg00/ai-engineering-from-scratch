# Bench results (1140 main rows)

## A. Full suite, n=1 per task (cells with all 100 tasks)

| model | harness | n | pass | 95% CI | strict pass | model calls | tool calls | in tok | out tok | wall s | model s | framework s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 | deep_agent | 100 | 0.99 | 0.95-1.00 | 0.99 | 5 [4-5] | 4 [3-5] | 2.318e+04 [1.86e+04-2.73e+04] | 343.5 [261-482] | 5.208 [4.17-6.67] | 5.107 [4.11-6.59] | 0.06665 [0.0588-0.0823] |
| claude-haiku-5-5 | plain | 100 | 0.99 | 0.95-1.00 | 0.99 | 5 [4-5.75] | 4 [3-5] | 5948 [4.3e+03-9.1e+03] | 319.5 [250-476] | 5.005 [3.82-7.13] | 4.997 [3.81-7.11] | 0.0084 [0.00643-0.0128] |
| qwen3:4b-instruct-2507-q4_K_M | deep_agent | 100 | 0.56 | 0.46-0.65 | 0.27 | 4.5 [3-7] | 3 [1-4.75] | 1.462e+04 [9.03e+03-2.28e+04] | 271 [172-460] | 22.77 [17.4-38.5] | 22.67 [17.4-38.5] | 0.05515 [0.0347-0.0826] |
| qwen3:4b-instruct-2507-q4_K_M | plain | 100 | 0.71 | 0.61-0.79 | 0.20 | 4 [3-6] | 3 [2-4] | 3300 [1.8e+03-5.01e+03] | 110.5 [72.2-165] | 9.183 [6.09-13.7] | 9.173 [6.09-13.7] | 0.00635 [0.00435-0.0084] |
| qwen3:8b | deep_agent | 100 | 0.59 | 0.49-0.68 | 0.27 | 4 [2-7] | 2 [1-5] | 1.096e+04 [5.33e+03-2.02e+04] | 110.5 [65.2-162] | 11.53 [7.5-20] | 11.5 [7.46-19.9] | 0.044 [0.0334-0.0625] |
| qwen3:8b | plain | 100 | 0.75 | 0.66-0.82 | 0.61 | 4 [3-7] | 3 [2-5] | 2404 [1.57e+03-6.03e+03] | 107 [75.2-178] | 10.04 [7.25-17.3] | 10.03 [7.24-17.3] | 0.00685 [0.00513-0.0105] |

### Pass by family (full cells)

| model | harness | chain | sql | retrieval | files | multiturn |
|---|---|---|---|---|---|---|
| claude-haiku-5-5 | deep_agent | 20/20 | 19/20 | 20/20 | 20/20 | 20/20 |
| claude-haiku-5-5 | plain | 20/20 | 19/20 | 20/20 | 20/20 | 20/20 |
| qwen3:4b-instruct-2507-q4_K_M | deep_agent | 17/20 | 12/20 | 7/20 | 2/20 | 18/20 |
| qwen3:4b-instruct-2507-q4_K_M | plain | 9/20 | 16/20 | 15/20 | 16/20 | 15/20 |
| qwen3:8b | deep_agent | 17/20 | 12/20 | 6/20 | 5/20 | 19/20 |
| qwen3:8b | plain | 15/20 | 11/20 | 13/20 | 17/20 | 19/20 |

### Failure categories (full cells)

| model | harness | wrong_tool | wrong_args | loop_step_limit | malformed_output | parse_error | gave_up | wrong_final_state | harness_error |
|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 | deep_agent | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |
| claude-haiku-5-5 | plain | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |
| qwen3:4b-instruct-2507-q4_K_M | deep_agent | 7 | 0 | 1 | 12 | 0 | 2 | 22 | 0 |
| qwen3:4b-instruct-2507-q4_K_M | plain | 0 | 0 | 1 | 16 | 0 | 0 | 12 | 0 |
| qwen3:8b | deep_agent | 5 | 7 | 1 | 2 | 0 | 3 | 23 | 0 |
| qwen3:8b | plain | 1 | 7 | 1 | 5 | 0 | 1 | 10 | 0 |

## B. 30-task stratified subset, repeat 0, every model and harness

| model | harness | n | pass | 95% CI | strict pass | model calls | tool calls | in tok | out tok | wall s | model s | framework s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 | deep_agent | 30 | 1.00 | 0.89-1.00 | 1.00 | 5 [4-5] | 4 [3-5] | 2.431e+04 [1.86e+04-2.66e+04] | 344.5 [246-449] | 5.435 [4.16-6.32] | 5.359 [4.09-6.2] | 0.06795 [0.0597-0.0785] |
| claude-haiku-5-5 | deep_agent_fs | 6 | 0.83 | 0.44-0.97 | 0.83 | 3 [2.75-3.5] | 1.5 [0-2.5] | 1.376e+04 [1.24e+04-1.69e+04] | 253 [140-626] | 3.366 [2.72-4.95] | 3.321 [2.63-4.88] | 0.0545 [0.0444-0.112] |
| claude-haiku-5-5 | plain | 30 | 1.00 | 0.89-1.00 | 1.00 | 5 [4-6] | 4 [3-6] | 6456 [4.39e+03-9.25e+03] | 325 [239-462] | 5.486 [3.99-6.94] | 5.474 [3.98-6.93] | 0.0092 [0.00747-0.015] |
| claude-sonnet-5-5 | deep_agent | 30 | 1.00 | 0.89-1.00 | 1.00 | 5 [4-5] | 4 [3-5.25] | 2.341e+04 [1.86e+04-2.58e+04] | 331.5 [214-416] | 7.053 [5.69-8.11] | 6.922 [5.62-8.01] | 0.09075 [0.0709-0.118] |
| claude-sonnet-5-5 | plain | 30 | 1.00 | 0.89-1.00 | 1.00 | 5 [4-5] | 4 [3-5] | 5816 [4.36e+03-7.69e+03] | 302.5 [230-412] | 7.298 [5.75-9.6] | 7.255 [5.72-9.56] | 0.02995 [0.0245-0.0376] |
| gpt-oss:20b | deep_agent | 30 | 0.80 | 0.63-0.90 | 0.20 | 4 [3-7] | 3 [1-4] | 1.007e+04 [7.08e+03-1.79e+04] | 176.5 [97.2-222] | 11.29 [7.74-17.4] | 11.25 [7.65-17.3] | 0.04525 [0.036-0.0636] |
| gpt-oss:20b | plain | 30 | 0.93 | 0.79-0.98 | 0.57 | 4 [3-7] | 3 [2-5] | 2213 [1.71e+03-4.45e+03] | 172 [94.5-236] | 11.34 [6.87-16] | 11.33 [6.87-16] | 0.00645 [0.00415-0.00805] |
| qwen3:14b | deep_agent | 30 | 0.80 | 0.63-0.90 | 0.53 | 4 [3-5.25] | 3 [1-4] | 1.122e+04 [8.04e+03-1.58e+04] | 109 [59-163] | 21.36 [14.4-33.8] | 21.32 [14.4-33.7] | 0.0457 [0.0355-0.0653] |
| qwen3:14b | plain | 30 | 0.87 | 0.70-0.95 | 0.60 | 5 [2.75-6.25] | 4 [2-5] | 3242 [1.35e+03-4.93e+03] | 118.5 [60-163] | 19.53 [14.5-32.9] | 19.52 [14.5-32.9] | 0.00795 [0.00398-0.0109] |
| qwen3:30b-a3b | deep_agent | 30 | 0.50 | 0.33-0.67 | 0.30 | 4 [3-6.25] | 2.5 [1.75-4] | 1.356e+04 [9.45e+03-2.27e+04] | 1546 [1.07e+03-3.34e+03] | 78.12 [50.9-161] | 78.08 [50.8-161] | 0.0466 [0.0357-0.0692] |
| qwen3:30b-a3b | plain | 30 | 0.50 | 0.33-0.67 | 0.27 | 3.5 [3-5] | 2.5 [2-4] | 4022 [2.85e+03-5.86e+03] | 1624 [1.05e+03-2.97e+03] | 66.71 [40.3-131] | 66.7 [40.3-131] | 0.00525 [0.00447-0.00645] |
| qwen3:4b-instruct-2507-q4_K_M | create_agent | 30 | 0.77 | 0.59-0.88 | 0.20 | 4 [3-6.25] | 3 [2-4.25] | 3193 [2.2e+03-4.65e+03] | 102 [71.8-168] | 10.05 [6.36-15.2] | 10.01 [6.34-15.1] | 0.0225 [0.0173-0.0357] |
| qwen3:4b-instruct-2507-q4_K_M | deep_agent | 30 | 0.43 | 0.27-0.61 | 0.23 | 4 [3-6.25] | 3 [0.75-4] | 1.262e+04 [9e+03-2.17e+04] | 254 [174-412] | 22.11 [14.6-36.9] | 22.05 [14.5-36.9] | 0.0552 [0.0304-0.0816] |
| qwen3:4b-instruct-2507-q4_K_M | deep_agent_fs | 6 | 0.67 | 0.30-0.90 | 0.67 | 4 [2.75-5.5] | 0 [0-0.25] | 1.209e+04 [8.26e+03-1.69e+04] | 204.5 [156-261] | 12.25 [8.75-17] | 12.2 [8.68-17] | 0.0491 [0.0386-0.0877] |
| qwen3:4b-instruct-2507-q4_K_M | langgraph | 30 | 0.77 | 0.59-0.88 | 0.20 | 4 [3-6.25] | 3 [2-4.25] | 3193 [2.2e+03-4.65e+03] | 102 [71.8-168] | 8.931 [5.96-13.1] | 8.91 [5.94-13.1] | 0.0185 [0.0148-0.0301] |
| qwen3:4b-instruct-2507-q4_K_M | plain | 30 | 0.77 | 0.59-0.88 | 0.20 | 4 [3-6.25] | 3 [2-4.25] | 3193 [2.2e+03-4.65e+03] | 102 [71.8-168] | 9.671 [6.04-14.2] | 9.662 [6.04-14.2] | 0.0062 [0.0047-0.0097] |
| qwen3:8b | create_agent | 30 | 0.60 | 0.42-0.75 | 0.47 | 4 [3-5.25] | 3 [2-4.25] | 2316 [1.47e+03-3.95e+03] | 100 [64.8-173] | 10.03 [6.3-15.3] | 10.01 [6.28-15.3] | 0.018 [0.0128-0.0264] |
| qwen3:8b | deep_agent | 30 | 0.53 | 0.36-0.70 | 0.13 | 4 [2-5.25] | 2 [1-4] | 1.134e+04 [5.32e+03-1.5e+04] | 111.5 [53.8-153] | 10.71 [7.21-17.8] | 10.66 [7.18-17.7] | 0.0413 [0.0299-0.058] |
| qwen3:8b | deep_agent_fs | 6 | 0.33 | 0.10-0.70 | 0.33 | 5 [2-5] | 1.5 [0.75-4.5] | 1.346e+04 [5.26e+03-1.36e+04] | 110 [44.8-136] | 11.29 [7.2-16.2] | 11.22 [7.04-16.1] | 0.0632 [0.0526-0.12] |
| qwen3:8b | langgraph | 30 | 0.60 | 0.42-0.75 | 0.47 | 4 [3-5.25] | 3 [2-4.25] | 2316 [1.47e+03-3.95e+03] | 100 [64.8-173] | 9.472 [6.1-16.2] | 9.454 [6.08-16.2] | 0.0166 [0.012-0.0231] |
| qwen3:8b | plain | 30 | 0.60 | 0.42-0.75 | 0.47 | 4 [3-5.25] | 3 [2-4.25] | 2316 [1.47e+03-3.95e+03] | 100 [64.8-173] | 9.309 [6.17-16.8] | 9.303 [6.16-16.8] | 0.00565 [0.0045-0.00952] |

### Pass by family (subset)

| model | harness | chain | sql | retrieval | files | multiturn |
|---|---|---|---|---|---|---|
| claude-haiku-5-5 | deep_agent | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 |
| claude-haiku-5-5 | deep_agent_fs | - | - | - | 5/6 | - |
| claude-haiku-5-5 | plain | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 |
| claude-sonnet-5-5 | deep_agent | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 |
| claude-sonnet-5-5 | plain | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 |
| gpt-oss:20b | deep_agent | 6/6 | 6/6 | 4/6 | 4/6 | 4/6 |
| gpt-oss:20b | plain | 6/6 | 6/6 | 6/6 | 4/6 | 6/6 |
| qwen3:14b | deep_agent | 6/6 | 5/6 | 6/6 | 3/6 | 4/6 |
| qwen3:14b | plain | 6/6 | 6/6 | 5/6 | 3/6 | 6/6 |
| qwen3:30b-a3b | deep_agent | 4/6 | 1/6 | 3/6 | 1/6 | 6/6 |
| qwen3:30b-a3b | plain | 5/6 | 1/6 | 3/6 | 3/6 | 3/6 |
| qwen3:4b-instruct-2507-q4_K_M | create_agent | 4/6 | 4/6 | 5/6 | 4/6 | 6/6 |
| qwen3:4b-instruct-2507-q4_K_M | deep_agent | 4/6 | 2/6 | 2/6 | 0/6 | 5/6 |
| qwen3:4b-instruct-2507-q4_K_M | deep_agent_fs | - | - | - | 4/6 | - |
| qwen3:4b-instruct-2507-q4_K_M | langgraph | 4/6 | 4/6 | 5/6 | 4/6 | 6/6 |
| qwen3:4b-instruct-2507-q4_K_M | plain | 4/6 | 4/6 | 5/6 | 4/6 | 6/6 |
| qwen3:8b | create_agent | 3/6 | 3/6 | 3/6 | 4/6 | 5/6 |
| qwen3:8b | deep_agent | 5/6 | 3/6 | 2/6 | 1/6 | 5/6 |
| qwen3:8b | deep_agent_fs | - | - | - | 2/6 | - |
| qwen3:8b | langgraph | 3/6 | 3/6 | 3/6 | 4/6 | 5/6 |
| qwen3:8b | plain | 3/6 | 3/6 | 3/6 | 4/6 | 5/6 |

### Failure categories (subset)

| model | harness | wrong_tool | wrong_args | loop_step_limit | malformed_output | parse_error | gave_up | wrong_final_state | harness_error |
|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 | deep_agent_fs | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |
| gpt-oss:20b | deep_agent | 0 | 0 | 1 | 0 | 0 | 0 | 5 | 0 |
| gpt-oss:20b | plain | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 |
| qwen3:14b | deep_agent | 0 | 0 | 1 | 0 | 0 | 0 | 5 | 0 |
| qwen3:14b | plain | 0 | 0 | 0 | 0 | 0 | 0 | 4 | 0 |
| qwen3:30b-a3b | deep_agent | 0 | 0 | 1 | 9 | 0 | 0 | 5 | 0 |
| qwen3:30b-a3b | plain | 0 | 0 | 0 | 10 | 0 | 2 | 3 | 0 |
| qwen3:4b-instruct-2507-q4_K_M | create_agent | 0 | 0 | 0 | 4 | 0 | 0 | 3 | 0 |
| qwen3:4b-instruct-2507-q4_K_M | deep_agent | 1 | 0 | 0 | 6 | 0 | 1 | 9 | 0 |
| qwen3:4b-instruct-2507-q4_K_M | deep_agent_fs | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 |
| qwen3:4b-instruct-2507-q4_K_M | langgraph | 0 | 0 | 0 | 4 | 0 | 0 | 3 | 0 |
| qwen3:4b-instruct-2507-q4_K_M | plain | 0 | 0 | 0 | 4 | 0 | 0 | 3 | 0 |
| qwen3:8b | create_agent | 0 | 3 | 0 | 2 | 0 | 1 | 6 | 0 |
| qwen3:8b | deep_agent | 1 | 3 | 0 | 1 | 0 | 2 | 7 | 0 |
| qwen3:8b | deep_agent_fs | 0 | 0 | 0 | 0 | 0 | 0 | 4 | 0 |
| qwen3:8b | langgraph | 0 | 3 | 0 | 2 | 0 | 1 | 6 | 0 |
| qwen3:8b | plain | 0 | 3 | 0 | 2 | 0 | 1 | 6 | 0 |

## C. Harness agreement on identical tasks (repeat 0)

| model | pair | tasks | same outcome | identical trace (tokens + tool sequence) |
|---|---|---|---|---|
| claude-haiku-5-5 | plain vs deep_agent | 100 | 100 | 0 |
| claude-sonnet-5-5 | plain vs deep_agent | 30 | 30 | 0 |
| gpt-oss:20b | plain vs deep_agent | 30 | 26 | 0 |
| qwen3:14b | plain vs deep_agent | 30 | 24 | 0 |
| qwen3:30b-a3b | plain vs deep_agent | 30 | 18 | 0 |
| qwen3:4b-instruct-2507-q4_K_M | plain vs create_agent | 30 | 30 | 30 |
| qwen3:4b-instruct-2507-q4_K_M | plain vs langgraph | 30 | 30 | 30 |
| qwen3:4b-instruct-2507-q4_K_M | plain vs deep_agent | 100 | 43 | 0 |
| qwen3:4b-instruct-2507-q4_K_M | create_agent vs langgraph | 30 | 30 | 30 |
| qwen3:4b-instruct-2507-q4_K_M | create_agent vs deep_agent | 30 | 10 | 0 |
| qwen3:4b-instruct-2507-q4_K_M | langgraph vs deep_agent | 30 | 10 | 0 |
| qwen3:8b | plain vs create_agent | 30 | 30 | 30 |
| qwen3:8b | plain vs langgraph | 30 | 30 | 30 |
| qwen3:8b | plain vs deep_agent | 100 | 74 | 0 |
| qwen3:8b | create_agent vs langgraph | 30 | 30 | 30 |
| qwen3:8b | create_agent vs deep_agent | 30 | 22 | 0 |
| qwen3:8b | langgraph vs deep_agent | 30 | 22 | 0 |

## D. Run-to-run variance (subset, 3 repeats)

| model | harness | tasks | repeats | pass rate per repeat | tasks with mixed outcome | tasks with any trace difference |
|---|---|---|---|---|---|---|
| qwen3:4b-instruct-2507-q4_K_M | deep_agent | 30 | 3 | 0.43, 0.43, 0.43 | 0 | 0 |
| qwen3:4b-instruct-2507-q4_K_M | plain | 30 | 3 | 0.77, 0.77, 0.77 | 0 | 0 |

## E. Tool-count scaling (create_agent, chain tasks)

| model | tools (+submit) | selector | n | pass | 95% CI | distractor calls (sum) | model calls med | in tok med [IQR] | wall s med [IQR] | top failure |
|---|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 | 5 | off | 10 | 10/10 | 0.72-1.00 | 0 | 5.0 | 7380 [5.41e+03-9e+03] | 5.008 [4.55-6.45] | [] |
| claude-haiku-5-5 | 5 | on | 10 | 10/10 | 0.72-1.00 | 0 | 9.0 | 1.094e+04 [8.73e+03-1.32e+04] | 10.17 [8.55-11.8] | [] |
| claude-haiku-5-5 | 20 | off | 10 | 10/10 | 0.72-1.00 | 0 | 4.5 | 1.296e+04 [8.34e+03-1.51e+04] | 5.091 [3.73-6.62] | [] |
| claude-haiku-5-5 | 20 | on | 10 | 10/10 | 0.72-1.00 | 0 | 9.0 | 1.439e+04 [9.17e+03-1.74e+04] | 10.18 [7.98-11.6] | [] |
| claude-haiku-5-5 | 50 | off | 10 | 10/10 | 0.72-1.00 | 1 | 4.5 | 2.577e+04 [2.27e+04-3.01e+04] | 5.845 [5.02-6.83] | [] |
| claude-haiku-5-5 | 50 | on | 10 | 10/10 | 0.72-1.00 | 4 | 9.0 | 2.072e+04 [1.8e+04-3.01e+04] | 12.57 [10.3-15] | [] |
| claude-haiku-5-5 | 100 | off | 10 | 10/10 | 0.72-1.00 | 0 | 4.5 | 4.464e+04 [2.96e+04-5.04e+04] | 5.923 [4.23-6.76] | [] |
| claude-haiku-5-5 | 100 | on | 10 | 9/10 | 0.60-0.98 | 5 | 10.0 | 3.328e+04 [2.33e+04-4.32e+04] | 11.65 [7.97-15.7] | [('harness_error', 1)] |
| qwen3:4b-instruct-2507-q4_K_M | 5 | off | 10 | 5/10 | 0.24-0.76 | 0 | 4.0 | 3574 [2.82e+03-3.86e+03] | 7.95 [3.72-14.1] | [('malformed_output', 3), ('wrong_final_state', 2)] |
| qwen3:4b-instruct-2507-q4_K_M | 5 | on | 10 | 1/10 | 0.02-0.40 | 0 | 6.0 | 1996 [1.44e+03-2.51e+03] | 5.934 [3.88-10.7] | [('malformed_output', 5), ('wrong_final_state', 2)] |
| qwen3:4b-instruct-2507-q4_K_M | 5 | on_desc | 10 | 3/10 | 0.11-0.60 | 0 | 5.0 | 2291 [1.73e+03-3.15e+03] | 4.946 [3.76-5.95] | [('wrong_final_state', 3), ('malformed_output', 3)] |
| qwen3:4b-instruct-2507-q4_K_M | 20 | off | 10 | 6/10 | 0.31-0.83 | 10 | 4.0 | 7506 [5.64e+03-1.14e+04] | 9.615 [5.62-13.3] | [('malformed_output', 3), ('wrong_final_state', 1)] |
| qwen3:4b-instruct-2507-q4_K_M | 20 | on | 10 | 1/10 | 0.02-0.40 | 17 | 6.0 | 1898 [1.18e+03-2.44e+03] | 14.76 [7.43-50.3] | [('wrong_tool', 8), ('malformed_output', 1)] |
| qwen3:4b-instruct-2507-q4_K_M | 20 | on_desc | 10 | 2/10 | 0.06-0.51 | 0 | 6.0 | 3500 [2.26e+03-3.99e+03] | 7.205 [4.7-14.7] | [('wrong_final_state', 5), ('malformed_output', 3)] |
| qwen3:4b-instruct-2507-q4_K_M | 50 | off | 10 | 5/10 | 0.24-0.76 | 3 | 4.0 | 1.644e+04 [1.49e+04-2.2e+04] | 30.2 [23.8-41.1] | [('malformed_output', 3), ('wrong_final_state', 2)] |
| qwen3:4b-instruct-2507-q4_K_M | 50 | on | 10 | 1/10 | 0.02-0.40 | 14 | 4.0 | 1557 [1.04e+03-2.43e+03] | 17.93 [8.99-25.1] | [('wrong_tool', 7), ('harness_error', 1)] |
| qwen3:4b-instruct-2507-q4_K_M | 50 | on_desc | 10 | 4/10 | 0.17-0.69 | 6 | 8.0 | 7886 [4.97e+03-8.98e+03] | 15.88 [11.4-18.9] | [('wrong_final_state', 4), ('malformed_output', 1)] |
| qwen3:4b-instruct-2507-q4_K_M | 100 | off | 10 | 5/10 | 0.24-0.76 | 9 | 4.0 | 2.917e+04 [2.84e+04-5.45e+04] | 53.15 [41.6-93.2] | [('wrong_final_state', 3), ('malformed_output', 1)] |
| qwen3:4b-instruct-2507-q4_K_M | 100 | on | 10 | 1/10 | 0.02-0.40 | 11 | 4.0 | 1378 [810-2.44e+03] | 14.59 [8.78-21] | [('wrong_tool', 7), ('harness_error', 1)] |
| qwen3:4b-instruct-2507-q4_K_M | 100 | on_desc | 10 | 2/10 | 0.06-0.51 | 13 | 7.0 | 8906 [6.47e+03-1.21e+04] | 13.42 [8.8-21.2] | [('wrong_final_state', 6), ('gave_up', 1)] |
| qwen3:8b | 5 | off | 10 | 5/10 | 0.24-0.76 | 0 | 5.5 | 4502 [2.88e+03-6.54e+03] | 17.88 [12.1-24.4] | [('wrong_final_state', 3), ('gave_up', 1)] |
| qwen3:8b | 5 | on | 10 | 2/10 | 0.06-0.51 | 0 | 6.0 | 1662 [1.08e+03-2.53e+03] | 13.5 [8.32-19] | [('wrong_tool', 7), ('gave_up', 1)] |
| qwen3:8b | 5 | on_desc | 10 | 3/10 | 0.11-0.60 | 0 | 10.0 | 4676 [3.19e+03-5.32e+03] | 23.33 [14.2-28.4] | [('wrong_final_state', 7)] |
| qwen3:8b | 50 | off | 10 | 0/10 | 0.00-0.28 | 31 | 6.0 | 1.83e+04 [1.2e+04-3.16e+04] | 33.94 [28.9-46.7] | [('wrong_final_state', 7), ('loop_step_limit', 3)] |
| qwen3:8b | 50 | on | 10 | 2/10 | 0.06-0.51 | 10 | 6.0 | 1759 [1.58e+03-2.51e+03] | 16.11 [12.3-21.4] | [('wrong_tool', 8)] |
| qwen3:8b | 50 | on_desc | 10 | 3/10 | 0.11-0.60 | 12 | 10.0 | 8432 [6.41e+03-1.22e+04] | 22.02 [18.4-36.1] | [('wrong_final_state', 7)] |

## F. Structured output correctness (create_agent, chain + sql)

| model | variant | n | answer present | correct (value vs truth) | 95% CI | truth anywhere in output | lookups ok | errors | model calls med | in tok med | wall s med |
|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 | extract | 40 | 40 | 40 | 0.91-1.00 | 40 | 40 | 0 | 5.0 | 4992.0 | 4.4 |
| claude-haiku-5-5 | none | 40 | 40 | 15 | 0.24-0.53 | 38 | 40 | 0 | 4.0 | 4321.0 | 4.5 |
| claude-haiku-5-5 | provider | 40 | 40 | 40 | 0.91-1.00 | 40 | 40 | 0 | 4.0 | 5098.5 | 5.0 |
| claude-haiku-5-5 | tool | 40 | 40 | 39 | 0.87-1.00 | 39 | 40 | 0 | 4.0 | 5734.0 | 4.3 |
| qwen3:4b-instruct-2507-q4_K_M | extract | 40 | 40 | 31 | 0.62-0.88 | 31 | 40 | 0 | 5.0 | 2761.0 | 9.2 |
| qwen3:4b-instruct-2507-q4_K_M | none | 40 | 40 | 25 | 0.47-0.76 | 31 | 40 | 0 | 4.0 | 2559.0 | 9.3 |
| qwen3:4b-instruct-2507-q4_K_M | provider | 10 | 0 | 0 | 0.00-0.28 | 0 | 0 | 10 | 1.0 | 569.5 | 28.7 |
| qwen3:4b-instruct-2507-q4_K_M | tool | 40 | 0 | 0 | 0.00-0.09 | 0 | 40 | 0 | 4.0 | 3481.5 | 8.4 |
| qwen3:8b | extract | 40 | 39 | 27 | 0.52-0.80 | 27 | 31 | 1 | 5.0 | 2090.0 | 11.3 |
| qwen3:8b | none | 40 | 40 | 18 | 0.31-0.60 | 27 | 31 | 0 | 4.0 | 1959.5 | 12.4 |
| qwen3:8b | tool | 40 | 14 | 14 | 0.22-0.50 | 14 | 35 | 1 | 4.0 | 2984.5 | 12.5 |

Errors: provider: StructuredOutputValidationError: Failed to parse structured  x10; extract: StepLimit: more than 10 model calls in one turn x1; tool: StepLimit: more than 10 model calls in one turn x1

## G. File family (20 tasks): deep agent default backend vs FilesystemBackend on the sandbox

| model | harness | n | pass | 95% CI | strict pass | model calls | tool calls | in tok | out tok | wall s | model s | framework s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 | deep_agent | 20 | 1.00 | 0.84-1.00 | 1.00 | 3 [3-4.75] | 2.5 [2-3.75] | 1.377e+04 [1.36e+04-2.2e+04] | 267.5 [186-371] | 3.656 [3.18-5.12] | 3.606 [3.13-5.06] | 0.05175 [0.0391-0.0604] |
| claude-haiku-5-5 | deep_agent_fs | 20 | 0.95 | 0.76-0.99 | 0.95 | 3 [3-4] | 2 [1-3.75] | 1.394e+04 [1.36e+04-1.86e+04] | 287.5 [200-426] | 3.651 [3.01-4.67] | 3.591 [2.96-4.6] | 0.05905 [0.0468-0.0622] |
| claude-haiku-5-5 | plain | 20 | 1.00 | 0.84-1.00 | 1.00 | 3 [3-3] | 2 [2-3] | 2934 [2.86e+03-3.23e+03] | 201 [162-290] | 3.276 [2.91-3.96] | 3.26 [2.9-3.95] | 0.00955 [0.00698-0.011] |
| qwen3:4b-instruct-2507-q4_K_M | deep_agent | 20 | 0.10 | 0.03-0.30 | 0.10 | 3 [2-3] | 0 [0-0] | 8992 [5.9e+03-9.04e+03] | 199 [133-272] | 19.01 [11.7-26.1] | 18.98 [11.7-26] | 0.03315 [0.0269-0.0445] |
| qwen3:4b-instruct-2507-q4_K_M | deep_agent_fs | 20 | 0.80 | 0.58-0.92 | 0.80 | 4 [3-5.75] | 0 [0-1] | 1.209e+04 [9.04e+03-1.79e+04] | 202 [164-344] | 12.13 [9.33-22.1] | 12.08 [9.28-22] | 0.0426 [0.0375-0.0568] |
| qwen3:4b-instruct-2507-q4_K_M | plain | 20 | 0.80 | 0.58-0.92 | 0.80 | 3 [3-4] | 2.5 [2-3.75] | 1778 [1.71e+03-2.42e+03] | 95 [73.8-136] | 7.64 [5.52-10.4] | 7.615 [5.51-10.4] | 0.0054 [0.00392-0.00827] |
| qwen3:8b | deep_agent | 20 | 0.25 | 0.11-0.47 | 0.25 | 2.5 [2-4.75] | 1 [0-2] | 6646 [5.26e+03-1.28e+04] | 92.5 [49.2-108] | 9.197 [5.62-12] | 9.159 [5.58-12] | 0.03555 [0.0326-0.0485] |
| qwen3:8b | deep_agent_fs | 20 | 0.45 | 0.26-0.66 | 0.45 | 3 [2-5] | 1 [0.25-2.75] | 8042 [5.29e+03-1.36e+04] | 96.5 [60.8-138] | 11.29 [7.27-15.9] | 11.22 [7.23-15.8] | 0.0538 [0.033-0.0637] |
| qwen3:8b | plain | 20 | 0.85 | 0.64-0.95 | 0.85 | 3 [2.25-3] | 2 [2-3] | 1484 [1.1e+03-1.53e+03] | 74.5 [51.2-87.2] | 6.297 [5.17-8.67] | 6.29 [5.17-8.66] | 0.00525 [0.00455-0.0062] |

| model | harness | wrong_tool | wrong_args | loop_step_limit | malformed_output | parse_error | gave_up | wrong_final_state | harness_error |
|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 | deep_agent_fs | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |
| qwen3:4b-instruct-2507-q4_K_M | deep_agent | 0 | 0 | 1 | 0 | 0 | 0 | 17 | 0 |
| qwen3:4b-instruct-2507-q4_K_M | deep_agent_fs | 0 | 0 | 2 | 0 | 0 | 0 | 2 | 0 |
| qwen3:4b-instruct-2507-q4_K_M | plain | 0 | 0 | 1 | 0 | 0 | 0 | 3 | 0 |
| qwen3:8b | deep_agent | 0 | 0 | 0 | 0 | 0 | 0 | 15 | 0 |
| qwen3:8b | deep_agent_fs | 0 | 0 | 0 | 0 | 0 | 0 | 11 | 0 |
| qwen3:8b | plain | 0 | 0 | 0 | 0 | 0 | 0 | 3 | 0 |

Deep-agent runs that used built-in fs tools (model, harness, used): ('claude-haiku-5-5', 'deep_agent', False): 14; ('claude-haiku-5-5', 'deep_agent', True): 6; ('claude-haiku-5-5', 'deep_agent_fs', False): 12; ('claude-haiku-5-5', 'deep_agent_fs', True): 8; ('qwen3:4b-instruct-2507-q4_K_M', 'deep_agent', False): 2; ('qwen3:4b-instruct-2507-q4_K_M', 'deep_agent', True): 18; ('qwen3:4b-instruct-2507-q4_K_M', 'deep_agent_fs', False): 2; ('qwen3:4b-instruct-2507-q4_K_M', 'deep_agent_fs', True): 18; ('qwen3:8b', 'deep_agent', False): 11; ('qwen3:8b', 'deep_agent', True): 9; ('qwen3:8b', 'deep_agent_fs', False): 11; ('qwen3:8b', 'deep_agent_fs', True): 9

## H. Sampling variance: plain loop, 4b, subset30, temperature 0.7, seeds 1-3

| seed tag | n | pass |
|---|---|---|
| t07-s1 | 30 | 24/30 (0.63-0.90) |
| t07-s2 | 30 | 23/30 (0.59-0.88) |
| t07-s3 | 30 | 23/30 (0.59-0.88) |

Tasks with mixed outcome across seeds: 5/30
