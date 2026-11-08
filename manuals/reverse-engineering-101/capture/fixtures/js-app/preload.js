"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ledger", {
  percentChange: (before, after) => ipcRenderer.invoke("ledger:percent-change", before, after),
  gradeLabel: (score) => ipcRenderer.invoke("ledger:grade-label", score),
  log: (line) => ipcRenderer.send("ledger:log", line),
});
