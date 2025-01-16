import http from 'http';
import url from 'url';
import querystring from 'querystring';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import * as flache from 'flache';

import { argv } from 'node:process';
const port = argv[2] ? argv[2] : 9001;
const cacheDir = argv[3] ? argv[3] : 'cache';

const STALE_PENDING_MS = 2000;

const cache = new flache.Cache({
  path: cacheDir,
});

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
}).listen(port);

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

  if (entry && entry.content) {
    res.write(JSON.stringify({
      record: entry.content,
    }));
    res.end();

    return;
  }
  else if (entry && !entry.content) {
    res.setHeader('Cache-Control', 'no-store');
    res.write(JSON.stringify({
      record: 'pending',
    }));
    res.end();

    // Check if the pending cache entry is stale (ie the node handling it may
    // have crashed). If so, delete it and handle in this node.
    const now = new Date();
    const lastUpdated = new Date(entry.last_updated);
    const diff = now - lastUpdated;

    if (diff < STALE_PENDING_MS) { 
      // Haven't timed out yet
      return;
    } 
  } 
  else {
    res.setHeader('Cache-Control', 'no-store');
    res.write(JSON.stringify({
      record: 'queued',
    }));
    res.end();
  }

  async function updatePending() {
    await cache.set(params.term, {
      content: null,
      //last_updated: (new Date()).toISOString(),
      last_updated: new Date(),
    });
  }

  // Update the pending request regularly so other nodes know that we are
  // still handling it
  updatePending();
  const intId = setInterval(updatePending, 1000);

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

    clearInterval(intId);

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
      await cache.delete(params.term);
    }
  });
}
