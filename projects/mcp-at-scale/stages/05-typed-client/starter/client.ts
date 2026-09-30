export interface Request { jsonrpc:'2.0'; id?:number; method:string; params?:Record<string,unknown> }
export const initialize:Request[]=[];
export async function exchange(_server:string,_requests:Request[],_timeout=3000):Promise<unknown[]> { throw new Error('Stage 5: not implemented yet: typed stdio exchange'); }
