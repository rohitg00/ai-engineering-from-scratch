# Evidence: cheatsheets/ai-governance.md

Abbreviations: P18 = phases/18-ethics-safety-alignment. L19 = P18/19-model-welfare-research, L24 = P18/24-regulatory-frameworks-eu-us-uk-korea, L26 = P18/26-model-system-dataset-cards, L27 = P18/27-data-provenance-training-governance, L28 = P18/28-alignment-research-ecosystem. d = docs/en.md, c = code/main.py.

## EU AI Act timeline (flow, 7 steps)
1. In force 1 August 2024: L24/d:25, 33-36, L24/c:15
2. 2 February 2025 prohibited practices and AI literacy: L24/d:33, L24/c:18
3. 2 August 2025 GPAI and governance: L24/d:34, L24/c:22
4. 10 July 2025 GPAI Code of Practice, 3 chapters, 12 commitments: L24/d:42-48, L24/c:21
5. 17 December 2025 Transparency Code first draft: L24/d:52, L24/c:23
6. 2 August 2026 full applicability, Article 50, penalties: L24/d:35, L24/c:27
7. 2 August 2027 legacy GPAI and embedded high-risk: L24/d:36, L24/c:28

## Four regimes side by side (comparison, 6 rows)
- Body or law: EU AI Act L24/d:23-25, CAISI under NIST L24/d:60, AI Security Institute L24/d:56, AI Framework Act L24/d:62-64
- Key date: 1 August 2024 L24/d:25, June 2025 L24/d:58, February 2025 L24/d:54, effective January 2026 L24/d:64
- Posture: strict, risk-tiered L24/d:75, pro-growth L24/d:60, narrow security focus L24/d:77, MSIT-led L24/d:78
- Main duty: risk tiers and Article 50 L24/d:25-30, standards and innovation L24/d:60, frontier capability security L24/d:56, local representatives for foreign AI companies L24/d:67
- Extra: penalties 15M EUR / 3% L24/d:35, states fill federal gaps L24/d:76, open-sourced Inspect L24/d:56, consolidates 19 AI bills L24/d:64
- Signal: benchmark for privacy-adjacent regulation L24/d:75, reduced pre-deployment evaluation L24/d:60, drops bias and free-speech framings L24/d:56, Article 12 AISI under MSIT L24/d:66

## EU AI Act risk tiers (concepts, 7)
- Prohibited Article 5: L24/d:27
- High-risk Annex III areas: L24/d:28
- High-risk duties: L24/d:28
- GPAI from 2 August 2025: L24/d:29
- Systemic-risk >1e25 FLOP, 5-15 companies: L24/d:29, 46, 120
- Limited-risk Article 50: L24/d:30
- Code chapters and who they bind: L24/d:44-46

## Card scopes (architecture, 6 nodes, 5 edges)
- Data provenance, AB 2013, TDM opt-out, upstream of the datasheet: L27/d:19, 23-25, 43, L26/d:81
- Datasheet Gebru et al. 2018: L26/d:38
- Model Card Mitchell et al. 2019, depends on the datasheet being accurate: L26/d:23, 49
- System Card covers model + safety stack + deployment: L26/d:62
- Data Card telescopic, periscopic, microscopic: L26/d:51-56
- GPAI Code Transparency chapter requires model cards: L26/d:77

## Run the lesson code (command-table, 7)
- L19 prints EV and INVEST or skip: L19/c:8, 58-63
- L24 prints TIMELINE: L24/c:8, 14, 36-37
- L26 prints model card, datasheet, system card: L26/d:89, L26/c:11, 117-123
- L27 prints the 12-item summary: L27/c:8, 74-79
- flag_followups(summary): L27/c:46-58
- render_markdown(summary) writes (missing): L27/c:61-64
- L28 prints the ECOSYSTEM map of five orgs: L28/c:6, 12-48, 55

## AB 2013 Section 3111(a) fields (annotated-code)
- AB_2013_FIELDS list and field strings: L27/c:14-27
- 12 items in Section 3111(a): L27/d:25-37
- Item 12 new relative to datasheets: L27/d:39
- Item 5 copyright flag, EU TDM opt-out: L27/c:52-53
- Item 7 personal information triggers CPRA: L27/d:39, L27/c:48-49
- Items 8 and 10: L27/d:33, 35

## Welfare expected value (annotated-code)
- ev function body: L19/c:29-34
- verdict INVEST if v > 0: L19/c:55, 62
- end-conversation 0.002, 1.0: L19/c:38
- shutdown 1000.0, 2.0: L19/c:40
- low scenario 0.01, high 0.50: L19/c:45, 47

## Numbers to know (defaults, 8)
- End-conversation 0.002 USD per conversation: L19/c:19, 38, 68
- Patienthood 0.01, 0.10, 0.50: L19/c:45-47
- 0.3% ethical considerations, Oreamuno et al. 2023: L26/d:36
- Up to 29% download lift, Liang et al. 2024: L26/d:74
- January 1, 2026 posting for systems on or after January 1, 2022: L27/d:25
- About 25% of top sources, 2023 -> 2024: L27/d:68
- MATS 527+, 180+ papers, h-index 47: L28/d:28-31
- ~80% pre-2025 alumni in safety/security: L28/d:34

## Troubleshooting (troubleshooting, 8)
- Erasure impossible, compliance window at collection, unlearning partial: L27/d:57-64
- Personal information triggers CPRA: L27/d:39, L27/c:48-49
- Copyright material, EU TDM opt-out: L27/c:52-53
- Verifiable attestation Laminator: L26/d:75
- Self-reports sensitive to user expectations, multi-method: L19/d:57-59
- Lab self-evaluation conflict of interest, external evaluators: L28/d:68
- Multiple jurisdictions, comply with the strictest, typically EU: L24/d:80
- Placeholder sections, disaggregated analysis: L26/d:97-99, 32

## Use each card when (tips, 5)
- Model Card sections: L26/d:25-34
- Datasheet sections: L26/d:40-47
- Data Card readers, telescopic and microscopic: L26/d:53-58
- System Card sections: L26/d:62-67
- Sustainability fields: L26/d:76

## Abbreviations (glossary, 8)
- GPAI: L24/d:29, 115
- CAISI: L24/d:60, 118
- MSIT: L24/d:66
- TDM: L27/d:43, 103
- CPRA: L27/d:39
- MATS: L28/d:23-25, 102
- METR: L28/d:50-52
- Opt-out signals: L27/d:105

## Questions (qa, 6)
- Expected-value claim under moral uncertainty: L19/d:21, 68
- Claude Opus 4 and 4.1 end conversation in extreme edge cases: L19/d:39
- Spiritual bliss attractor: L19/d:51
- Legitimate interest with opt-out, consent not required: L27/d:49
- Redwood AI Control, Apollo scheming evals, Eleos welfare evals: L28/d:38, 46, 60
- Multi-org structure is the quality control: L28/d:68
