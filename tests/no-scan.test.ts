import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
async function files(dir:string):Promise<string[]>{const entries=await readdir(dir,{withFileTypes:true});return (await Promise.all(entries.map(e=>e.isDirectory()?files(join(dir,e.name)):Promise.resolve([join(dir,e.name)])))).flat();}
test('operational TypeScript source does not invoke DynamoDB Scan',async()=>{
 for(const file of [...await files('apps/api'),...await files('packages/dynamodb')].filter(f=>f.endsWith('.ts'))){
  assert.doesNotMatch(await readFile(file,'utf8'),/\bScanCommand\b|\.scan\s*\(/,file);
 }
});
