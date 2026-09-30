"""Fill in the stage interfaces in your own workspace."""


def parse_notes(text):
    raise NotImplementedError("parse_notes")


def validate_action(action):
    raise NotImplementedError("validate_action")


def deduplicate(actions):
    raise NotImplementedError("deduplicate")


def publish(actions, today):
    raise NotImplementedError("publish")
