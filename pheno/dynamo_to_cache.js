const fs = require('fs');
const { ensureCacheDir, buildCachePath } = require('./cache.js');


const json = fs.readFileSync('dynamo.json');
const data = JSON.parse(json);

for (const item of data.Items) {
  const term = item.term.S.toLowerCase();
  ensureCacheDir(term);
  const cachePath = buildCachePath(term);

  if (cachePath.length > 256) {
    console.log("Filename too long: " + cachePath);
    continue;
  }

  // create file if it doesn't exist
  try {
    fs.statSync(cachePath);
    console.log("exists " + cachePath);
  }
  catch (e) {
    console.log("create " + cachePath);
    const data = item.record.S;
    fs.writeFileSync(cachePath, data);
  }
}
