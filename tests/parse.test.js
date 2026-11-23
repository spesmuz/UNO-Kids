const assert = require('assert');
const { parseYouTube, isoDurationToSec } = require('../app.js');

const cases = [
  ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', { type: 'video', id: 'dQw4w9WgXcQ' }],
  ['https://youtu.be/dQw4w9WgXcQ?si=abc', { type: 'video', id: 'dQw4w9WgXcQ' }],
  ['youtube.com/shorts/dQw4w9WgXcQ', { type: 'video', id: 'dQw4w9WgXcQ', short: true }],
  ['https://m.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123', { type: 'video', id: 'dQw4w9WgXcQ' }],
  ['https://www.youtube.com/embed/dQw4w9WgXcQ', { type: 'video', id: 'dQw4w9WgXcQ' }],
  ['https://www.youtube.com/live/dQw4w9WgXcQ', { type: 'video', id: 'dQw4w9WgXcQ' }],
  ['dQw4w9WgXcQ', { type: 'video', id: 'dQw4w9WgXcQ' }],
  ['https://www.youtube.com/playlist?list=PLabc', { type: 'playlist', id: 'PLabc' }],
  ['https://www.youtube.com/channel/UCxyz', { type: 'channel', by: 'id', value: 'UCxyz' }],
  ['https://www.youtube.com/@BabyBus/videos', { type: 'channel', by: 'handle', value: '@BabyBus' }],
  ['https://www.youtube.com/user/foo', { type: 'channel', by: 'username', value: 'foo' }],
  ['https://www.youtube.com/c/Foo', { type: 'channel', by: 'search', value: 'Foo' }],
  ['https://evil.com/watch?v=dQw4w9WgXcQ', null],
  ['https://notyoutube.com/watch?v=dQw4w9WgXcQ', null],
  ['salom', null],
];
for (const [input, expected] of cases) assert.deepStrictEqual(parseYouTube(input), expected, input);
assert.strictEqual(isoDurationToSec('PT1M5S'), 65);
assert.strictEqual(isoDurationToSec('PT1H2M3S'), 3723);
assert.strictEqual(isoDurationToSec('PT45S'), 45);
console.log(`OK: ${cases.length + 3} ta test o'tdi`);
