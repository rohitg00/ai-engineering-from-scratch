"use strict";

function percentChange(before, after) {
  if (before === 0) return 0;
  return Math.trunc(((after - before) * 100) / before);
}

function grade(score) {
  switch (Math.trunc(score / 10)) {
    case 10:
    case 9:
      return 4;
    case 8:
      return 3;
    case 7:
      return 2;
    case 6:
      return 1;
    default:
      return 0;
  }
}

function total(values) {
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += values[i];
  return sum;
}

const labels = ["F", "D", "C", "B", "A"];

function gradeLabel(score) {
  return labels[grade(score)];
}

module.exports = { percentChange, grade, total, gradeLabel };
