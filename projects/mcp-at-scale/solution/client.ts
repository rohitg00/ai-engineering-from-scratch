// Typed stdio client for the local MCP fixture server.
// Lesson: projects/mcp-at-scale/stages/05-typed-client/docs/en.md
// Each request has a correlated response; notifications do not.
// Child process output and time are bounded independently of the server.
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
export interface Request { jsonrpc: '2.0'; id?: number; method: string; params?: Record<string, unknown> }
export interface Response { jsonrpc: '2.0'; id: number | null; result?: Record<string, unknown>; error?: {code: number; message: string} }
export function exchange(server: string, requests: Request[], timeout = 3000): Promise<Response[]> {
  const ids = requests.filter(r => r.id !== undefined).map(r => r.id);
  if (new Set(ids).size !== ids.length) return Promise.reject(new Error('duplicate request id'));
  return new Promise((accept, reject) => {
    const child = spawn('python3', [server], {stdio: ['pipe','pipe','pipe']});
    let output = '', error = ''; let settled = false;
    const finish = (failure?: Error, value?: Response[]) => { if (settled) return; settled=true; clearTimeout(timer); if (failure) {child.kill(); reject(failure);} else accept(value!); };
    const timer = setTimeout(() => finish(new Error('server timeout')), timeout);
    child.on('error', e => finish(e));
    child.stdin.on('error', e => finish(e));
    child.stdout.on('data', chunk => {output += chunk; if (output.length > 1_000_000) finish(new Error('response budget exceeded'));});
    child.stderr.on('data', chunk => {error=(error+chunk).slice(-4000);});
    child.on('close', code => {
      if (code) return finish(new Error(`server failed: ${error}`));
      try {
        const rows = output.trim() ? output.trim().split('\n').map(line => JSON.parse(line) as Response) : [];
        if (rows.length !== ids.length || rows.some(row => row.jsonrpc !== '2.0' || !ids.includes(row.id as number) || !('result' in row || 'error' in row)) || new Set(rows.map(row=>row.id)).size !== ids.length) throw new Error('response correlation failed');
        finish(undefined, rows);
      } catch (e) {finish(e instanceof Error ? e : new Error(String(e)));}
    });
    child.stdin.end(requests.map(request => JSON.stringify(request)).join('\n')+'\n');
  });
}
export const initialize: Request[] = [{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18'}},{jsonrpc:'2.0',method:'notifications/initialized'}];
if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  console.log(JSON.stringify(await exchange(resolve(dirname(fileURLToPath(import.meta.url)),'protocol.py'),[...initialize,{jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'pods_count',arguments:{}}}]),null,2));
}
