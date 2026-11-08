"use strict";

const path = require("node:path");
const { app, BrowserWindow, ipcMain } = require("electron");
const ledger = require("./ledger");

function createWindow() {
  const window = new BrowserWindow({
    width: 640,
    height: 480,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  window.loadFile("index.html");
  return window;
}

ipcMain.handle("ledger:percent-change", (event, before, after) => ledger.percentChange(before, after));
ipcMain.handle("ledger:grade-label", (event, score) => ledger.gradeLabel(score));
ipcMain.on("ledger:log", (event, line) => console.log(line));

app.whenReady().then(createWindow);
