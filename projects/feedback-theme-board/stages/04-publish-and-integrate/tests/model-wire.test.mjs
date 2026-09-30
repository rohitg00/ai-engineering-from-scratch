import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const work=process.env.PROJECT_WORKSPACE;
async function exercise(content) {
  const requests=[];
  const server=createServer(async(request,response)=>{let body='';for await(const chunk of request)body+=chunk;requests.push(JSON.parse(body));response.setHeader('Content-Type','application/json');response.end(JSON.stringify({choices:[{message:{content}}]}));});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const dir=await mkdtemp(join(tmpdir(),'themes-wire-'));
  try {
    const env={...process.env,MODEL_URL:`http://127.0.0.1:${server.address().port}/v1/chat/completions`,MODEL_NAME:'wire-fixture'};
    delete env.MODEL_API_KEY;
    const child=spawn(process.execPath,[join(work,'cli.ts'),join(work,'sample.jsonl'),'--suggest',dir],{env});
    let error='';child.stderr.on('data',chunk=>{error+=chunk;});child.stdout.resume();
    const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
    let proposal=null;try{proposal=JSON.parse(await readFile(join(dir,'themes.proposed.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
    await assert.rejects(readFile(join(dir,'board.html')),/ENOENT/);
    return {code,error,requests,proposal};
  } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
}
test('HTTP theme proposals remain separate from classified evidence',async()=>{const result=await exercise(JSON.stringify([{id:'freshness',title:'Freshness',phrases:['old pages']}]));assert.equal(result.code,0,result.error);assert.equal(result.proposal[0].id,'freshness');assert.equal(result.requests.length,1);});
test('invalid HTTP proposal is rejected before writing a configuration',async()=>{const result=await exercise(JSON.stringify([{id:'../../escape',title:'Bad',phrases:['old pages']}]));assert.equal(result.code,2);assert.equal(result.proposal,null);});
