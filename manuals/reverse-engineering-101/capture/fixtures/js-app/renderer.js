"use strict";

async function loadLatest() {
  const response = await fetch("/api/ledger/latest");
  const body = await response.json();
  localStorage.setItem("ledger:latest", JSON.stringify(body));
  return body;
}

async function render() {
  const latest = await loadLatest();
  const change = await window.ledger.percentChange(latest.before, latest.after);
  const label = await window.ledger.gradeLabel(latest.score);
  document.getElementById("change").textContent = change + "%";
  document.getElementById("grade").textContent = label;
  window.ledger.log("rendered " + latest.before + " -> " + latest.after);
}

document.addEventListener("DOMContentLoaded", render);
