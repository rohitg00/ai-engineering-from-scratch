def load_csv(text, max_rows=10000):
    raise NotImplementedError("Implement load_csv")


def plan_question(question, data):
    raise NotImplementedError("Implement plan_question")


def run_query(data, sql, max_rows=100, max_steps=100000):
    raise NotImplementedError("Implement run_query")


def render_report(report):
    raise NotImplementedError("Implement render_report")

