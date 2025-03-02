const { execSync, exec } = require('child_process');

async function main() {
  const QUERY = `osxphotos query --only-movies --max-size 7340032 --json`;

  const result = exec(QUERY, { encoding: 'utf-8' });

  const fs = require('fs');

  fs.writeFileSync('output.ts', result);
}

main();
