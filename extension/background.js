import { pageRequest } from './page-api.js';

const youtube = url => { try { return new URL(url).protocol === 'https:' && ['www.youtube.com', 'youtube.com', 'm.youtube.com'].includes(new URL(url).hostname); } catch { return false; } };
const busy = new Set();

chrome.action.onClicked.addListener(async tab => {
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['core.js', 'panel.js'] });
    await chrome.action.setBadgeText({ tabId: tab.id, text: '' });
  } catch {
    await chrome.action.setBadgeText({ tabId: tab.id, text: 'YT' });
    await chrome.action.setTitle({ tabId: tab.id, title: 'Откройте видео YouTube и снова нажмите значок расширения' });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.app !== 'own-youtube-subtitles' || sender.id !== chrome.runtime.id || !sender.tab || sender.frameId !== 0) return;
  (async () => {
    if (!youtube(sender.url)) throw new Error('Откройте видео на YouTube, затем нажмите «Обновить».');
    if (!['list', 'fetch'].includes(message.type)) throw new Error('Неизвестная команда.');
    const tabId = sender.tab.id;
    if (message.type === 'fetch' && busy.has(tabId)) throw new Error('Предыдущий запрос ещё выполняется. Подождите несколько секунд.');
    if (message.type === 'fetch') busy.add(tabId);
    try {
      const results = await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', func: pageRequest, args: [{ type: message.type, videoId: message.videoId, trackId: message.trackId, translation: message.translation }] });
      if (!results[0]?.result) throw new Error('Не удалось связаться с плеером. Обновите страницу YouTube.');
      return results[0].result;
    } finally { if (message.type === 'fetch') busy.delete(tabId); }
  })().then(sendResponse).catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
});
