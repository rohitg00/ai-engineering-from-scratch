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
    budget = budget or Budget()
    tracer = Tracer(question)
    documents = load_corpus(corpus_dir)
    report = Report(question=question, sections=[], snippets={})
    verdicts = []
    exceeded = False
    try:
        with tracer.step("index", documents=len(documents)):
            budget.charge("index")
            index = BM25Index(documents)
        with tracer.step("plan") as detail:
            budget.charge("plan", estimate_tokens(question))
            plan = plan_research(question, model=model)
            detail.update(
                source=plan.source, facets=[facet.sub_question for facet in plan.facets]
            )
        with tracer.step("gather") as detail:
            snippets_by_facet = gather_snippets(plan, index)
            total_text = " ".join(
                s.text for group in snippets_by_facet.values() for s in group
            )
            budget.charge("gather", estimate_tokens(total_text))
            detail.update(
                snippets=sum(len(group) for group in snippets_by_facet.values())
            )
        with tracer.step("write") as detail:
            draft = write_report(plan, snippets_by_facet, max_sentences=max_sentences)
            markdown = to_markdown(draft)
            budget.charge("write", estimate_tokens(markdown))
            detail.update(sentences=draft.sentence_count())
        with tracer.step("verify") as detail:
            budget.charge("verify", estimate_tokens(markdown))
            verdicts = review(markdown, draft.snippets)
            report = apply_verdicts(draft, verdicts)
            detail.update(dropped=[v.sentence for v in verdicts if not v.supported])
    except BudgetExceeded as error:
        exceeded = True
        tracer.steps.append(
            {"name": "budget_exceeded", "detail": {"error": str(error)}, "ms": 0.0}
        )
    tracer.terminal_state = decide_state(verdicts, budget_exceeded=exceeded)
    tracer.budget = budget.to_dict()
    tracer.counts = {
        "documents": len(documents),
        "snippets": len(report.snippets),
        "sentences": report.sentence_count(),
        "citations": sum(
            len(s.cites) for section in report.sections for s in section.sentences
        ),
        "dropped": sum(1 for v in verdicts if not v.supported),
    }
    trace = tracer.to_dict()
    html_text = render_html(report, documents, trace)
    if out_dir is not None:
        write_outputs(
            out_dir, html_text, trace, report_payload(report, documents, trace)
        )
    return report, trace, html_text
