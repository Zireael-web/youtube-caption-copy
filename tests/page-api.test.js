import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { pageRequest } from '../extension/page-api.js';

function fixture({empty = false, status = 200, playerFallback = false, mismatch = false} = {}) {
  const body = JSON.stringify({events:[{tStartMs:0,dDurationMs:1000,segs:[{utf8:'Test caption'}]}]});
  const calls = [], selections = [];
  const response = {videoDetails:{videoId:'video123',title:'A video'},captions:{playerCaptionsTracklistRenderer:{
    captionTracks:[{baseUrl:'https://www.youtube.com/api/timedtext?v=video123&lang=en',languageCode:'en',name:{simpleText:'English'},vssId:'.en',isTranslatable:true}],
    translationLanguages:[{languageCode:'ru',languageName:{simpleText:'Russian'}}]
  }}};
  let triggered = false;
  const sandbox = { URL, AbortSignal, WeakMap, Map, setTimeout: resolve => { resolve(); },
    location: {href:'https://www.youtube.com/watch?v=video123', hostname:'www.youtube.com'},
    performance:{getEntriesByType:()=>[]},
    XMLHttpRequest: class {open(){} send(){}},
    document: {getElementById:()=>player, querySelector:selector=> selector.includes('aria-pressed') ? {} : null},
    fetch: async url => {
      calls.push(url);
      const text = (!empty && (!playerFallback || triggered)) ? body : '';
      return {ok:status===200,status,text:async()=>text,clone(){return this;}};
    }
  };
  sandbox.window = sandbox;
  const player = {
    getPlayerResponse:()=>mismatch ? {...response,videoDetails:{videoId:'oldVideo'}} : response,
    getOption:()=>({languageCode:'de',vssId:'.de'}),loadModule:()=>{},
    setOption:(_module,_option,selection)=>{
      selections.push(selection);
      if(selection.languageCode==='en' && playerFallback){triggered=true; sandbox.fetch('https://www.youtube.com/api/timedtext?v=video123&lang=en&pot=current');}
    }
  };
  const context = vm.createContext(sandbox);
  const run = request => {context.request=request; return vm.runInContext(`(${pageRequest.toString()})(request)`, context);};
  return {run,sandbox,response,calls,selections};
}
test('all source tracks and translation options returned without private URLs', async () => {
  const f=fixture();const r=await f.run({type:'list'});
  assert.equal(r.ok,true);assert.equal(r.data.tracks[0].id,'0:.en');
  assert.equal(r.data.translations[0].code,'ru');assert.equal(JSON.stringify(r).includes('baseUrl'),false);
});
test('direct fetch requests the selected source and translation', async () => {
  const f=fixture();const r=await f.run({type:'fetch',videoId:'video123',trackId:'0:.en',translation:'ru'});
  assert.equal(r.ok,true);assert.match(f.calls[0],/tlang=ru/);assert.match(f.calls[0],/fmt=json3/);
});
test('stale video and removed track never request captions', async () => {
  const f=fixture(); assert.equal((await f.run({type:'fetch',videoId:'different',trackId:'0:.en'})).ok,false);
  assert.equal((await f.run({type:'fetch',videoId:'video123',trackId:'missing'})).ok,false);assert.equal(f.calls.length,0);
});
test('stale player data is rejected after SPA navigation', async () => {
  const f=fixture({mismatch:true});assert.equal((await f.run({type:'list'})).ok,false);
});
test('unadvertised translation and non-YouTube caption URLs are rejected', async () => {
  const f=fixture();assert.equal((await f.run({type:'fetch',trackId:'0:.en',translation:'invented'})).ok,false);
  f.response.captions.playerCaptionsTracklistRenderer.captionTracks[0].baseUrl='https://example.com/api/timedtext?v=video123&lang=en';
  assert.equal((await f.run({type:'fetch',trackId:'0:.en'})).ok,false);assert.equal(f.calls.length,0);
});
test('empty 200 invokes player fallback and restores track and hooks', async () => {
  const f=fixture({playerFallback:true});const fetch=f.sandbox.fetch, open=f.sandbox.XMLHttpRequest.prototype.open;
  const r=await f.run({type:'fetch',trackId:'0:.en'});
  assert.equal(r.ok,true);assert.equal(r.data.via,'player');
  assert.equal(f.selections.at(-1).languageCode,'de');
  assert.equal(f.sandbox.fetch,fetch);assert.equal(f.sandbox.XMLHttpRequest.prototype.open,open);
});
test('empty body gives actionable error; 429 does not start player retry', async () => {
  const f=fixture({empty:true,status:429});const r=await f.run({type:'fetch',trackId:'0:.en'});
  assert.equal(r.ok,false);assert.match(r.error,/ограничил/);assert.equal(f.selections.length,0);
});
