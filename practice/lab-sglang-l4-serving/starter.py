import numpy as np

from support import LOAD, MIXED, SLO, column


def gains(ys):
    raise NotImplementedError


def saturation_point(xs, ys, min_gain=0.05):
    raise NotImplementedError


def largest_within(xs, ys, limit):
    raise NotImplementedError


def pct_change(new, old):
    raise NotImplementedError


def ranges_overlap(a, b):
    raise NotImplementedError


def answers():
    raise NotImplementedError
