'use strict';
/**
 * Tests for ludeo_verify.js ג€” run with:  node --test
 *
 * The pass fixtures are synthesized here from the marker spec; Unreal/Unity variants are
 * produced by re-wrapping the native lines into each engine's container format, which is
 * exactly what those engines do to the core log stream. Failure cases are in-memory
 * mutations of the pass fixture ג€” nothing failing is committed to disk.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const V = require('./ludeo_verify.js');

// ---------------------------------------------------------------------------
// Synthesized fixtures
// ---------------------------------------------------------------------------

const BANNER = 'LudeoSDK v4.2.3, GitHash:8cc4dad7, Build type:Development, Build Timestamp:2026-08-01 10:00:00 UTC';

function nativeCreatorLines() {
  return [
    `10:00:00:001:Core:LOG: ${BANNER}`,
    '10:00:00:002:Core:LOG: ludeo_Tick: Tick thread is 12345',
    '10:00:00:010:Core:LOG: Async function ludeo_Session_Activate(0x0000a001) (callbackId 1)',
    '10:00:00:500:Core:LOG: ludeo_Session_Activate succeeded. (callbackId 1) ',
    '10:00:00:501:Core:LOG: Entering callbackId 1',
    '10:00:00:502:Core:LOG: Finished callbackId 1',
    '10:00:01:000:Core:LOG: Async function ludeo_Session_OpenRoom(0x0000a001) (callbackId 2)',
    "10:00:01:200:Session:LOG: Session-1: Opening room. roomId='', ludeoId='', threadSafe=false, maxConcurrentWrites=4",
    '10:00:01:400:Core:LOG: ludeo_Session_OpenRoom succeeded. (callbackId 2) ',
    '10:00:01:401:Core:LOG: Entering callbackId 2',
    '10:00:01:402:Core:LOG: Finished callbackId 2',
    '10:00:01:500:Core:LOG: Async function ludeo_Room_AddPlayer(0x0000b001) (callbackId 3)',
    '10:00:01:700:Core:LOG: ludeo_Room_AddPlayer succeeded. (callbackId 3) ',
    '10:00:02:000:Session:LOG: Session-1: Received event RoomReady',
    '10:00:02:001:Core:LOG: Broadcasting RoomReady notification callback callback to 1 subscribers',
    '10:00:02:002:Core:LOG: Entering RoomReady notification callback NotificationId 5 callback',
    '10:00:02:003:Core:LOG: Finished RoomReady notification callback NotificationId 5 callback',
    '10:00:02:100:Core:LOG: Async function ludeo_GameplaySession_Begin(0x0000c001) (callbackId 4)',
    '10:00:02:300:Core:LOG: ludeo_GameplaySession_Begin succeeded. (callbackId 4) ',
    '10:00:03:000:Data:VER: Session-1: state write, 12 attributes',
    '10:00:05:000:Core:LOG: Async function ludeo_GameplaySession_End(0x0000c001) (callbackId 5)',
    '10:00:05:200:Core:LOG: ludeo_GameplaySession_End succeeded. (callbackId 5) ',
    '10:00:05:300:Core:LOG: Async function ludeo_Room_Close(0x0000b001) (callbackId 6)',
    '10:00:05:400:Core:LOG: ludeo_Room_Close succeeded. (callbackId 6) ',
    '10:00:05:500:Core:LOG: Async function ludeo_Session_Release(0x0000a001) (callbackId 7)',
    '10:00:05:600:Core:LOG: ludeo_Session_Release succeeded. (callbackId 7) ',
    '10:00:06:000:Core:LOG: Starting shutdown',
    '10:00:06:100:Core:LOG: Shutdown finished',
  ];
}

function nativePlayerLines() {
  return [
    `10:00:00:001:Core:LOG: ${BANNER}`,
    '10:00:00:010:Core:LOG: Async function ludeo_Session_Activate(0x0000a001) (callbackId 1)',
    '10:00:00:500:Core:LOG: ludeo_Session_Activate succeeded. (callbackId 1) ',
    '10:00:00:600:Session:LOG: Session-1: Received event NewLudeoSelected',
    '10:00:00:601:Core:LOG: Broadcasting LudeoSelected notification callback callback to 1 subscribers',
    '10:00:00:700:Core:LOG: Async function ludeo_Session_GetLudeo(0x0000a001) (callbackId 2)',
    '10:00:01:000:Core:LOG: ludeo_Session_GetLudeo succeeded. (callbackId 2) ',
    '10:00:01:100:Core:LOG: Async function ludeo_Session_OpenRoom(0x0000a001) (callbackId 3)',
    '10:00:01:400:Core:LOG: ludeo_Session_OpenRoom succeeded. (callbackId 3) ',
    '10:00:01:500:Core:LOG: Async function ludeo_Room_AddPlayer(0x0000b001) (callbackId 4)',
    '10:00:01:700:Core:LOG: ludeo_Room_AddPlayer succeeded. (callbackId 4) ',
    '10:00:02:000:Core:LOG: Broadcasting RoomReady notification callback callback to 1 subscribers',
    '10:00:02:100:Core:LOG: Async function ludeo_GameplaySession_Begin(0x0000c001) (callbackId 5)',
    '10:00:02:300:Core:LOG: ludeo_GameplaySession_Begin succeeded. (callbackId 5) ',
    '10:00:05:000:Core:LOG: Async function ludeo_GameplaySession_End(0x0000c001) (callbackId 6)',
    '10:00:05:200:Core:LOG: ludeo_GameplaySession_End succeeded. (callbackId 6) ',
    '10:00:06:000:Core:LOG: Starting shutdown',
    '10:00:06:100:Core:LOG: Shutdown finished',
  ];
}

const NATIVE_LEVEL_TO_NAME = { LOG: 'Log', VER: 'Verbose', VVE: 'VeryVerbose', WRN: 'Warning', ERR: 'Error', FTL: 'Fatal' };
const NATIVE_RE = /^(\d{2}):(\d{2}):(\d{2}):(\d{3}):([^:]+):(LOG|WRN|ERR|VER|VVE|FTL): ?(.*)$/;

/** Re-wrap native lines the way the Unreal plugin does: [ts][frame][Ludeo] Cat: [Verbosity: ]msg */
function toUnreal(lines) {
  return lines.map((line, i) => {
    const m = NATIVE_RE.exec(line);
    if (!m) return line;
    const verbosity = m[6] === 'LOG' ? '' : `${NATIVE_LEVEL_TO_NAME[m[6]]}: `;
    return `[2026.08.10-${m[1]}.${m[2]}.${m[3]}:${m[4]}][${String(i).padStart(3)}][Ludeo] ${m[5]}: ${verbosity}${m[7]}`;
  });
}

/** Re-wrap native lines the way the Unity plugin does: ts:Cat:LevelName msg (space separator) */
function toUnity(lines) {
  return lines.map((line) => {
    const m = NATIVE_RE.exec(line);
    if (!m) return line;
    return `${m[1]}:${m[2]}:${m[3]}:${m[4]}:${m[5]}:${NATIVE_LEVEL_TO_NAME[m[6]]} ${m[7]}`;
  });
}

/** Re-wrap native lines the way a native game's own logger does (e.g. VVVVVV): `[INFO] [Ludeo] msg` */
function toCustom(lines) {
  const tag = { LOG: '[INFO]', VER: '[INFO]', VVE: '[INFO]', WRN: '[WARN]', ERR: '[ERROR]', FTL: '[ERROR]' };
  return lines.map((line) => {
    const m = NATIVE_RE.exec(line);
    if (!m) return line;
    return `${tag[m[6]]} [Ludeo] ${m[7]}`;
  });
}

function interleaveNoise(lines) {
  const noise = ['LogTemp: some game log line', '', 'random garbage 123', '[2026.08.10-10.00.00:000][  0]LogInit: engine line'];
  const out = [];
  lines.forEach((l, i) => { out.push(l); out.push(noise[i % noise.length]); });
  return out;
}

function byId(res, id) {
  const all = res.checks.concat(res.steps);
  return all.find((c) => c.id === id);
}

// ---------------------------------------------------------------------------
// Parsing & normalization
// ---------------------------------------------------------------------------

test('native pass log parses with banner and format', () => {
  const p = V.parseLog(nativeCreatorLines().join('\n'));
  assert.strictEqual(p.format, 'native');
  assert.strictEqual(p.sdk.version, '4.2.3');
  assert.strictEqual(p.sdk.gitHash, '8cc4dad7');
  assert.strictEqual(p.sdk.buildType, 'Development');
  assert.strictEqual(p.ludeoLines, nativeCreatorLines().length);
});

test('unreal container parses identically, noise skipped', () => {
  const p = V.parseLog(interleaveNoise(toUnreal(nativeCreatorLines())).join('\n'));
  assert.strictEqual(p.format, 'unreal');
  assert.strictEqual(p.ludeoLines, nativeCreatorLines().length);
  assert.strictEqual(p.sdk.version, '4.2.3');
});

test('unity container parses identically, noise skipped', () => {
  const p = V.parseLog(interleaveNoise(toUnity(nativeCreatorLines())).join('\n'));
  assert.strictEqual(p.format, 'unity');
  assert.strictEqual(p.ludeoLines, nativeCreatorLines().length);
  assert.strictEqual(p.sdk.version, '4.2.3');
});

test('custom game-logger container (e.g. VVVVVV [INFO] [Ludeo]) parses and passes', () => {
  const wrapped = interleaveNoise(toCustom(nativeCreatorLines()));
  const p = V.parseLog(wrapped.join('\n'));
  assert.strictEqual(p.format, 'custom');
  assert.strictEqual(p.sdk.version, '4.2.3');
  assert.strictEqual(p.ludeoLines, nativeCreatorLines().length);
  // level inference from the game's own prefix
  const err = V.parseLog('[ERROR] [Ludeo] something bad').events[0];
  assert.strictEqual(err.level, 'ERR');
  // full creator verdict still works ג€” markers live in the message text
  const res = V.verify(wrapped.join('\n'), 'creator');
  assert.strictEqual(res.result, 'pass', JSON.stringify(res.checks.concat(res.steps).filter((c) => c.status !== 'pass')));
});

test('terminal lines appearing before their issue line still pair (thread-scrambled logs)', () => {
  const lines = nativeCreatorLines();
  const issueIdx = lines.findIndex((l) => l.includes('Async function ludeo_Session_OpenRoom'));
  const okIdx = lines.findIndex((l) => l.includes('ludeo_Session_OpenRoom succeeded'));
  [lines[issueIdx], lines[okIdx]] = [lines[okIdx], lines[issueIdx]];
  const res = V.verify(lines.join('\n'), 'creator');
  assert.strictEqual(byId(res, 'async-terminal').status, 'pass');
});

test('unreal warning/error verbosity tokens map to WRN/ERR', () => {
  const lines = toUnreal([
    '10:00:00:001:Http:WRN: retrying request',
    '10:00:00:002:Session:ERR: bad thing',
  ]);
  const p = V.parseLog(lines.join('\n'));
  assert.strictEqual(p.events[0].level, 'WRN');
  assert.strictEqual(p.events[1].level, 'ERR');
  assert.strictEqual(p.events[0].category, 'Http');
});

// ---------------------------------------------------------------------------
// Happy paths
// ---------------------------------------------------------------------------

test('creator scenario passes on the creator log (all 3 containers)', () => {
  for (const wrap of [(x) => x, toUnreal, toUnity]) {
    const res = V.verify(wrap(nativeCreatorLines()).join('\n'), 'creator');
    assert.strictEqual(res.result, 'pass', JSON.stringify(res.checks.concat(res.steps).filter((c) => c.status !== 'pass')));
    assert.strictEqual(res.counts.failed, 0);
  }
});

test('player scenario passes on the player log', () => {
  const res = V.verify(nativePlayerLines().join('\n'), 'player');
  assert.strictEqual(res.result, 'pass', JSON.stringify(res.checks.concat(res.steps).filter((c) => c.status !== 'pass')));
});

test('data activity is skipped when log has no verbose lines', () => {
  const lines = nativeCreatorLines().filter((l) => !l.includes(':Data:VER:'));
  const res = V.verify(lines.join('\n'), 'creator');
  const da = byId(res, 'data-activity');
  assert.strictEqual(da.status, 'pass');
  assert.match(da.detail, /Skipped/);
});

// ---------------------------------------------------------------------------
// Failure mutations
// ---------------------------------------------------------------------------

test('dropping a succeeded terminal fails async-terminal and the step', () => {
  const lines = nativeCreatorLines().filter((l) => !l.includes('ludeo_Session_OpenRoom succeeded'));
  const res = V.verify(lines.join('\n'), 'creator');
  assert.strictEqual(res.result, 'fail');
  assert.strictEqual(byId(res, 'async-terminal').status, 'fail');
  const missing = res.steps.find((s) => s.detail.includes('ludeo_Session_OpenRoom'));
  assert.strictEqual(missing.status, 'fail');
});

test('out-of-order lifecycle is detected', () => {
  const lines = nativeCreatorLines();
  const addPlayerIdx = lines.findIndex((l) => l.includes('ludeo_Room_AddPlayer succeeded'));
  const openRoomIdx = lines.findIndex((l) => l.includes('ludeo_Session_OpenRoom succeeded'));
  [lines[addPlayerIdx], lines[openRoomIdx]] = [lines[openRoomIdx], lines[addPlayerIdx]];
  const res = V.verify(lines.join('\n'), 'creator');
  assert.strictEqual(res.result, 'fail');
  assert.ok(res.steps.some((s) => s.status === 'fail' && s.detail.includes('out of order')), JSON.stringify(res.steps));
});

test('a failed API call fails async-failures', () => {
  const lines = nativeCreatorLines().map((l) =>
    l.includes('ludeo_GameplaySession_Begin succeeded')
      ? '10:00:02:300:Core:ERR: ludeo_GameplaySession_Begin failed with LudeoResult::WrongState. (callbackId 4)'
      : l);
  const res = V.verify(lines.join('\n'), 'creator');
  const af = byId(res, 'async-failures');
  assert.strictEqual(af.status, 'fail');
  assert.match(af.detail, /WrongState/);
  // the ERR line must not be double-reported by error-scan
  assert.notStrictEqual(byId(res, 'error-scan').status, 'fail');
});

test('injected SDK error fails error-scan; Coherent noise does not', () => {
  const lines = nativeCreatorLines().slice();
  lines.splice(20, 0, '10:00:04:000:Coherent:WRN: CSS parse noise from overlay');
  let res = V.verify(lines.join('\n'), 'creator');
  assert.strictEqual(byId(res, 'error-scan').status, 'pass');

  lines.splice(20, 0, '10:00:04:001:Http:ERR: request to /game-sessions/begin failed: 500');
  res = V.verify(lines.join('\n'), 'creator');
  assert.strictEqual(byId(res, 'error-scan').status, 'fail');
  assert.strictEqual(res.result, 'fail');
});

test('missing Shutdown finished fails clean-shutdown', () => {
  const lines = nativeCreatorLines().filter((l) => !l.includes('Shutdown finished'));
  const res = V.verify(lines.join('\n'), 'creator');
  assert.strictEqual(byId(res, 'clean-shutdown').status, 'fail');
});

test('never calling shutdown fails clean-shutdown with its own message', () => {
  const lines = nativeCreatorLines().filter((l) => !l.includes('shutdown') && !l.includes('Shutdown'));
  const res = V.verify(lines.join('\n'), 'creator');
  const cs = byId(res, 'clean-shutdown');
  assert.strictEqual(cs.status, 'fail');
  assert.match(cs.detail, /never called/);
});

test('missing required notification handler fails; optional one only warns', () => {
  const base = nativeCreatorLines();
  let lines = base.slice();
  lines.splice(3, 0, '10:00:00:400:Core:LOG: No callback has been registered to RoomReady');
  let res = V.verify(lines.join('\n'), 'creator');
  assert.strictEqual(byId(res, 'notify-audit').status, 'fail');

  lines = base.slice();
  lines.splice(3, 0, '10:00:00:400:Core:LOG: No callback has been registered to ConsentUpdated');
  res = V.verify(lines.join('\n'), 'creator');
  assert.strictEqual(byId(res, 'notify-audit').status, 'warn');
  assert.strictEqual(res.result, 'pass');
});

test('leaked handles warn (and are not double-reported as errors)', () => {
  const lines = nativeCreatorLines().slice();
  const at = lines.findIndex((l) => l.includes('Starting shutdown')) + 1;
  lines.splice(at, 0,
    '10:00:06:050:Core:WRN: 2 Interfaces still alive at shutdown. See list below.',
    '10:00:06:051:Core:ERR: Client still holding a handle to a DataReader instance');
  const res = V.verify(lines.join('\n'), 'creator');
  assert.strictEqual(byId(res, 'leaks').status, 'warn');
  assert.notStrictEqual(byId(res, 'error-scan').status, 'fail');
  assert.strictEqual(res.result, 'pass');
});

test('call in flight during shutdown is a warn, not a fail', () => {
  const lines = nativeCreatorLines().slice();
  const at = lines.findIndex((l) => l.includes('Starting shutdown')) + 1;
  lines.splice(at, 0, '10:00:06:050:Core:LOG: Async function ludeo_Session_Release(0x0000a001) (callbackId 99)');
  const res = V.verify(lines.join('\n'), 'creator');
  assert.strictEqual(byId(res, 'async-terminal').status, 'warn');
  assert.strictEqual(res.result, 'pass');
});

test('Canceled results during shutdown warn; before shutdown they fail', () => {
  const base = nativeCreatorLines();
  // canceled after Starting shutdown (quit-in-flight) ג†’ warn, run still passes
  let lines = base.slice();
  let at = lines.findIndex((l) => l.includes('Starting shutdown')) + 1;
  lines.splice(at, 0,
    '10:00:06:050:Core:ERR: ludeo_Session_Release failed with LudeoResult::Canceled. (callbackId 8)',
    '10:00:06:051:Session:ERR: Session-1:T7_SessionDestroyTask: Finished with LudeoResult::Canceled');
  let res = V.verify(lines.join('\n'), 'creator');
  assert.strictEqual(byId(res, 'async-failures').status, 'warn');
  assert.notStrictEqual(byId(res, 'error-scan').status, 'fail');
  assert.strictEqual(res.result, 'pass');

  // canceled before shutdown ג†’ real failure
  lines = base.slice();
  lines.splice(10, 0, '10:00:01:450:Core:ERR: ludeo_Session_GetLudeo failed with LudeoResult::Canceled. (callbackId 9)');
  res = V.verify(lines.join('\n'), 'creator');
  assert.strictEqual(byId(res, 'async-failures').status, 'fail');
});

test('game callback that never returns fails callback-return', () => {
  const lines = nativeCreatorLines().filter((l) => !l.includes('Finished callbackId 2'));
  const res = V.verify(lines.join('\n'), 'creator');
  assert.strictEqual(byId(res, 'callback-return').status, 'fail');
});

test('callback-return pairs Finished before Entering (thread-scrambled logs)', () => {
  const lines = nativeCreatorLines();
  const enterIdx = lines.findIndex((l) => l.includes('Entering callbackId 1'));
  const finishIdx = lines.findIndex((l) => l.includes('Finished callbackId 1'));
  [lines[enterIdx], lines[finishIdx]] = [lines[finishIdx], lines[enterIdx]];
  const res = V.verify(lines.join('\n'), 'creator');
  assert.strictEqual(byId(res, 'callback-return').status, 'pass');
});

// The SDK uses 4294967295 (UINT32_MAX) as a non-unique sentinel callbackId for calls that
// complete inline — e.g. ludeo_Session_MarkHighlight — so one id can legitimately repeat.
test('repeated sentinel callbackId is counted, not overwritten', () => {
  const base = nativeCreatorLines();
  const at = base.findIndex((l) => l.includes('Data:VER'));

  const balanced = base.slice();
  balanced.splice(at, 0,
    '10:00:03:001:Core:LOG: Entering callbackId 4294967295',
    '10:00:03:002:Core:LOG: Finished callbackId 4294967295',
    '10:00:03:003:Core:LOG: Entering callbackId 4294967295',
    '10:00:03:004:Core:LOG: Finished callbackId 4294967295');
  assert.strictEqual(byId(V.verify(balanced.join('\n'), 'creator'), 'callback-return').status, 'pass');

  const unbalanced = base.slice();
  unbalanced.splice(at, 0,
    '10:00:03:001:Core:LOG: Entering callbackId 4294967295',
    '10:00:03:002:Core:LOG: Entering callbackId 4294967295',
    '10:00:03:003:Core:LOG: Finished callbackId 4294967295');
  const cb = byId(V.verify(unbalanced.join('\n'), 'creator'), 'callback-return');
  assert.strictEqual(cb.status, 'fail');
  assert.match(cb.detail, /4294967295/);
});

test('repeated sentinel callbackId is counted by async-terminal too', () => {
  const lines = nativeCreatorLines().slice();
  const at = lines.findIndex((l) => l.includes('Data:VER'));
  lines.splice(at, 0,
    '10:00:03:001:Core:LOG: Async function ludeo_Session_MarkHighlight(0x1) (callbackId 4294967295)',
    '10:00:03:002:Core:LOG: Async function ludeo_Session_MarkHighlight(0x1) (callbackId 4294967295)',
    '10:00:03:003:Core:LOG: ludeo_Session_MarkHighlight succeeded. (callbackId 4294967295) ');
  const at2 = byId(V.verify(lines.join('\n'), 'creator'), 'async-terminal');
  assert.strictEqual(at2.status, 'fail');
  assert.match(at2.detail, /MarkHighlight/);
});

// NotificationIds are only unique per notification name — the real SDK hands RoomReady and
// Highlight the same NotificationId 5 — so a name+id key is required.
test('same NotificationId under a different name is a separate callback', () => {
  const lines = nativeCreatorLines().slice();
  const at = lines.findIndex((l) => l.includes('Data:VER'));
  lines.splice(at, 0, '10:00:03:001:Core:LOG: Entering Highlight notification callback NotificationId 5 callback');
  const cb = byId(V.verify(lines.join('\n'), 'creator'), 'callback-return');
  assert.strictEqual(cb.status, 'fail');
  assert.match(cb.detail, /Highlight NotificationId 5/);
});

test('error-scan discloses how many errors it did not list', () => {
  const lines = nativeCreatorLines().slice();
  for (let i = 0; i < 25; i++) lines.push(`10:00:0${i % 10}:00${i % 10}:Http:ERR: distinct failure ${i}`);
  const es = byId(V.verify(lines.join('\n'), 'creator'), 'error-scan');
  assert.strictEqual(es.status, 'fail');
  assert.match(es.detail, /^25 SDK error\(s\)/);
  assert.match(es.detail, /\(\+5 more not shown\)/);
});

test('low-verbosity log fails the verbosity check', () => {
  const lines = nativeCreatorLines().filter((l) => !/Async function|succeeded\./.test(l));
  const res = V.verify(lines.join('\n'), 'creator');
  assert.strictEqual(byId(res, 'verbosity').status, 'fail');
});

test('credentials in log produce the secrets warning', () => {
  const lines = nativeCreatorLines().slice();
  lines.splice(2, 0, '10:00:00:005:Session:LOG: Session-1: detected runtime var LUDEO_AUTH_TOKEN:"eyJhbGciOi..."');
  const res = V.verify(lines.join('\n'), 'creator');
  const s = byId(res, 'secrets');
  assert.strictEqual(s.status, 'warn');
  assert.ok(!s.detail.includes('eyJhbGciOi'), 'secret value must not be echoed');
});

test('auth tokens in websocket URLs and request bodies trigger the secrets warning', () => {
  const lines = nativeCreatorLines().slice();
  lines.splice(2, 0,
    '10:00:00:006:Http:LOG: Session-1:TextWS: Starting websocket for wss://echo.ludeo.com/websockets?socket_type=text&token=SECRETTOKEN123&principal_id=abc',
    '10:00:00:007:Http:LOG: Session-1:HTTP:Req0_0: POST,https://services.ludeo.com/api/v3/users/auth, data={"authSource":"Steam","authToken":"SECRETBODY456"}'); // gitleaks:allow — synthetic fixture for the secrets check
  const res = V.verify(lines.join('\n'), 'creator');
  const s = byId(res, 'secrets');
  assert.strictEqual(s.status, 'warn');
  assert.match(s.detail, /auth token in URL/);
  assert.match(s.detail, /auth token in request body/);
  assert.ok(!s.detail.includes('SECRETTOKEN123') && !s.detail.includes('SECRETBODY456'));
});

test('player scenario without a selection trigger fails that step', () => {
  const lines = nativePlayerLines().filter((l) => !l.includes('NewLudeoSelected') && !l.includes('LudeoSelected notification'));
  const res = V.verify(lines.join('\n'), 'player');
  assert.strictEqual(res.result, 'fail');
  assert.ok(res.steps.some((s) => s.status === 'fail' && s.detail.includes('selection trigger')));
});

test('tick threading problems warn', () => {
  const lines = nativeCreatorLines().slice();
  lines.splice(5, 0, '10:00:00:600:Core:ERR: ludeo_Tick: Recursive call to ludeo_Tick/ludeo_Shutdown detected. This is logged just once to reduce noise.');
  const res = V.verify(lines.join('\n'), 'creator');
  assert.strictEqual(byId(res, 'tick-thread').status, 'warn');
  assert.notStrictEqual(byId(res, 'error-scan').status, 'fail');
});

test('non-ludeo input is unusable', () => {
  const res = V.verify('hello\nworld\nLogTemp: nothing here\n', 'creator');
  assert.strictEqual(res.usable, false);
  assert.strictEqual(res.result, 'unusable');
});

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

test('toJson has the agreed shape', () => {
  const res = V.verify(nativeCreatorLines().join('\n'), 'creator');
  const j = V.toJson(res, 'x.log');
  assert.strictEqual(j.file, 'x.log');
  assert.strictEqual(j.result, 'pass');
  assert.strictEqual(j.sdk_version, '4.2.3');
  assert.ok(Array.isArray(j.checks) && j.checks.length > 0);
  for (const c of j.checks) {
    assert.ok(['pass', 'warn', 'fail'].includes(c.status));
    assert.ok(typeof c.id === 'string' && typeof c.detail === 'string');
  }
});

test('instructions render for every engine and mention the log location', () => {
  for (const [engine, needle] of [['unreal', 'Saved\\Logs'], ['unity', 'Player.log'], ['native', 'LudeoSDK.log']]) {
    const text = V.instructionsText(engine, 'creator');
    assert.ok(text.includes(needle), `${engine} instructions must mention ${needle}`);
  }
  assert.ok(V.instructionsText(null, 'player').includes('activation-ludeoid'));
});

// ---------------------------------------------------------------------------
// CLI end-to-end (exit codes + JSON)
// ---------------------------------------------------------------------------

function runCli(args, input) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ludeo-verify-'));
  const file = path.join(tmp, 'test.log');
  fs.writeFileSync(file, input);
  try {
    const out = execFileSync(process.execPath, [path.join(__dirname, 'ludeo_verify.js'), ...args, file], { encoding: 'utf8' });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status, out: String(err.stdout || '') };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

test('CLI: pass ג†’ exit 0, fail ג†’ exit 1, garbage ג†’ exit 2', () => {
  assert.strictEqual(runCli(['check'], nativeCreatorLines().join('\n')).code, 0);
  const failing = nativeCreatorLines().filter((l) => !l.includes('Shutdown finished')).join('\n');
  assert.strictEqual(runCli(['check'], failing).code, 1);
  assert.strictEqual(runCli(['check'], 'not a ludeo log').code, 2);
});

test('CLI: --json emits valid JSON with result', () => {
  const r = runCli(['check', '--json', '--scenario', 'creator'], nativeCreatorLines().join('\n'));
  assert.strictEqual(r.code, 0);
  const j = JSON.parse(r.out);
  assert.strictEqual(j.result, 'pass');
  assert.strictEqual(j.scenario, 'creator');
});

// ---------------------------------------------------------------------------
// Golden fixture (only when present ג€” see README for how to generate it)
// ---------------------------------------------------------------------------

test('golden fixture passes, when available', (t) => {
  const fixture = path.join(__dirname, 'fixtures', 'native_creator_pass.log.txt');
  if (!fs.existsSync(fixture)) {
    t.skip('fixtures/native_creator_pass.log.txt not generated yet');
    return;
  }
  const res = V.verify(fs.readFileSync(fixture, 'utf8'), 'creator');
  assert.strictEqual(res.result, 'pass', JSON.stringify(res.checks.concat(res.steps).filter((c) => c.status !== 'pass')));
});

// Real-world regression fixture: a scrubbed real Unity creator run with KNOWN findings.
// If marker parsing ever regresses, these exact verdicts change.
test('real scrubbed Unity creator log produces the known verdict', (t) => {
  const fixture = path.join(__dirname, 'fixtures', 'unity_creator_real.log.txt');
  if (!fs.existsSync(fixture)) {
    t.skip('fixtures/unity_creator_real.log.txt not present');
    return;
  }
  const res = V.verify(fs.readFileSync(fixture, 'utf8'), 'creator');
  assert.strictEqual(res.usable, true);
  assert.strictEqual(res.format, 'unity');
  assert.strictEqual(res.sdk.version, '4.2.4.0');
  assert.strictEqual(res.result, 'fail');
  // Known real findings in this run:
  assert.strictEqual(byId(res, 'async-failures').status, 'warn');      // Session_Release canceled at quit
  assert.strictEqual(byId(res, 'error-scan').status, 'fail');          // backend 503s during the run
  assert.strictEqual(byId(res, 'leaks').status, 'warn');               // Room handle never released
  assert.strictEqual(byId(res, 'notify-audit').status, 'warn');        // SnapshotRequest unregistered
  assert.strictEqual(byId(res, 'secrets').status, 'warn');             // ws token in Http URLs (scrubbed here)
  assert.strictEqual(byId(res, 'clean-shutdown').status, 'pass');
  const endStep = res.steps.find((s) => s.detail.includes('ludeo_GameplaySession_End'));
  assert.strictEqual(endStep.status, 'fail');                          // End is never called ג€” real bug
});
