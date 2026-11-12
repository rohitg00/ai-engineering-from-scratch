#!/usr/bin/env node
'use strict';

const { execFileSync } = require('node:child_process');
const path = require('node:path');

const STEPS = ['fetch-translation-coverage.js', 'fetch-releases.js'];

for (const step of STEPS) {
  execFileSync(process.execPath, [path.join(__dirname, step)], { stdio: 'inherit' });
}
