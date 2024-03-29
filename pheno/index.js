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

    const ts = new Date().toISOString();

    const ip = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'] : req.socket.remoteAddress;

    console.log(`${ts}\t${ip}\t${req.method}\t${urlObj.path}`);

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

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'max-age=86400');
    res.setHeader('Content-Type', 'application/json');

    const cachePath = buildCachePath(params.term);

    if (pending[cachePath]) {
      res.setHeader('Cache-Control', 'no-store');
      res.write(JSON.stringify({
        record: 'pending',
      }));
      res.end();
      return;
    }

    if (params.refresh === 'true') {
      try {
        await fs.promises.unlink(cachePath);
      }
      catch (e) {
      }
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
      res.setHeader('Cache-Control', 'no-store');
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

      let ended = false;
      proc.stdout.on('end', async () => {
        ended = true;
      });

      proc.on('exit', async () => {

        if (!ended) {
          console.error("Attempted to write before stream ended");
        }

        if (proc.exitCode === 0) {
          await ensureCacheDir(params.term);
          await fs.promises.writeFile(cachePath, data);
        }
        else {
          console.error("Phenolyzer failed for term:", `"${params.term}"`);
        }
        delete pending[cachePath];
      });

      // TODO: delete pending on error
    }
  }
})();
