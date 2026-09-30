"""Fill in the stage interfaces in your own workspace."""


def fingerprint(text):
    raise NotImplementedError("fingerprint")


def validate(records):
    raise NotImplementedError("validate")


def audit(train, test):
    raise NotImplementedError("audit")


def split_groups(records, test_fraction=0.2, seed="course"):
    raise NotImplementedError("split_groups")


def summarize(train, test):
    raise NotImplementedError("summarize")
