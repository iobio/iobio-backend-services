import http from 'http';
import url from 'url';
import querystring from 'querystring';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { buildCachePath } from './cache.js';
import * as flache from 'flache';


const cache = new flache.Cache();

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


  if (params.refresh === 'true') {
    await cache.delete(params.term);
  }

  const entry = await cache.get(params.term);

  if (entry && !entry.content) {
    res.setHeader('Cache-Control', 'no-store');
    res.write(JSON.stringify({
      record: 'pending',
    }));
    res.end();

    return;
  }

  if (entry && entry.content) {
    res.write(JSON.stringify({
      record: entry.content,
    }));
    res.end();

    return;
  }

  res.setHeader('Cache-Control', 'no-store');
  res.write(JSON.stringify({
    record: 'queued',
  }));
  res.end();

  await cache.set(params.term, {
    content: null,
  });

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
      await cache.set(params.term, {
        content: data,
      });
    }
    else {
      console.error("Phenolyzer failed for term:", `"${params.term}"`);
    }
  });

  // TODO: delete pending on error
}
