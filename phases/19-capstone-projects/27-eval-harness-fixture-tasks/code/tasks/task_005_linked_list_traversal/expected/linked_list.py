class Node:
    def __init__(self, value, nxt=None):
        self.value = value
        self.nxt = nxt


def linked_list_length(head):
    if head is None:
        return 0
    count = 0
    node = head
    while node is not None:
        count = count + 1
        node = node.nxt
    return count
