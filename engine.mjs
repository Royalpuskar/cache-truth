function object(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw Error('Expected an object');
}
function number(v, label, min = -1e12) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || Math.abs(v) > 1e12)
    throw Error(label + ' must be a finite number in range');
}
// Canonical JSON encoding: object property order does not imply a value change.
function encode(value, depth = 0) {
  if (depth > 50) throw Error('Values exceed maximum nesting depth of 50');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + Array.from(value, v => encode(v, depth + 1)).join(',') + ']';
  if (value && typeof value === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + encode(value[key], depth + 1)).join(',') + '}';
  }
  throw Error('Values must contain only JSON data');
}
export function run(input) {
  object(input);
  number(input.ttl, 'ttl', 0);
  if (!Object.hasOwn(input, 'initial')) throw Error('Initial value is required');
  if (!Array.isArray(input.events) || input.events.length > 500) throw Error('events must be an array of at most 500 items');
  // Encode values before replay so returned evidence cannot retain mutable references.
  const initial = encode(input.initial);
  let previous = -Infinity;
  const events = Array.from(input.events, event => {
    object(event); number(event.at, 'time');
    if (event.at < previous) throw Error('Events must be chronological');
    previous = event.at;
    if (!['read','write','invalidate'].includes(event.action)) throw Error('Unknown action');
    if (event.action === 'write' && !Object.hasOwn(event, 'value')) throw Error('Write requires value');
    return {...event, encoded: event.action === 'write' ? encode(event.value) : null};
  });
  if (JSON.stringify(input).length > 200000) throw Error('Input exceeds 200000 serialized characters');
  let source = initial, sourceRevision = 0, cached = null, cacheRevision = null;
  let expiry = null, loadedAt = null;
  const rows = events.map((event, eventIndex) => {
    const {at} = event;
    let action = event.action, value = null, stale = false, revisionLag = null, age = null;
    if (action === 'write') {
      source = event.encoded; sourceRevision++; value = source;
    } else if (action === 'invalidate') {
      cached = null; cacheRevision = null; expiry = null; loadedAt = null;
    } else {
      const hit = cacheRevision !== null && at < expiry;
      if (!hit) {cached = source; cacheRevision = sourceRevision; loadedAt = at; expiry = at + input.ttl;}
      action = hit ? 'cache hit' : 'source read';
      value = cached; stale = cached !== source;
      revisionLag = sourceRevision - cacheRevision; age = at - loadedAt;
    }
    return {eventIndex, at, action, value, stale, sourceRevision, cacheRevision,
      revisionLag, age, expiry};
  });
  const reads = rows.filter(row => row.revisionLag !== null);
  return {metrics: {events: rows.length, staleReads: reads.filter(row => row.stale).length,
    revisionStaleReads: reads.filter(row => row.revisionLag > 0).length,
    maxRevisionLag: Math.max(0, ...reads.map(row => row.revisionLag)),
    invalidations: rows.filter(row => row.action === 'invalidate').length}, rows};
}
