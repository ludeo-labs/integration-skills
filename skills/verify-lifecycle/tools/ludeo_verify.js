/**
 * Ludeo SDK Integration Verifier
 *
 * One file, two consumers:
 *   - Studios:  open LudeoVerify.html (same folder) and drag a log file in. No install.
 *   - CI/agents: node ludeo_verify.js check <logfile> [--scenario creator|player] [--json]
 *                node ludeo_verify.js instructions [--engine unity|unreal|native] [--scenario creator|player]
 *
 * The verifier reads the core Ludeo SDK log content (identical across engines) from any of
 * its four container formats and asserts the SDK lifecycle happened correctly and in order.
 *
 * The log format is contractual: the Ludeo backend parses it and LudeoSDK
 * Source/Infra/Ludeo/Infra/Misc/Logging.h forbids changing it. Container-format regexes are
 * copied from LudeoSDK/Tool/LudeoSDKLogFilter.html; lifecycle marker strings are verified
 * against the SDK source (TaskManager.h, CallChecks.h, Notifications.h, SessionImpl.h/.cpp,
 * Init.cpp, InterfaceManager.cpp) at SDK v4.2.3.
 *
 * Exit codes (CLI): 0 = pass (warnings allowed), 1 = at least one FAIL, 2 = unusable input.
 */
'use strict';

// ---------------------------------------------------------------------------
// Container-format parsing
// ---------------------------------------------------------------------------

// Native core format, e.g. `14:22:31:045:Session:LOG: Session-1: Received event RoomReady`
// (regex from LudeoSDK/Tool/LudeoSDKLogFilter.html)
var RE_NATIVE = /^(\d{2}):(\d{2}):(\d{2}):(\d{3}):([^:]+):(LOG|WRN|ERR|VER|VVE|FTL): ?(.*)$/;

// Unreal output log, e.g. `[2026.08.10-12.00.00:123][412][Ludeo] Session: Warning: <msg>`
// (regex from LudeoSDK/Tool/LudeoSDKLogFilter.html; absent verbosity token means Log)
var RE_UNREAL = /^\[\d{4}\.\d{2}\.\d{2}-(\d{2})\.(\d{2})\.(\d{2}):(\d{3})\]\[\s*\d+\]\[Ludeo\] ([^:]+):(?:\s*(Warning|Error|Verbose|VeryVerbose|Fatal))?:? ?(.*)$/;

// Unity Player.log lines produced by LudeoLogManager.InvokeLogCallbackWithLudeoMessage:
// `{HH:MM:SS:mmm}:{Category}:{LevelName} {msg}` — note space (not colon) before the message.
var RE_UNITY = /^(\d{2}):(\d{2}):(\d{2}):(\d{3}):([^:]+):(Fatal|Error|Warning|Log|Verbose|VeryVerbose) (.*)$/;

// Custom-logger fallback: native games often route the SDK through their own logger via a
// LudeoLogCallback, e.g. `[INFO] [Ludeo] <message>`. Tried LAST — the specific formats above win.
// SDK category/verbosity are not preserved; level is inferred from the game's own prefix.
var RE_CUSTOM = /^(.*?)\[Ludeo\]\s?(.*)$/;

function customPrefixLevel(prefix) {
  if (/fatal/i.test(prefix)) return 'FTL';
  if (/err/i.test(prefix)) return 'ERR';
  if (/warn/i.test(prefix)) return 'WRN';
  return 'LOG';
}

var LEVEL_FROM_NAME = {
  Fatal: 'FTL', Error: 'ERR', Warning: 'WRN', Log: 'LOG', Verbose: 'VER', VeryVerbose: 'VVE',
  FTL: 'FTL', ERR: 'ERR', WRN: 'WRN', LOG: 'LOG', VER: 'VER', VVE: 'VVE',
};

/**
 * Parses raw log text into a normalized event stream.
 * Returns { events, format, totalLines, ludeoLines, sdk }.
 * Each event: { lineno, category, level, message } — order is file order.
 */
function parseLog(text) {
  // Tolerate a UTF-8 BOM (files re-saved by editors/PowerShell often gain one).
  var lines = String(text).replace(new RegExp('^\\uFEFF'), '').split(/\r\n|\n|\r/);
  var events = [];
  var counts = { native: 0, unreal: 0, unity: 0, custom: 0 };

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var m, fmt;
    if ((m = RE_NATIVE.exec(line))) fmt = 'native';
    else if ((m = RE_UNREAL.exec(line))) fmt = 'unreal';
    else if ((m = RE_UNITY.exec(line))) fmt = 'unity';
    else if ((m = RE_CUSTOM.exec(line))) fmt = 'custom';
    else continue;

    counts[fmt]++;
    if (fmt === 'custom') {
      events.push({
        lineno: i + 1,
        category: 'Unknown',
        level: customPrefixLevel(m[1]),
        message: m[2],
      });
      continue;
    }
    var level = fmt === 'native' ? m[6] : LEVEL_FROM_NAME[m[6] || 'Log'];
    events.push({
      lineno: i + 1,
      category: m[5].trim(),
      level: level,
      message: m[7],
    });
  }

  var format = 'unknown';
  var best = 0;
  for (var k in counts) {
    if (counts[k] > best) { best = counts[k]; format = k; }
  }

  var sdk = { version: null, gitHash: null, buildType: null };
  for (var j = 0; j < events.length; j++) {
    var b = MARKER.banner.exec(events[j].message);
    if (b) { sdk.version = b[1]; sdk.gitHash = b[2]; sdk.buildType = b[3]; break; }
  }

  return { events: events, format: format, totalLines: lines.length, ludeoLines: events.length, sdk: sdk };
}

// ---------------------------------------------------------------------------
// Lifecycle markers (message-level, container already stripped)
// ---------------------------------------------------------------------------

var MARKER = {
  banner: /LudeoSDK v([\d.]+), GitHash:([a-fA-F0-9]+), Build type:(\w+)/,
  asyncIssue: /^Async function (ludeo_\w+)\(0x[0-9a-fA-F]+\) \(callbackId (\d+)\)/,
  asyncOk: /^(ludeo_\w+) succeeded\. \(callbackId (\d+)\)/,
  asyncFail: /^(ludeo_\w+) failed with LudeoResult::(\w+)\. \(callbackId (\d+)\)/,
  cbEnter: /^Entering callbackId (\d+)\b/,
  cbFinish: /^Finished callbackId (\d+)\b/,
  notifyEnter: /^Entering (\w+) notification callback NotificationId (\d+) callback/,
  notifyFinish: /^Finished (\w+) notification callback NotificationId (\d+) callback/,
  noHandler: /^No callback has been registered to (\w+)/,
  // tracyName() is "<Name> notification callback", hence the doubled word "callback".
  broadcast: /^Broadcasting (\w+) notification callback callback to (\d+) subscribers/,
  receivedEvent: /: Received event (\S+)/,
  startShutdown: /^Starting shutdown$/,
  endShutdown: /^Shutdown finished$/,
  leakCount: /^(\d+) Interfaces still alive at shutdown/,
  leakHolding: /^Client still holding a handle to a (\w+) instance/,
  tickProblem: /(Recursive|Concurrent|Non-concurrent) call to ludeo_Tick\/ludeo_Shutdown/,
  secretVar: /detected runtime var (LUDEO_API_KEY|LUDEO_AUTH_TOKEN|LUDEO_APP_TOKEN):/,
  // Http-category lines log full websocket/request URLs including auth token query params,
  // and auth request bodies include an authToken field.
  secretUrlToken: /[?&]token=[^&\s"']+/,
  secretBodyToken: /"(authToken|appToken)":"[^"]+"/,
};

// ERR/FTL message patterns that are reported by a dedicated check (or are known noise)
// and must not be double-reported by error-scan.
var ERROR_SCAN_EXCLUDE = [
  MARKER.asyncFail,       // reported by async-failures
  MARKER.leakHolding,     // reported by leaks
  MARKER.tickProblem,     // reported by tick-thread
];

// ---------------------------------------------------------------------------
// Shared checks
// ---------------------------------------------------------------------------

function makeResult(id, status, detail, lines, hint) {
  return { id: id, status: status, detail: detail, lines: lines || [], hint: hint || null };
}

/**
 * Pairs open/close markers keyed by id and returns the unmatched open entries.
 *
 * Deliberately counts rather than storing one entry per id, because neither assumption a
 * map-and-delete would need actually holds in real logs:
 *   - Order: custom game loggers write SDK lines from several threads, so a close line can
 *     appear BEFORE its own open line.
 *   - Uniqueness: the SDK uses 4294967295 (UINT32_MAX) as a non-unique sentinel callbackId
 *     for calls that complete inline, so one id legitimately repeats within a run.
 *
 * `opens` is id -> array of caller-shaped entries; `closes` is id -> count. For an id with more
 * opens than closes the LAST (opens - closes) entries are reported, since closes pair with the
 * earliest opens.
 */
function unmatchedPairs(opens, closes) {
  var out = [];
  Object.keys(opens).forEach(function (id) {
    var unmatched = opens[id].length - (closes[id] || 0);
    if (unmatched > 0) out = out.concat(opens[id].slice(-unmatched));
  });
  return out;
}

/** Each check: function (ctx) -> makeResult(...). ctx: { parsed, scenario } */
var SHARED_CHECKS = [
  function checkBanner(ctx) {
    var p = ctx.parsed;
    if (p.sdk.version) {
      return makeResult('banner', 'pass',
        'SDK v' + p.sdk.version + ', GitHash ' + p.sdk.gitHash + ', ' + p.sdk.buildType + ' build');
    }
    return makeResult('banner', 'fail', 'SDK version banner not found', [],
      'The banner is logged inside ludeo_Initialize. Either this is not a Ludeo log, verbosity was off, ' +
      'or file logging was enabled after Initialize — prefer enabling logging via LudeoInitializeParams.');
  },

  function checkVerbosity(ctx) {
    var hits = 0;
    ctx.parsed.events.forEach(function (e) {
      if (MARKER.asyncIssue.test(e.message) || MARKER.asyncOk.test(e.message)) hits++;
    });
    if (hits > 0) return makeResult('verbosity', 'pass', hits + ' async API markers found');
    return makeResult('verbosity', 'fail', 'No async API markers — log verbosity is too low to verify anything', [],
      'Set log level to Verbose. Unity: LudeoSettings → Ludeo Log Level (default Error hides everything). ' +
      'Unreal: -LudeoLogLevelSettings="All:Verbose". Native: ludeo_SetLoggingLevel(All, Verbose).');
  },

  function checkAsyncTerminal(ctx) {
    var opens = {};  // callbackId -> [{label, idx}]
    var closes = {}; // callbackId -> count
    var shutdownIdx = -1;
    ctx.parsed.events.forEach(function (e, idx) {
      if (shutdownIdx < 0 && MARKER.startShutdown.test(e.message)) shutdownIdx = idx;
      var m;
      if ((m = MARKER.asyncIssue.exec(e.message))) {
        (opens[m[2]] = opens[m[2]] || []).push({
          label: m[1] + ' (callbackId ' + m[2] + ', line ' + e.lineno + ')',
          idx: idx,
        });
      } else if ((m = MARKER.asyncOk.exec(e.message)) || (m = MARKER.asyncFail.exec(e.message))) {
        var id = m[m.length - 1];
        closes[id] = (closes[id] || 0) + 1;
      }
    });
    var orphans = [];
    var orphansAfterShutdown = [];
    unmatchedPairs(opens, closes).forEach(function (o) {
      if (shutdownIdx >= 0 && o.idx > shutdownIdx) orphansAfterShutdown.push(o.label);
      else orphans.push(o.label);
    });
    if (orphans.length === 0 && orphansAfterShutdown.length === 0) {
      return makeResult('async-terminal', 'pass', 'Every async call reached a terminal succeeded/failed');
    }
    if (orphans.length > 0) {
      return makeResult('async-terminal', 'fail',
        'Async calls that never completed: ' + orphans.join('; '), [],
        'A call with no terminal line means it was still in flight when the log ended — usually the game quit ' +
        'without waiting, stopped calling ludeo_Tick, or crashed.');
    }
    return makeResult('async-terminal', 'warn',
      'Calls still in flight during shutdown (completed as Canceled or dropped): ' + orphansAfterShutdown.join('; '));
  },

  function checkAsyncFailures(ctx) {
    var failures = [];
    var canceledAtQuit = [];
    var lines = [];
    var shutdownSeen = false;
    ctx.parsed.events.forEach(function (e) {
      if (MARKER.startShutdown.test(e.message)) shutdownSeen = true;
      var m = MARKER.asyncFail.exec(e.message);
      if (!m) return;
      var entry = m[1] + ' → ' + m[2] + ' (line ' + e.lineno + ')';
      // Calls still pending when the SDK shuts down complete as Canceled by design.
      if (m[2] === 'Canceled' && shutdownSeen) { canceledAtQuit.push(entry); return; }
      failures.push(entry);
      lines.push(e.lineno);
    });
    if (failures.length > 0) {
      return makeResult('async-failures', 'fail', 'Failed API calls: ' + failures.join('; '), lines,
        'Look up the LudeoResult meaning; WrongState usually means calls were made out of order.');
    }
    if (canceledAtQuit.length > 0) {
      return makeResult('async-failures', 'warn',
        'Calls canceled by shutdown (expected for quit-in-flight, but consider waiting for them): ' +
        canceledAtQuit.join('; '));
    }
    return makeResult('async-failures', 'pass', 'No failed API calls');
  },

  function checkCallbackReturn(ctx) {
    // Notification ids are only unique per notification name — the SDK hands RoomReady and
    // Highlight the same NotificationId — so notifications key on name + id, not id alone.
    var opens = {};
    var closes = {};
    function open(key, label, e) {
      (opens[key] = opens[key] || []).push({ label: label + ' (line ' + e.lineno + ')' });
    }
    function close(key) { closes[key] = (closes[key] || 0) + 1; }
    ctx.parsed.events.forEach(function (e) {
      var m;
      if ((m = MARKER.cbEnter.exec(e.message))) open('cb:' + m[1], 'callbackId ' + m[1], e);
      else if ((m = MARKER.cbFinish.exec(e.message))) close('cb:' + m[1]);
      else if ((m = MARKER.notifyEnter.exec(e.message))) {
        open('n:' + m[1] + ':' + m[2], m[1] + ' NotificationId ' + m[2], e);
      } else if ((m = MARKER.notifyFinish.exec(e.message))) close('n:' + m[1] + ':' + m[2]);
    });
    var stuck = unmatchedPairs(opens, closes).map(function (o) { return o.label; });
    if (stuck.length === 0) return makeResult('callback-return', 'pass', 'All game callbacks returned');
    return makeResult('callback-return', 'fail',
      'Game callbacks that never returned: ' + stuck.join('; '), [],
      'An Entering without a Finished means the game crashed, threw, or hung inside a Ludeo callback.');
  },
  function checkNotifyAudit(ctx) {
    var missing = [];
    var lines = [];
    ctx.parsed.events.forEach(function (e) {
      var m = MARKER.noHandler.exec(e.message);
      if (m && missing.indexOf(m[1]) < 0) { missing.push(m[1]); lines.push(e.lineno); }
    });
    if (missing.length === 0) return makeResult('notify-audit', 'pass', 'All session notifications have handlers');
    var required = ctx.scenario === 'player' ? ['LudeoSelected'] : ['RoomReady'];
    var requiredMissing = missing.filter(function (n) { return required.indexOf(n) >= 0; });
    if (requiredMissing.length > 0) {
      return makeResult('notify-audit', 'fail',
        'Required notification handler(s) not registered: ' + requiredMissing.join(', ') +
        (missing.length > requiredMissing.length ? ' (also missing: ' +
          missing.filter(function (n) { return required.indexOf(n) < 0; }).join(', ') + ')' : ''),
        lines,
        'Register handlers with AddNotify* BEFORE calling Session_Activate — the ' + ctx.scenario +
        ' flow cannot work without ' + requiredMissing.join('/') + '.');
    }
    return makeResult('notify-audit', 'warn',
      'Notification handlers not registered: ' + missing.join(', '), lines,
      'Not fatal for this scenario, but each unhandled notification is platform functionality the game ignores.');
  },

  function checkErrorScan(ctx) {
    var ERROR_LIST_CAP = 20;
    var errors = [];
    var errorCount = 0;
    var warnGroups = {};
    var shutdownSeen = false;
    ctx.parsed.events.forEach(function (e) {
      if (MARKER.startShutdown.test(e.message)) shutdownSeen = true;
      if (e.category === 'Coherent') return; // overlay CSS noise
      // Tasks pending at shutdown finish as Canceled by design.
      if (shutdownSeen && e.message.indexOf('LudeoResult::Canceled') >= 0) return;
      if (ERROR_SCAN_EXCLUDE.some(function (re) { return re.test(e.message); })) return;
      if (e.level === 'ERR' || e.level === 'FTL') {
        errorCount++;
        if (errors.length < ERROR_LIST_CAP) errors.push('line ' + e.lineno + ' [' + e.category + '] ' + e.message);
      } else if (e.level === 'WRN') {
        var key = e.category + ': ' + e.message.slice(0, 60);
        warnGroups[key] = (warnGroups[key] || 0) + 1;
      }
    });
    if (errorCount > 0) {
      var dropped = errorCount - errors.length;
      return makeResult('error-scan', 'fail',
        errorCount + ' SDK error(s) in log: ' + errors.join(' | ') +
        (dropped > 0 ? ' | (+' + dropped + ' more not shown)' : ''), [],
        'SDK-level errors are often invisible to game code — each one needs an explanation before shipping.');
    }
    var warnKeys = Object.keys(warnGroups);
    if (warnKeys.length > 0) {
      return makeResult('error-scan', 'warn',
        'No errors; ' + warnKeys.length + ' distinct warning(s): ' +
        warnKeys.map(function (k) { return k + ' ×' + warnGroups[k]; }).join(' | '));
    }
    return makeResult('error-scan', 'pass', 'No SDK errors or warnings');
  },

  function checkCleanShutdown(ctx) {
    var startIdx = -1, endIdx = -1;
    ctx.parsed.events.forEach(function (e, idx) {
      if (startIdx < 0 && MARKER.startShutdown.test(e.message)) startIdx = idx;
      if (MARKER.endShutdown.test(e.message)) endIdx = idx;
    });
    if (startIdx >= 0 && endIdx > startIdx) return makeResult('clean-shutdown', 'pass', 'SDK shut down cleanly');
    if (startIdx >= 0) {
      return makeResult('clean-shutdown', 'fail', 'Shutdown started but never finished', [],
        'The process likely crashed or was killed during ludeo_Shutdown.');
    }
    return makeResult('clean-shutdown', 'fail', 'ludeo_Shutdown was never called', [],
      'Quit through the game\'s own quit path (not task-kill) and make sure the integration calls ' +
      'Shutdown on exit. Unity: the plugin shuts down automatically on Application quit.');
  },

  function checkLeaks(ctx) {
    var held = [];
    var count = null;
    ctx.parsed.events.forEach(function (e) {
      var m;
      if ((m = MARKER.leakCount.exec(e.message))) count = m[1];
      else if ((m = MARKER.leakHolding.exec(e.message))) held.push(m[1]);
    });
    if (count === null && held.length === 0) return makeResult('leaks', 'pass', 'No leaked SDK handles at shutdown');
    var detail = (count !== null ? count + ' interfaces still alive at shutdown' : '') +
      (held.length ? (count !== null ? '; ' : '') + 'client still holding: ' + held.join(', ') : '');
    return makeResult('leaks', 'warn', detail, [],
      'Release every handle you obtained (DataReader, Room, Session...) before shutting down.');
  },

  function checkTickThread(ctx) {
    var problems = [];
    ctx.parsed.events.forEach(function (e) {
      var m = MARKER.tickProblem.exec(e.message);
      if (m) problems.push(m[1] + ' (line ' + e.lineno + ')');
    });
    if (problems.length === 0) return makeResult('tick-thread', 'pass', 'No ludeo_Tick threading problems');
    return makeResult('tick-thread', 'warn', 'Tick threading issues detected: ' + problems.join('; '), [],
      'Call ludeo_Tick from one thread, never recursively or concurrently.');
  },

  function checkSecrets(ctx) {
    var kinds = [];
    function add(kind) { if (kinds.indexOf(kind) < 0) kinds.push(kind); }
    ctx.parsed.events.forEach(function (e) {
      var m = MARKER.secretVar.exec(e.message);
      if (m) add(m[1] + ' runtime var');
      if (MARKER.secretUrlToken.test(e.message)) add('auth token in URL');
      if (MARKER.secretBodyToken.test(e.message)) add('auth token in request body');
    });
    if (kinds.length === 0) return makeResult('secrets', 'pass', 'No credentials detected in log');
    return makeResult('secrets', 'warn',
      'Log contains credential values (' + kinds.join(', ') + ') — redact before sharing this file');
  },
];

// ---------------------------------------------------------------------------
// Scenario order walker
// ---------------------------------------------------------------------------

function asyncOkStep(func, severity, hint) {
  return {
    name: func + ' succeeded',
    severity: severity,
    hint: hint || null,
    match: function (e) {
      var m = MARKER.asyncOk.exec(e.message);
      return m !== null && m[1] === func;
    },
  };
}

/** RoomReady must reach at least one registered subscriber; only the hint differs per scenario. */
function roomReadyStep(hint) {
  return {
    name: 'RoomReady delivered to the game',
    severity: 'fail',
    hint: hint,
    match: function (e) {
      var m = MARKER.broadcast.exec(e.message);
      return m !== null && m[1] === 'RoomReady' && Number(m[2]) >= 1;
    },
  };
}

var SCENARIOS = {
  creator: {
    title: 'Creator flow (run the game, play, create a ludeo, quit)',
    steps: [
      asyncOkStep('ludeo_Session_Activate', 'fail',
        'Activation is the entry point — check apiKey/auth and network before anything else.'),
      asyncOkStep('ludeo_Session_OpenRoom', 'fail', null),
      asyncOkStep('ludeo_Room_AddPlayer', 'fail', null),
      roomReadyStep('RoomReady arrives over the Echo websocket after AddPlayer and must reach a registered handler.'),
      asyncOkStep('ludeo_GameplaySession_Begin', 'fail',
        'Begin gameplay only after the RoomReady notification.'),
      asyncOkStep('ludeo_GameplaySession_End', 'fail',
        'End the gameplay session when the run finishes (isAbort=false) or aborts.'),
      asyncOkStep('ludeo_Room_Close', 'warn',
        'Close the room after ending gameplay; Shutdown cleans up, but explicit close is the contract.'),
    ],
    extras: [checkDataActivity],
  },
  player: {
    title: 'Player flow (play a ludeo end-to-end)',
    steps: [
      asyncOkStep('ludeo_Session_Activate', 'fail', null),
      {
        name: 'Ludeo selection trigger fired',
        severity: 'fail',
        hint: 'Either click the ludeo in the portal, or force it deterministically with the ' +
          'activation-ludeoid command (see instructions).',
        match: function (e) {
          var m = MARKER.receivedEvent.exec(e.message);
          if (m && m[1] === 'NewLudeoSelected') return true;
          m = MARKER.broadcast.exec(e.message);
          return m !== null && m[1] === 'LudeoSelected' && Number(m[2]) >= 1;
        },
      },
      asyncOkStep('ludeo_Session_GetLudeo', 'fail',
        'GetLudeo returns the DataReader used to restore game state.'),
      asyncOkStep('ludeo_Session_OpenRoom', 'fail', null),
      asyncOkStep('ludeo_Room_AddPlayer', 'fail', null),
      roomReadyStep('In the player flow RoomReady fires when the user presses Play in the overlay.'),
      asyncOkStep('ludeo_GameplaySession_Begin', 'fail', null),
      asyncOkStep('ludeo_GameplaySession_End', 'fail', null),
    ],
    extras: [],
  },
};

/** Creator extra: some Data-category activity between Begin and End (needs Verbose lines). */
function checkDataActivity(parsed) {
  var events = parsed.events;
  var hasVerbose = events.some(function (e) { return e.level === 'VER' || e.level === 'VVE'; });
  if (!hasVerbose) {
    return makeResult('data-activity', 'pass', 'Skipped (log has no Verbose lines; data writes log at Verbose)');
  }
  var beginIdx = -1, endIdx = events.length;
  events.forEach(function (e, idx) {
    var m = MARKER.asyncOk.exec(e.message);
    if (!m) return;
    if (m[1] === 'ludeo_GameplaySession_Begin' && beginIdx < 0) beginIdx = idx;
    if (m[1] === 'ludeo_GameplaySession_End') endIdx = idx;
  });
  if (beginIdx < 0) return makeResult('data-activity', 'pass', 'Skipped (no gameplay session found)');
  for (var i = beginIdx; i < endIdx; i++) {
    if (events[i].category === 'Data') {
      return makeResult('data-activity', 'pass', 'Gameplay data was written during the session');
    }
  }
  return makeResult('data-activity', 'warn', 'No Data activity between Begin and End', [],
    'The gameplay session ran but no state/actions were written — check the DataWriter integration.');
}

/**
 * Walks scenario steps as an ordered subsequence over the event stream.
 * Missing step → its severity. Present but before the previous step → fail (out of order).
 */
function runScenario(parsed, scenarioName) {
  var scenario = SCENARIOS[scenarioName];
  var events = parsed.events;
  var results = [];
  var cursor = 0;

  scenario.steps.forEach(function (step, stepIdx) {
    var foundAt = -1;
    for (var i = cursor; i < events.length; i++) {
      if (step.match(events[i])) { foundAt = i; break; }
    }
    var id = 'step-' + (stepIdx + 1);
    if (foundAt >= 0) {
      results.push(makeResult(id, 'pass', step.name + ' (line ' + events[foundAt].lineno + ')'));
      cursor = foundAt + 1;
      return;
    }
    // Not found after the cursor — did it happen earlier (out of order)?
    var earlier = -1;
    for (var j = 0; j < cursor; j++) {
      if (step.match(events[j])) { earlier = j; break; }
    }
    if (earlier >= 0) {
      results.push(makeResult(id, 'fail',
        step.name + ' happened out of order (line ' + events[earlier].lineno + ')', [events[earlier].lineno],
        'Lifecycle calls must follow: Activate → OpenRoom → AddPlayer → RoomReady → Begin → End → Close.'));
    } else {
      results.push(makeResult(id, step.severity, step.name + ' — not found in log', [], step.hint));
    }
  });

  scenario.extras.forEach(function (extra) { results.push(extra(parsed)); });
  return results;
}

// ---------------------------------------------------------------------------
// Verify (everything together)
// ---------------------------------------------------------------------------

/**
 * @param text raw log file content
 * @param scenarioName 'creator' | 'player'
 * @returns {object} full result: { usable, format, sdk, counts, scenario, checks, steps, result }
 */
function verify(text, scenarioName) {
  scenarioName = scenarioName || 'creator';
  var parsed = parseLog(text);

  if (parsed.ludeoLines === 0) {
    return {
      usable: false, format: 'unknown', sdk: parsed.sdk, scenario: scenarioName,
      counts: { total: parsed.totalLines, ludeo: 0 },
      checks: [], steps: [], result: 'unusable',
    };
  }

  var ctx = { parsed: parsed, scenario: scenarioName };
  var checks = SHARED_CHECKS.map(function (check) { return check(ctx); });
  var steps = runScenario(parsed, scenarioName);
  var all = checks.concat(steps);
  var failed = all.filter(function (r) { return r.status === 'fail'; }).length;
  var warned = all.filter(function (r) { return r.status === 'warn'; }).length;

  return {
    usable: true,
    format: parsed.format,
    sdk: parsed.sdk,
    scenario: scenarioName,
    counts: { total: parsed.totalLines, ludeo: parsed.ludeoLines, failed: failed, warned: warned },
    checks: checks,
    steps: steps,
    result: failed > 0 ? 'fail' : 'pass',
  };
}

// ---------------------------------------------------------------------------
// Guided run instructions
// ---------------------------------------------------------------------------

var INSTRUCTIONS = {
  unreal: [
    'UNREAL — run this with a non-Shipping build (Development/Debug):',
    '',
    '  1. Launch with:',
    '       MyGame.exe -LudeoLogLevelSettings="All:Verbose" -LudeoCommandList="backendlogs-enabled=0"',
    '     For the PLAYER scenario append to -LudeoCommandList (comma-separated):',
    '       ,activation-ludeoid=<LUDEO_ID>',
    '     (-LudeoLogLevelSettings overrides whatever log level the game sets in code.)',
    '  2. Play: reach gameplay and play for ~60 seconds.',
    '       Creator scenario: create a ludeo during the run.',
    '       Player scenario: press Play when the ludeo prompt appears and finish the run.',
    '  3. Quit through the game\'s own quit path — do NOT kill the process',
    '     (clean shutdown is part of what gets verified).',
    '  4. The log to verify: <Project>\\Saved\\Logs\\<Project>.log',
  ],
  unity: [
    'UNITY:',
    '',
    '  1. In the LudeoSettings asset set: Ludeo Log Level = Verbose',
    '     (the default, Error, hides everything the verifier needs;',
    '      VeryVerbose additionally requires the Development core DLL).',
    '  2. Put commands in Assets/StreamingAssets/LudeoSDK/RunCommands.json:',
    '       backendlogs-enabled = 0',
    '     For the PLAYER scenario also add:',
    '       activation-ludeoid = <LUDEO_ID>',
    '  3. Run the built player. Play ~60 seconds; creator: create a ludeo,',
    '     player: press Play on the ludeo prompt and finish the run. Quit via the game\'s quit path.',
    '  4. The log to verify:',
    '       %USERPROFILE%\\AppData\\LocalLow\\<Company>\\<Product>\\Player.log',
    '     (Editor runs write to Editor.log — parses the same.)',
  ],
  native: [
    'NATIVE C++ ENGINE:',
    '',
    '  1. Enable file logging at Verbose, ideally via LudeoInitializeParams so the',
    '     version banner is captured:',
    '       params.loggingToFileParams  → directory of your choice',
    '       ludeo_SetLoggingLevel(LudeoLogCategory::All, LudeoLogLevel::Verbose);',
    '       ludeo_Command("backendlogs-enabled", "0");',
    '     For the PLAYER scenario also:',
    '       ludeo_Command("activation-ludeoid", "<LUDEO_ID>");',
    '  2. Run the game normally. Play ~60 seconds; creator: create a ludeo,',
    '     player: finish the ludeo run. Quit through the normal quit path.',
    '  3. The log to verify: <directory>/LudeoSDK.log (default directory = working dir).',
  ],
};

var INSTRUCTIONS_FOOTER = [
  '',
  'Notes:',
  '  - backendlogs-enabled=0 stops the backend from overriding your chosen verbosity.',
  '  - Leave overlay/video ON — this is a conformance run of the real integration.',
  '  - Then verify:  node ludeo_verify.js check <logfile> --scenario creator|player',
  '    ...or open LudeoVerify.html and drag the log file in.',
];

function instructionsText(engine, scenario) {
  var engines = engine ? [engine] : ['unreal', 'unity', 'native'];
  var out = ['Ludeo SDK integration verification — ' + (scenario || 'creator') + ' scenario', ''];
  engines.forEach(function (e) {
    if (!INSTRUCTIONS[e]) return;
    out = out.concat(INSTRUCTIONS[e]).concat(['']);
  });
  return out.concat(INSTRUCTIONS_FOOTER).join('\n');
}

// ---------------------------------------------------------------------------
// Report rendering (plain text, used by the CLI; the HTML page renders itself)
// ---------------------------------------------------------------------------

function renderReport(res, file) {
  var out = [];
  out.push('Ludeo SDK Integration Verifier');
  out.push('  file:     ' + (file || '(inline)'));
  out.push('  format:   ' + res.format +
    (res.format === 'custom'
      ? ' (game\'s own logging callback — SDK category/verbosity not preserved; ludeo_SetLoggingToFile gives full fidelity)'
      : ''));
  out.push('  sdk:      ' + (res.sdk.version
    ? 'v' + res.sdk.version + ' (' + res.sdk.gitHash + ', ' + res.sdk.buildType + ')'
    : 'unknown'));
  out.push('  scenario: ' + res.scenario);
  out.push('  lines:    ' + res.counts.ludeo + ' Ludeo / ' + res.counts.total + ' total');
  out.push('');

  if (!res.usable) {
    out.push('UNUSABLE INPUT — no Ludeo SDK log lines found in this file.');
    out.push('Run `node ludeo_verify.js instructions` for how to produce a verifiable log.');
    return out.join('\n');
  }

  var pad = { pass: '[PASS]', warn: '[WARN]', fail: '[FAIL]' };
  out.push('Checks:');
  res.checks.forEach(function (c) {
    out.push('  ' + pad[c.status] + ' ' + c.id + ' — ' + c.detail);
    if (c.status !== 'pass' && c.hint) out.push('           hint: ' + c.hint);
  });
  out.push('');
  out.push('Scenario steps (' + SCENARIOS[res.scenario].title + '):');
  res.steps.forEach(function (s) {
    out.push('  ' + pad[s.status] + ' ' + s.detail);
    if (s.status !== 'pass' && s.hint) out.push('           hint: ' + s.hint);
  });
  out.push('');
  out.push('RESULT: ' + res.result.toUpperCase() +
    ' — ' + res.counts.failed + ' failed, ' + res.counts.warned + ' warning(s)');
  return out.join('\n');
}

function toJson(res, file) {
  return {
    file: file || null,
    format: res.format,
    sdk_version: res.sdk.version,
    sdk_git_hash: res.sdk.gitHash,
    sdk_build_type: res.sdk.buildType,
    scenario: res.scenario,
    result: res.result,
    counts: res.counts,
    checks: res.checks.concat(res.steps).map(function (c) {
      return { id: c.id, status: c.status, detail: c.detail, lines: c.lines, hint: c.hint };
    }),
  };
}

// ---------------------------------------------------------------------------
// Exports (browser + Node) and CLI entry
// ---------------------------------------------------------------------------

var api = {
  parseLog: parseLog,
  verify: verify,
  runScenario: runScenario,
  instructionsText: instructionsText,
  renderReport: renderReport,
  toJson: toJson,
  SCENARIOS: SCENARIOS,
  MARKER: MARKER,
};

if (typeof window !== 'undefined') {
  window.LudeoVerify = api;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}

function runCli(argv) {
  var fs = require('fs');
  var args = argv.slice(2);
  var cmd = args.shift();

  function flag(name, fallback) {
    var i = args.indexOf('--' + name);
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
  }

  var scenario = flag('scenario', 'creator');
  if (!SCENARIOS[scenario]) {
    process.stderr.write('Unknown scenario "' + scenario + '" (use creator or player)\n');
    return 2;
  }

  if (cmd === 'instructions') {
    process.stdout.write(instructionsText(flag('engine', null), scenario) + '\n');
    return 0;
  }

  if (cmd === 'check') {
    var valueFlags = ['--scenario', '--engine'];
    var file = null;
    for (var i = 0; i < args.length; i++) {
      if (valueFlags.indexOf(args[i]) >= 0) { i++; continue; }
      if (args[i].slice(0, 2) === '--') continue;
      file = args[i];
      break;
    }
    if (!file) {
      process.stderr.write('Usage: node ludeo_verify.js check <logfile> [--scenario creator|player] [--json]\n');
      return 2;
    }
    var text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch (err) {
      process.stderr.write('Cannot read ' + file + ': ' + err.message + '\n');
      return 2;
    }
    var res = verify(text, scenario);
    if (args.indexOf('--json') >= 0) {
      process.stdout.write(JSON.stringify(toJson(res, file), null, 2) + '\n');
    } else {
      process.stdout.write(renderReport(res, file) + '\n');
    }
    if (!res.usable) return 2;
    return res.result === 'pass' ? 0 : 1;
  }

  process.stdout.write([
    'Ludeo SDK Integration Verifier',
    '',
    'Usage:',
    '  node ludeo_verify.js instructions [--engine unity|unreal|native] [--scenario creator|player]',
    '  node ludeo_verify.js check <logfile> [--scenario creator|player] [--json]',
    '',
    'Or zero-install: open LudeoVerify.html in a browser and drag the log file in.',
    '',
  ].join('\n'));
  return cmd ? 2 : 0;
}

if (typeof module !== 'undefined' && typeof require !== 'undefined' && require.main === module) {
  process.exitCode = runCli(process.argv);
}
