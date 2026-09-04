class BadInputError(Exception):
    def __init__(self, value):
        super().__init__(f"recieved unexpected value: {value!r}")
