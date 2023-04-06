import fs from 'node:fs';
import path from 'node:path';
import Mocha from 'mocha';

const mocha = new Mocha({rootHooks: require('./setup').mochaHooks});

for (const f of fs.readdirSync(__dirname)) {
  if (f.endsWith('-test.ts'))
    mocha.addFile(path.join(__dirname, f));
}
mocha.run(process.exit);
