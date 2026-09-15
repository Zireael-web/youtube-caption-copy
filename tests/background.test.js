import { test } from 'node:test';
import assert from 'node:assert/strict';

let listener, onClick, injection;
globalThis.chrome = {
  runtime: { id:'test-extension', onMessage:{addListener:f=>{listener=f;}} },
  action: {onClicked:{addListener:f=>{onClick=f;}},setBadgeText:async()=>{},setTitle:async()=>{}},
  scripting: {executeScript:async options=>{injection=options;return [{result:{ok:true,data:{videoId:'video123'}}}];}}
};
await import('../extension/background.js');
const sender = { id:'test-extension',frameId:0,url:'https://www.youtube.com/watch?v=video123',tab:{id:17} };
const message = (payload,from=sender) => new Promise(resolve=>{const accepted=listener({app:'own-youtube-subtitles',...payload},from,resolve);if(!accepted)resolve(undefined);});

test('toolbar injects both scripts into the clicked tab only', async()=>{
  await onClick({id:17});assert.deepEqual(injection.target,{tabId:17});assert.deepEqual(injection.files,['core.js','panel.js']);
});
test('page data is obtained from the main world of the sending tab',async()=>{
  const r=await message({type:'list'});assert.equal(r.ok,true);assert.equal(injection.world,'MAIN');assert.equal(injection.target.tabId,17);
});
test('obsolete download messages and non-YouTube senders are rejected',async()=>{
  assert.equal((await message({type:'save',text:'x',filename:'a.srt'})).ok,false);
  assert.equal((await message({type:'list'},{...sender,url:'https://example.com/'})).ok,false);
});
test('ignores other extensions, subframes and missing tabs',async()=>{
  for(const other of [{...sender,id:'other'},{...sender,frameId:1},{...sender,tab:null}])assert.equal(await message({type:'list'},other),undefined);
});
