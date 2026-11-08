import json


def parse_tool_calls(reply_text):
    raise NotImplementedError


def validate_args(schema, args):
    raise NotImplementedError


def check_reply(reply_text, schemas):
    raise NotImplementedError
