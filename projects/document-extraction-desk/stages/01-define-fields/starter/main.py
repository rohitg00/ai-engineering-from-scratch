def validate_schema(schema):
    raise NotImplementedError("Implement validate_schema")


def extract_candidates(text, schema):
    raise NotImplementedError("Implement extract_candidates")


def typed_value(quote, kind):
    raise NotImplementedError("Implement typed_value")


def review_document(text, schema, candidates, decisions=None):
    raise NotImplementedError("Implement review_document")


def render_review(report):
    raise NotImplementedError("Implement render_review")

