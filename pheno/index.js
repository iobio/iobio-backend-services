const http = require('http');
const url = require('url');
const querystring = require('querystring');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { ensureCacheDir, buildCachePath } = require('./cache.js');


(async () => {
  try {
    await fs.promises.mkdir('./cache');
  }
  catch (e) {
  }

  http.createServer((req, res) => {
    const urlObj = url.parse(req.url); 

    if (urlObj.pathname === '/phenolyzer' || urlObj.pathname === '/phenolyzer/') {
      handlePhenolyzer(req, res);
    }
    else {
      res.end();
    }
  }).listen(9001);

  const pending = {};

  async function handlePhenolyzer(req, res) {
    const urlObj = url.parse(req.url); 
    const params = querystring.parse(urlObj.query);

    if (!params.term) {
      res.statusCode = 400;
      res.write("Must provide term parameter");
      res.end();
      return;
    }

    res.setHeader('Cache-Control', 'max-age=86400');
    res.setHeader('Content-Type', 'application/json');

    const cachePath = buildCachePath(params.term);

    if (pending[cachePath]) {
      res.write(JSON.stringify({
        record: 'pending',
      }));
      res.end();
      return;
    }

    try {
      const stat = await fs.promises.stat(cachePath);
      const data = await fs.promises.readFile(cachePath, 'utf8');
      res.write(JSON.stringify({
        record: data,
      }));
      res.end();
    }
    catch(e) {
      pending[cachePath] = true;
      res.write(JSON.stringify({
        record: 'queued',
      }));
      res.end();

      const proc = spawn('./phenolyzer.sif', [params.term]);
      proc.stdout.setEncoding('utf8');

      let data = '';
      proc.stdout.on('data', (chunk) => {
        data += chunk;
      });

      proc.stdout.on('end', async () => {
        await fs.promises.writeFile(cachePath, data);
        delete pending[cachePath];
      });

      // TODO: delete pending on error
    }
  }
})();
