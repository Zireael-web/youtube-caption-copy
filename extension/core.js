(() => {
  const clean = text => String(text).replace(/\r\n?/g, '\n').replace(/[\u200b\ufeff]/g, '').replace(/[\t ]+\n/g, '\n').trim();
  function normalize(cues) {
    const result = [];
    for (const cue of cues.filter(c => Number.isFinite(c.start) && c.start >= 0 && Number.isFinite(c.end) && c.end > c.start && clean(c.text)).sort((a, b) => a.start - b.start)) {
      const next = { start: Math.round(cue.start), end: Math.max(Math.round(cue.start) + 1, Math.round(cue.end)), text: clean(cue.text) };
      const prev = result.at(-1);
      if (prev && prev.text === next.text && next.start <= prev.end) prev.end = Math.max(prev.end, next.end);
      else result.push(next);
    }
    return result;
  }
  function parseJSON3(data) {
    if (!Array.isArray(data.events)) throw new Error('YouTube вернул неизвестный формат субтитров.');
    const cues = [];
    const nextStarts = new Array(data.events.length);
    let nextStart;
    for (let i = data.events.length - 1; i >= 0; i--) {
      nextStarts[i] = nextStart;
      if (data.events[i].segs?.some(s => s.utf8?.trim())) nextStart = Number(data.events[i].tStartMs);
    }
    for (let i = 0; i < data.events.length; i++) {
      const e = data.events[i];
      const text = (e.segs || []).map(s => s.utf8 || '').join('');
      if (!text.trim()) continue;
      const start = Number(e.tStartMs);
      const duration = Number(e.dDurationMs);
      const end = duration > 0 ? start + duration : nextStarts[i] > start ? nextStarts[i] : start + 2000;
      const prev = cues.at(-1);
      if (e.aAppend && prev && prev.start <= start && start <= prev.end + 50) { prev.text += text; prev.end = Math.max(prev.end, end); }
      else cues.push({ start, end, text });
    }
    return normalize(cues);
  }
  function parseXML(source) {
    const doc = new DOMParser().parseFromString(source, 'text/xml');
    if (doc.querySelector('parsererror') || !['timedtext', 'transcript'].includes(doc.documentElement.tagName)) throw new Error('YouTube вернул повреждённый XML.');
    const legacy = doc.documentElement.tagName === 'transcript';
    const nodes = Array.from(doc.querySelectorAll(legacy ? 'text' : 'body > p'));
    return normalize(nodes.map((node, i) => {
      const start = Number(node.getAttribute(legacy ? 'start' : 't')) * (legacy ? 1000 : 1);
      const duration = Number(node.getAttribute(legacy ? 'dur' : 'd')) * (legacy ? 1000 : 1);
      const next = nodes[i + 1];
      const end = duration > 0 ? start + duration : next ? Number(next.getAttribute(legacy ? 'start' : 't')) * (legacy ? 1000 : 1) : start + 2000;
      return { start, end, text: node.textContent };
    }));
  }
  function parse(source) {
    const body = source.trim();
    if (!body) throw new Error('YouTube вернул пустой текст субтитров.');
    const cues = body.startsWith('{') ? parseJSON3(JSON.parse(body)) : parseXML(body);
    if (!cues.length) throw new Error('В этой дорожке нет текстовых субтитров.');
    return cues;
  }
  function toText(cues) {
    const text = cues.map(cue => clean(cue.text)).filter(Boolean).join('\n');
    if (!text) throw new Error('В этой дорожке нет текста для копирования.');
    return text;
  }
  globalThis.YTSubsCore = Object.freeze({ parse, parseJSON3, normalize, toText });
})();
