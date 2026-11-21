# Cache Truth

Replay reads and source writes to expose TTL cache staleness.

**Status:** implemented browser-local research prototype. Automated tests can be reproduced with the command below. The existing Pages site previously passed smoke checks; the revision-tracking update is locally tested. Its live deployment and browser behavior have not yet been verified.

## Website

Live website: https://royalpuskar.github.io/cache-truth/

## Problem and approach

Cache consumers can receive identical content while missing intervening source writes. This tool distinguishes content mismatch from revision lag, exposing both through a deterministic event replay. It runs the same pure JavaScript engine in the browser and Node tests. All input is provided by the user or the included synthetic fixture; no external facts are inferred.

## Implemented features

- Editable scenario with a synthetic example and reset control.
- Deterministic analysis, summary metrics, filterable result table, and JSON report export.
- Input validation, explicit errors, and invalidation of outdated reports after edits.
- Keyboard-accessible controls, responsive layout, and large-screen CSS.
- Zero runtime dependencies and no external API calls.

## Install and run

Requirements: Python 3 for a static local server, Node.js 22 or later for tests.

```sh
git clone https://github.com/Royalpuskar/cache-truth.git
cd cache-truth
python3 -m http.server 8000
```

Open http://localhost:8000. Do not open index.html through a file URL; ES modules require a server.

```sh
node --test test.mjs
```

## Example and schema

The complete example in `sample.mjs` defines the supported input shape:

```json
{
  "ttl": 5,
  "initial": "v1",
  "events": [
    {
      "at": 0,
      "action": "read"
    },
    {
      "at": 1,
      "action": "write",
      "value": "v2"
    },
    {
      "at": 2,
      "action": "read"
    },
    {
      "at": 5,
      "action": "read"
    }
  ]
}
```

Edit one value and select **Run analysis**. **Reset example** restores the fixture. **Export report** downloads the current result; it never publishes it.

Input is capped at 200,000 serialized characters, arrays processed by the engine at 500 elements, and numeric magnitudes at 1e12. Domain constraints are checked inside `engine.mjs`; unsupported structures return an error.

## Revision evidence and invalidation

Source revision begins at 0 and increments for every write, including identical-value writes. A source read snapshots both content and revision. Cache hits do not extend TTL. Expiry is exclusive: a read exactly at the expiry time refreshes from source.

Each read reports `revisionLag = sourceRevision - cacheRevision`, cache `age` in input time units, and `expiry`. Existing `stale` means content mismatch. The new `revisionStaleReads` metric counts reads with positive revision lag, even when content matches. Object property order is ignored for content comparison; array order remains significant. The displayed value is canonical JSON with sorted object keys.

An event `{"at":3,"action":"invalidate"}` removes the cached snapshot without changing the source or its revision. The next read refreshes from source. Invalidating an empty cache is harmless. Equal timestamps follow array order; zero TTL forces every read to refresh.

### Reproduce an A → B → A change

```json
{"ttl":10,"initial":"A","events":[
  {"at":0,"action":"read"},
  {"at":1,"action":"write","value":"B"},
  {"at":2,"action":"write","value":"A"},
  {"at":3,"action":"read"}
]}
```

The final read returns A: `stale` is false, but `revisionLag` is 2. Inserting an invalidation immediately before that read changes it to a source read with revision lag 0.

Values must be JSON data with at most 50 nesting levels. Missing initial/write values and non-finite numbers are rejected. Direct module callers should supply ordinary JSON-compatible data, not getters, proxies, or custom serialization hooks. Write and invalidation rows have null read-age and revision-lag fields; no cached snapshot is represented by null cache revision and expiry.

## Architecture and request flow

`index.html` loads `app.mjs`, which parses scenario JSON and calls `run` from `engine.mjs`. The engine returns `metrics` and `rows`; the UI renders values with `textContent`, never user-supplied HTML. Editing invalidates the prior report. Export creates a local Blob download.

There is no application authentication, credential store, session cookie, or token lifecycle. GitHub Pages serves public static files. The app does not collect passwords or API keys, contact third-party APIs, persist inputs, or send scenario data over the network. GitHub hosting can still receive ordinary page request metadata. Reloading discards edits.

## Limitations

One-key logical-time TTL model. Invalidation is an explicit synchronous event, not an actual message to a cache server. There is no concurrent request model, network delay, capacity eviction, distributed revision clock, or automatic invalidation on write. Revisions count simulated writes; they do not prove real-world causality or freshness. The tool does not contact production systems.

The interface shares a portfolio design system, while this repository has its own domain engine, fixture, and tests. No accuracy, novelty, production-readiness, or 4K visual-test claim is made. Large-screen CSS is not a substitute for device testing.

## Validation

Ten local Node tests pass for this update, covering A → B → A history, invalidation, exact expiry, non-sliding TTL, object-key order, array order, repeated timestamps, identical writes, zero TTL, falsy values, and input validation. The example above produces zero content-stale reads and one revision-stale read with maximum lag 2. These are deterministic fixture results, not production benchmarks. Mobile, laptop, and 3840×2160 layouts have not been verified for this update.

`test.mjs` checks domain outcomes and edge cases, deterministic behavior, input preservation, malformed roots, and size limits. GitHub Actions runs the same suite. Review the tests themselves to see exactly what is covered; passing these checks does not establish security or exhaustive correctness.

## Roadmap

- Add more independently reviewed domain fixtures and explicit schema documentation.
- Add domain-specific form controls alongside the JSON editor.
- Expand accessibility and mobile browser testing.
- Revisit the documented domain limitations before production use.

## Contribution and license

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and [LICENSE](LICENSE).

© 2026 Puskar (Royalpuskar). All rights reserved except permissions granted by the MIT license. Preserve applicable third-party notices.

