class BadInputError(Exception):
    def __init__(self, value):
        super().__init__(f"received unexpected value: {value!r}")
