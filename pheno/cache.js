const fs = require('fs');
const path = require('path');


function ensureCacheDir(term) {
  const encTerm = encodeURIComponent(term);
  const cacheDirname = encTerm.slice(0, 2);
  const cacheDir = path.join('cache', cacheDirname);
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  catch (e) {
    // no-op
  }
}

function buildCachePath(term) {
  const encTerm = encodeURIComponent(term);
  const cacheDirname = encTerm.slice(0, 2);
  const cacheDir = path.join('cache', cacheDirname);
  const cachePath = path.join(cacheDir, encTerm);
  return cachePath;
}


module.exports = {
  ensureCacheDir,
  buildCachePath,
};
