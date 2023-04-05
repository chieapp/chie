import fs from 'node:fs';
import path from 'node:path';
import gui from 'gui';
import Mocha from 'mocha';

const mocha = new Mocha({
  slow: 5 * 1000,
  timeout: 20 * 1000,
  require: [ '../test/setup.ts' ],
});

for (const f of fs.readdirSync(__dirname)) {
  if (f.endsWith('-test.ts'))
    mocha.addFile(path.join(__dirname, f));
}
mocha.run(failures => {
  gui.MessageLoop.quit();
  process.exit(failures);
});
