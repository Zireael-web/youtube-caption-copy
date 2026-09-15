const json = JSON.stringify({ events: [{tStartMs:1250,dDurationMs:1750,segs:[{utf8:'Привет, мир! & <3'}]},{tStartMs:3200,dDurationMs:1800,segs:[{utf8:'Вторая строка 🎉'}]}] });
const xml = '<?xml version="1.0"?><timedtext><body><p t="1250" d="1750"><s>Привет &amp; </s><s>&lt;мир&gt;</s></p><p t="3200" d="1800">Строка 🎉</p></body></timedtext>';
window.chrome = { runtime: { sendMessage: async request => {
  const scenario = document.getElementById('scenario').value;
  if (request.type === 'list') return {ok:true,data:{videoId:'test123',title:'Тестовое видео · языки, таймкоды и Unicode',tracks:scenario==='empty'?[]:[{id:'en',name:'English',languageCode:'en',translatable:true},{id:'ru',name:'Русский',languageCode:'ru',automatic:true,translatable:true}],translations:[{code:'ru',name:'Russian'},{code:'de',name:'German'}]}};
  if (request.type === 'fetch') return scenario === 'error' ? {ok:false,error:'YouTube временно ограничил запросы.'} : {ok:true,data:{body:scenario==='xml'?xml:json,videoId:'test123'}};
}}};
document.getElementById('open').addEventListener('click',()=>{const script=document.createElement('script');script.src='../extension/panel.js';script.onload=()=>script.remove();document.body.append(script);});
document.getElementById('paste-check').addEventListener('input', event => {
  const text = event.target.value;
  document.getElementById('paste-summary').textContent = `Вставлено: ${text.length} символов, ${text.split('\n').length} строк. Таймкоды: ${/\d{2}:\d{2}:\d{2}[,.]\d{3}/.test(text) ? 'есть' : 'нет'}.`;
});
