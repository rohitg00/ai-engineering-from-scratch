import math
from collections import Counter

import numpy as np


def idf(corpus, term):
    raise NotImplementedError


def bm25_scores(corpus, query, k1=1.5, b=0.75):
    raise NotImplementedError


def rank(corpus, query, top_k, k1=1.5, b=0.75):
    raise NotImplementedError
