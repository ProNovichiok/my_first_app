import {build} from 'esbuild';
import {zipSync,strToU8} from 'fflate';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
await build({entryPoints:['functions/index.mjs'],bundle:true,platform:'node',target:'node24',format:'esm',outfile:'dist/index.mjs',minify:true,banner:{js:"import{createRequire as __cr}from'node:module';const require=__cr(import.meta.url);"}});
const code=await readFile('dist/index.mjs');const zip=zipSync({'index.mjs':code},{level:6});await writeFile('dist/function.zip',zip);
console.log(JSON.stringify({bundleBytes:code.length,zipBytes:zip.length,runtime:'nodejs24'}));
