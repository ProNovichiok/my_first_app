import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createApp} from './app.mjs';
const app=createApp(),root=resolve('public'),port=Number(process.env.PORT||3003);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.json':'application/json','.txt':'text/plain; charset=utf-8'};
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost:'+port);if(url.pathname==='/telegram'||url.pathname==='/health'||url.pathname.startsWith('/api/')){let size=0,parts=[];for await(const part of req){size+=part.length;if(size>20480){res.writeHead(413);res.end();return;}parts.push(part);}const request=new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(parts)}:{})});const response=await app.fetch(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;}
 if(url.pathname==='/site-config.json'){res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({mode:'server',version:'4.0.0',apiBase:''}));return;}
 const path=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);if(path.split('/').some(p=>p.startsWith('.'))||path.includes('\\'))throw Error();const file=resolve(root,'.'+path);if(!file.startsWith(root+sep))throw Error();const content=await readFile(file);res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream'});res.end(content);
 }catch{res.writeHead(404);res.end('Not found');}});
server.listen(port,process.env.HOST||'127.0.0.1',()=>console.log('Балтик Драйв / Node.js: http://localhost:'+port));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>app.db.close().finally(()=>process.exit())));
