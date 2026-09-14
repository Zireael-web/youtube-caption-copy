(() => {
  if (globalThis.__ownSubtitlesPanel) { globalThis.__ownSubtitlesPanel.close(); return; }
  const core = globalThis.YTSubsCore;
  const host = document.createElement('div');
  host.id = 'own-youtube-subtitles';
  host.style.cssText = 'all:initial!important;position:fixed!important;right:20px!important;top:76px!important;z-index:2147483647!important;';
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `
    :host{color-scheme:dark}*{box-sizing:border-box}button,select,input{font:inherit}button,select{cursor:pointer}
    .panel{width:390px;max-width:calc(100vw - 28px);max-height:calc(100vh - 96px);overflow:auto;background:#14191f;color:#f1f4f7;border:1px solid #39424b;border-radius:18px;box-shadow:0 22px 80px #0009;font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;text-align:left;color-scheme:dark}
    header{display:flex;align-items:center;gap:11px;padding:20px 20px 15px}.logo{display:grid;place-items:center;background:#b9f6ca;color:#142b1c;font-size:16px;font-weight:850;width:37px;height:37px;border-radius:11px}
    h1{font-size:17px;line-height:1.3;margin:0;font-weight:700}.kicker{color:#94a1ad;font-size:11px;letter-spacing:.09em;margin-top:3px}.close{margin-left:auto;font-size:23px;line-height:1;background:none;color:#9ca8b3;padding:7px;border:0;border-radius:8px}
    main{padding:0 20px 20px}.video{background:#1e252d;border:1px solid #303a44;border-radius:11px;padding:12px;margin:0 0 17px;font-size:14px;font-weight:600;overflow-wrap:anywhere}.small{font-size:12px;color:#98a6b4;font-weight:400}.video-id{display:block;margin-top:5px}
    label.field{display:block;margin-top:13px;font-size:12px;font-weight:600;color:#bdc7d0}select{display:block;width:100%;margin-top:6px;border:1px solid #3b4651;border-radius:9px;background:#202830;color:#f1f4f7;padding:10px 30px 10px 10px;min-height:41px;font-size:13px}
    .row{display:flex;gap:10px;align-items:end}.row .field{flex:1}.hint{font-size:11px;color:#94a2af;margin:7px 0 0;line-height:1.5}.check{display:flex;align-items:center;gap:7px;margin:12px 0;color:#aebbc6;font-size:12px}.check input{accent-color:#b9f6ca}
    .actions{display:flex;gap:8px;margin-top:17px}button{border:1px solid #3b4651;background:#242e38;color:#eef3f7;border-radius:9px;padding:10px 12px;font-size:13px;font-weight:600}.primary{flex:1;background:#b9f6ca;border-color:#b9f6ca;color:#102819}button:hover:not(:disabled){filter:brightness(1.13)}button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid #b9f6ca;outline-offset:3px}button:disabled,select:disabled{opacity:.42;cursor:default}
    .status{font-size:12px;min-height:18px;margin:13px 0 0;color:#abb8c4;overflow-wrap:anywhere}.status.error{color:#ffb4ac}.status.success{color:#b9f6ca}.preview{margin-top:15px;border-top:1px solid #303a44;padding-top:13px}.preview-head{display:flex;justify-content:space-between;align-items:center;gap:8px}.copy{padding:5px 9px;font-size:11px}
    .lines{max-height:205px;overflow:auto;margin-top:9px;scrollbar-width:thin}.cue{margin:0 0 10px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;line-height:1.6}.stamp{display:block;font:10px ui-monospace,monospace;color:#84b9a2;margin-bottom:2px}.footer{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #303a44;margin-top:16px;padding-top:12px}.refresh{background:none;border:0;padding:3px 0;font-size:12px;color:#b9f6ca}.local{font-size:10px;color:#82919f}.empty{color:#bac4cd;font-size:13px;line-height:1.6;margin:14px 0}[hidden]{display:none!important}
    @media(max-width:480px){.panel{width:calc(100vw - 28px)}}
  `;
  root.append(style);
  const el = (tag, props = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else node.setAttribute(key, value);
    }
    node.append(...children); return node;
  };
  const closeButton = el('button', { class: 'close', 'aria-label': 'Закрыть субтитры', text: '×', type: 'button' });
  const videoTitle = el('span', { text: 'Читаем текущее видео…' });
  const videoMeta = el('span', { class: 'small video-id' });
  const trackSelect = el('select', { 'aria-label': 'Дорожка субтитров' });
  const translationSelect = el('select', { 'aria-label': 'Автоперевод YouTube' });
  const copyButton = el('button', { class: 'primary', text: 'Копировать текст' });
  const refreshButton = el('button', { class: 'refresh', text: '↻ Обновить' });
  const status = el('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
  const empty = el('p', { class: 'empty', hidden: '' });
  const count = el('span', { class: 'small' });
  const lines = el('div', { class: 'lines', tabindex: '0', 'aria-label': 'Текст субтитров' });
  const preview = el('section', { class: 'preview', hidden: '' }, el('div', { class: 'preview-head' }, count), lines);
  const field = (text, control) => el('label', { class: 'field' }, text, control);
  const controls = el('div', {}, field('ДОРОЖКА ВИДЕО', trackSelect), field('АВТОПЕРЕВОД YOUTUBE', translationSelect), el('p', { class: 'hint', text: 'Автоперевод создаёт YouTube из выбранной дорожки.' }),
    el('div', { class: 'actions' }, copyButton), el('p', { class: 'hint', text: 'Весь текст без таймкодов — сразу в буфер обмена.' }));
  const panel = el('section', { class: 'panel', role: 'dialog', 'aria-label': 'Свои субтитры' },
    el('header', {}, el('span', { class: 'logo', 'aria-hidden': 'true', text: 'CC' }), el('div', {}, el('h1', { text: 'Свои субтитры' }), el('div', { class: 'kicker', text: 'YOUTUBE · В БУФЕР ОБМЕНА' })), closeButton),
    el('main', {}, el('div', { class: 'video' }, videoTitle, videoMeta), empty, controls, status, preview, el('div', { class: 'footer' }, el('span', { class: 'local', text: 'Без аккаунта расширения и аналитики' }), refreshButton)));
  root.append(panel); document.documentElement.append(host);
  let data = null, cues = null, pending = false, revision = 0, disposed = false;
  let lastVideo = currentVideo();
  function currentVideo() { const u = new URL(location.href); return u.pathname === '/watch' ? u.searchParams.get('v') : u.pathname; }
  function message(text, kind = '') { status.textContent = text; status.className = `status ${kind}`; }
  function setBusy(value) {
    pending = value;
    for (const control of [trackSelect, translationSelect, refreshButton, copyButton]) control.disabled = value || (!data?.tracks.length && control !== refreshButton);
    if (!value && data?.tracks.length) translationSelect.disabled = !data.tracks.find(t => t.id === trackSelect.value)?.translatable;
    copyButton.textContent = value ? 'Получаем текст…' : 'Копировать текст';
  }
  async function send(payload) {
    const result = await chrome.runtime.sendMessage({ app: 'own-youtube-subtitles', ...payload });
    if (!result?.ok) throw new Error(result?.error || 'Расширение было обновлено. Перезагрузите страницу YouTube.');
    return result.data;
  }
  function invalidate() { revision++; cues = null; preview.hidden = true; lines.replaceChildren(); message(''); }
  function updateTranslations() {
    const track = data.tracks.find(t => t.id === trackSelect.value);
    translationSelect.replaceChildren(el('option', { value: '', text: 'Без перевода · исходная дорожка' }));
    if (track?.translatable) {
      const names = new Intl.DisplayNames(['ru'], { type: 'language' });
      const translated = data.translations.filter(t => t.code !== track.languageCode).map(t => { let name; try { name = names.of(t.code); } catch { /* YouTube-specific language code */ } return { ...t, label: `${name || t.name} (${t.code})` }; });
      translated.sort((a, b) => a.label.localeCompare(b.label, 'ru'));
      translationSelect.append(...translated.map(t => el('option', { value: t.code, text: t.label })));
    }
    translationSelect.disabled = !track?.translatable;
  }
  async function load() {
    invalidate(); const rev = revision;
    data = null; setBusy(true); controls.hidden = true; empty.hidden = true; videoTitle.textContent = 'Читаем текущее видео…'; videoMeta.textContent = ''; message('Получаем доступные языки…');
    try {
      const result = await send({ type: 'list' });
      if (disposed || rev !== revision) return;
      data = result; videoTitle.textContent = data.title; videoMeta.textContent = `${data.videoId} · дорожек: ${data.tracks.length}`;
      if (!data.tracks.length) { empty.textContent = 'У этого видео нет доступных дорожек субтитров. Если YouTube ещё обрабатывает видео, попробуйте позже.'; empty.hidden = false; message(''); return; }
      trackSelect.replaceChildren(...data.tracks.map(t => el('option', { value: t.id, text: `${t.name} · ${t.automatic ? 'автоматические' : 'дорожка видео'}` })));
      const preferred = data.tracks.find(t => t.languageCode === 'ru' && !t.automatic) || data.tracks.find(t => t.languageCode === 'ru') || data.tracks.find(t => !t.automatic) || data.tracks[0];
      trackSelect.value = preferred.id; updateTranslations(); controls.hidden = false; message('Выберите язык и нажмите «Копировать текст».');
    } catch (error) { if (rev === revision && !disposed) { videoTitle.textContent = 'Субтитры недоступны'; message(error.message, 'error'); } }
    finally { if (rev === revision && !disposed) setBusy(false); }
  }
  function renderPreview() {
    preview.hidden = false;
    const noun = { one: 'фрагмент', few: 'фрагмента', many: 'фрагментов', other: 'фрагмента' }[new Intl.PluralRules('ru').select(cues.length)];
    count.textContent = `${cues.length} ${noun}${cues.length > 200 ? ' · показаны первые 200' : ''}`;
    lines.replaceChildren(...cues.slice(0, 200).map(cue => el('p', { class: 'cue', text: cue.text })));
  }
  async function obtain() {
    if (currentVideo() !== lastVideo) throw new Error('Видео сменилось. Обновите список субтитров.');
    if (cues) return cues;
    const rev = revision;
    message('Получаем текст из YouTube… Это может занять до 25 секунд.');
    const result = await send({ type: 'fetch', videoId: data.videoId, trackId: trackSelect.value, translation: translationSelect.value });
    if (rev !== revision || disposed || currentVideo() !== lastVideo) throw new Error('Видео сменилось. Обновите список субтитров.');
    cues = core.parse(result.body); renderPreview();
    return cues;
  }
  async function copy() {
    if (pending || !data?.tracks.length) return;
    if (currentVideo() !== lastVideo) { checkNavigation(); return; }
    const rev = revision;
    setBusy(true);
    try {
      const result = await obtain();
      if (rev !== revision || disposed) return;
      const text = core.toText(result);
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        throw new Error('Текст готов. Вернитесь на эту вкладку и снова нажмите «Копировать текст».');
      }
      if (rev === revision && !disposed) message(`Скопировано в буфер обмена · ${text.length.toLocaleString('ru')} символов.`, 'success');
    } catch (error) { if (rev === revision && !disposed) message(error.message, 'error'); }
    finally { if (rev === revision && !disposed) setBusy(false); }
  }
  trackSelect.addEventListener('change', () => { invalidate(); updateTranslations(); });
  translationSelect.addEventListener('change', invalidate);
  copyButton.addEventListener('click', copy);
  refreshButton.addEventListener('click', load);
  function checkNavigation() { const next = currentVideo(); if (next !== lastVideo) { lastVideo = next; load(); } }
  document.addEventListener('yt-navigate-finish', checkNavigation);
  const interval = setInterval(checkNavigation, 1000);
  function onKey(event) {
    if (event.key === 'Escape') { event.stopPropagation(); close(); }
    else if (event.key === 'Tab') {
      const focusable = [...root.querySelectorAll('button,select,input,[tabindex="0"]')].filter(n => !n.disabled && n.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && root.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && root.activeElement === last) { event.preventDefault(); first.focus(); }
    } else event.stopPropagation();
  }
  function close() { disposed = true; revision++; clearInterval(interval); document.removeEventListener('yt-navigate-finish', checkNavigation); host.remove(); delete globalThis.__ownSubtitlesPanel; }
  root.addEventListener('keydown', onKey); closeButton.addEventListener('click', close);
  globalThis.__ownSubtitlesPanel = { close };
  closeButton.focus(); load();
})();
