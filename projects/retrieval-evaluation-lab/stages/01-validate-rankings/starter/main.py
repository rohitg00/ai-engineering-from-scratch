"""Fill in the stage interfaces in your own workspace."""


def validate(ranking, judgments, k):
    raise NotImplementedError("validate")


def precision_recall(ranking, judgments, k):
    raise NotImplementedError("precision_recall")


def rank_metrics(ranking, judgments, k):
    raise NotImplementedError("rank_metrics")


def compare_systems(systems, judgments, k):
    raise NotImplementedError("compare_systems")
