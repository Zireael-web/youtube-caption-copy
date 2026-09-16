import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../extension/core.js';
const c = globalThis.YTSubsCore;
const example = { events: [
  { tStartMs: 1000, dDurationMs: 1600, segs: [{ utf8: 'Привет, ' }, { utf8: 'мир! & <3' }] },
  { tStartMs: 2600, dDurationMs: 1200, segs: [{ utf8: 'Second\nline 🎉' }] }
] };
test('JSON3 preserves Unicode, word segments, literal entities and line breaks', () => {
  assert.deepEqual(c.parse(JSON.stringify(example)), [
    { start: 1000, end: 2600, text: 'Привет, мир! & <3' },
    { start: 2600, end: 3800, text: 'Second\nline 🎉' }
  ]);
});
test('clipboard text has no timecodes, numbering, headers or HTML escaping', () => {
  assert.equal(c.toText(c.parseJSON3(example)), 'Привет, мир! & <3\nSecond\nline 🎉');
});
test('all cues enter the clipboard, including those beyond the preview limit', () => {
  const cues = Array.from({length: 250}, (_, i) => ({text:`Line ${i}`}));
  assert.equal(c.toText(cues).split('\n').length, 250);
  assert.ok(c.toText(cues).endsWith('Line 249'));
});
test('roll-up append events merge, newline control events do not become cues', () => {
  assert.deepEqual(c.parseJSON3({ events: [
    { tStartMs: 0, dDurationMs: 2000, segs: [{ utf8: 'Hello' }] },
    { tStartMs: 500, dDurationMs: 1500, aAppend: 1, segs: [{ utf8: ' world' }] },
    { tStartMs: 2000, segs: [{ utf8: '\n' }] }
  ] }), [{ start: 0, end: 2000, text: 'Hello world' }]);
});
test('adjacent repeating words remain separate, overlapping duplicates merge', () => {
  assert.deepEqual(c.normalize([
    { start: 0, end: 1000, text: 'Yes' }, { start: 500, end: 1300, text: 'Yes' },
    { start: 2000, end: 2300, text: 'Yes' }, { start: -1, end: 1, text: 'bad' }
  ]), [{ start: 0, end: 1300, text: 'Yes' }, { start: 2000, end: 2300, text: 'Yes' }]);
});
test('missing duration uses next text event and never emits zero duration', () => {
  assert.deepEqual(c.parseJSON3({events:[{tStartMs:0,segs:[{utf8:'a'}]}, {tStartMs:3000,segs:[{utf8:'b'}]}]}).map(x=>x.end), [3000,5000]);
});
test('invalid and empty tracks fail instead of copying an empty string', () => {
  assert.throws(() => c.parse(''));
  assert.throws(() => c.parse('{"events":[]}'));
  assert.throws(() => c.parse('{}'));
  assert.throws(() => c.toText([]));
});
