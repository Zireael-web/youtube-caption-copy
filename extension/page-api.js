// Serialized by chrome.scripting into MAIN. Keep every dependency inside this function.
export async function pageRequest(request) {
  try {
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    const videoId = () => {
      const url = new URL(location.href);
      return url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]+)/)?.[1];
    };
    const id = videoId();
    if (!id || !['www.youtube.com', 'youtube.com', 'm.youtube.com'].includes(location.hostname))
      throw new Error('Откройте видео на YouTube, затем нажмите значок расширения.');
    if (request.videoId && request.videoId !== id) throw new Error('Видео сменилось. Обновите список субтитров.');
    const player = document.getElementById('movie_player') || document.querySelector('#player video')?.closest('.html5-video-player');
    const text = value => typeof value === 'string' ? value : value?.simpleText || value?.runs?.map(x => x.text).join('') || '';
    let response;
    for (let attempt = 0; attempt < 16; attempt++) {
      let current;
      try { current = player?.getPlayerResponse?.(); } catch { /* player is still loading */ }
      const candidates = [current, document.querySelector('ytd-watch-flexy')?.playerData, window.ytInitialPlayerResponse];
      response = candidates.find(r => r?.videoDetails?.videoId === id);
      if (response && (response.captions || attempt >= 5)) break;
      await delay(250);
      if (videoId() !== id) throw new Error('Видео сменилось. Обновите список субтитров.');
    }
    if (!response) throw new Error('Плеер ещё не готов. Запустите видео и нажмите «Обновить».');
    const captions = response.captions?.playerCaptionsTracklistRenderer;
    const tracks = captions?.captionTracks || [];
    const key = (track, index) => `${index}:${track.vssId || track.languageCode}`;
    if (request.type === 'list') return { ok: true, data: {
      videoId: id, title: response.videoDetails.title || document.title.replace(/ - YouTube$/, ''),
      tracks: tracks.map((t, i) => ({ id: key(t, i), languageCode: t.languageCode, name: text(t.name) || t.languageCode, automatic: t.kind === 'asr', translatable: !!t.isTranslatable })),
      translations: (captions?.translationLanguages || []).map(t => ({ code: t.languageCode, name: text(t.languageName) || t.languageCode }))
    }};
    if (request.type !== 'fetch') throw new Error('Неизвестная команда.');
    const track = tracks.find((t, i) => key(t, i) === request.trackId);
    if (!track) throw new Error('Эта дорожка больше недоступна. Обновите список.');
    const target = request.translation || '';
    if (target && (!track.isTranslatable || !captions.translationLanguages?.some(t => t.languageCode === target)))
      throw new Error('Этот язык автоперевода недоступен для выбранной дорожки.');
    const base = new URL(track.baseUrl);
    const valid = input => {
      try {
        const u = new URL(input, location.href);
        return u.protocol === 'https:' && ['www.youtube.com', 'youtube.com', 'm.youtube.com'].includes(u.hostname) &&
          u.pathname === '/api/timedtext' && u.searchParams.get('v') === id &&
          u.searchParams.get('lang') === track.languageCode && (u.searchParams.get('kind') || '') === (track.kind || '') &&
          (u.searchParams.get('name') || '') === (base.searchParams.get('name') || '') && (u.searchParams.get('tlang') || '') === target;
      } catch { return false; }
    };
    if (target) base.searchParams.set('tlang', target);
    base.searchParams.set('fmt', 'json3');
    if (!valid(base.href)) throw new Error('YouTube вернул неподдерживаемую ссылку субтитров.');
    const usable = body => {
      if (typeof body !== 'string' || body.length > 12_000_000 || !body.trim()) return false;
      try { return JSON.parse(body).events?.some(e => e.segs?.some(s => s.utf8?.trim())); }
      catch { return /^\s*(?:<\?xml[^>]*>\s*)?<(?:timedtext|transcript)[\s>]/.test(body) && /<(?:text|p)[\s>]/.test(body); }
    };
    const nativeFetch = window.fetch;
    let lastHTTP = 0;
    const fetchText = async url => {
      try {
        const result = await nativeFetch.call(window, url, { credentials: 'include', signal: AbortSignal.timeout(4500) });
        lastHTTP = result.status;
        if (!result.ok) return null;
        const body = await result.text();
        return usable(body) ? body : null;
      } catch { return null; }
    };
    // Reuse a request already signed by this video's player, keeping its PO token intact.
    const observed = performance.getEntriesByType('resource').map(e => e.name).filter(valid).reverse();
    let body = observed.length ? await fetchText(observed[0]) : null;
    if (!body) body = await fetchText(base.href);
    let via = 'direct';
    if (!body && lastHTTP !== 429 && player?.setOption && player?.loadModule) {
      // Let YouTube request the chosen track itself. Capture only the matching timedtext response.
      // This short-lived hook is removed and the previous caption selection restored in finally.
      let captured = null;
      const originalOpen = XMLHttpRequest.prototype.open;
      const originalSend = XMLHttpRequest.prototype.send;
      const urls = new WeakMap();
      const listeners = new Map();
      const oldTrack = player.getOption?.('captions', 'track');
      const oldCopy = oldTrack ? { ...oldTrack } : {};
      const wasOn = !!document.querySelector('.ytp-subtitles-button[aria-pressed="true"]');
      const accept = value => { if (usable(value)) captured = value; };
      const wrappedFetch = async function(...args) {
        const result = await nativeFetch.apply(this, args);
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || String(args[0]);
        if (valid(url)) result.clone().text().then(accept).catch(() => {});
        return result;
      };
      const wrappedOpen = function(method, url, ...args) { urls.set(this, String(url)); return originalOpen.call(this, method, url, ...args); };
      const wrappedSend = function(...args) {
        if (valid(urls.get(this))) {
          const xhr = this;
          const listener = () => {
            listeners.delete(xhr);
            try { accept(xhr.responseType === 'json' ? JSON.stringify(xhr.response) : xhr.responseText); } catch { /* binary response */ }
          };
          listeners.set(xhr, listener);
          xhr.addEventListener('load', listener, { once: true });
        }
        return originalSend.apply(this, args);
      };
      try {
        window.fetch = wrappedFetch;
        XMLHttpRequest.prototype.open = wrappedOpen;
        XMLHttpRequest.prototype.send = wrappedSend;
        player.loadModule('captions');
        await delay(200);
        player.setOption('captions', 'track', {});
        const selection = { languageCode: track.languageCode, vssId: track.vssId, kind: track.kind || '', name: text(track.name) };
        if (target) selection.translationLanguage = { languageCode: target };
        player.setOption('captions', 'track', selection);
        for (let i = 0; i < 48 && !captured; i++) {
          if (videoId() !== id) throw new Error('Видео сменилось. Обновите список субтитров.');
          await delay(200);
        }
        body = captured;
        via = 'player';
        if (!body) {
          const fresh = performance.getEntriesByType('resource').map(e => e.name).filter(valid).reverse()[0];
          if (fresh && !observed.includes(fresh)) body = await fetchText(fresh);
        }
      } finally {
        if (window.fetch === wrappedFetch) window.fetch = nativeFetch;
        if (XMLHttpRequest.prototype.open === wrappedOpen) XMLHttpRequest.prototype.open = originalOpen;
        if (XMLHttpRequest.prototype.send === wrappedSend) XMLHttpRequest.prototype.send = originalSend;
        for (const [xhr, listener] of listeners) xhr.removeEventListener('load', listener);
        if (videoId() === id) {
          try { player.setOption('captions', 'track', wasOn ? oldCopy : {}); } catch { /* player may have been disposed */ }
        }
      }
    }
    if (videoId() !== id) throw new Error('Видео сменилось. Обновите список субтитров.');
    if (!body) throw new Error(lastHTTP === 429 ? 'YouTube временно ограничил запросы. Подождите несколько минут и попробуйте снова.' : 'YouTube не отдал текст. Включите выбранный язык через кнопку CC/настройки плеера, запустите видео на несколько секунд и повторите.');
    return { ok: true, data: { body, via, videoId: id } };
  } catch (error) { return { ok: false, error: error.message || 'Не удалось получить субтитры.' }; }
}
