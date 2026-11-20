const { execFileSync } = require('node:child_process');
const { readdirSync } = require('node:fs');
const { join } = require('node:path');
function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith('.js'))
      execFileSync(process.execPath, ['--check', p], { stdio: 'inherit' });
  }
}
walk('src');
walk('scripts');
