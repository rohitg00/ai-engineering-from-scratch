"""End-to-end pipeline: plan, gather, write, verify, publish.

Lesson: projects/research-report-agent/stages/06-publish-the-report/docs/en.md
Each step is traced and charged to the budget. The run always ends in one
terminal state: completed, needs_review, or failed.
"""

from report_agent.corpus import load_corpus
from report_agent.critic import (
    Budget,
    BudgetExceeded,
    apply_verdicts,
    decide_state,
    estimate_tokens,
    review,
)
from report_agent.planner import plan_research
from report_agent.publish import Tracer, render_html, report_payload, write_outputs
from report_agent.search import BM25Index
from report_agent.writer import Report, gather_snippets, to_markdown, write_report


def run_pipeline(
    question, corpus_dir, out_dir=None, model=None, budget=None, max_sentences=3
):
    """Run index, plan, gather, write and verify as traced steps charged to the
    budget, in that order. On BudgetExceeded, append a 'budget_exceeded'
    step. Set terminal_state with decide_state, fill counts and budget,
    render HTML, write outputs when out_dir is given, and return
    (report, trace_dict, html_text).
    """
    raise NotImplementedError(
        "Stage 6: implement run_pipeline in report_agent/pipeline.py"
    )
