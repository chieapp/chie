#!/usr/bin/env node

/* global require, __dirname */

const path = require('node:path');
const fs = require('node:fs');

// Copy necessary fields from |chie|'s package.json to |types|'s package.json.
const input = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json.in')));
const parent = require('../package.json');
input.version = parent.version;
for (const dep in input.dependencies)
  input.dependencies[dep] = parent.dependencies[dep];

fs.writeFileSync(path.join(__dirname, 'package.json'), JSON.stringify(input, null, 2));
