"""Fill in the stage interfaces in your own workspace."""


def normalize(text, aliases=None):
    raise NotImplementedError("normalize")


def build_index(documents, aliases=None):
    raise NotImplementedError("build_index")


def search(index, query, k=3):
    raise NotImplementedError("search")


def evaluate(index, cases, k=3):
    raise NotImplementedError("evaluate")
