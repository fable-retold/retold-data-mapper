# Feature request — PullRecords must fail on a failed read

**Stacks on:** `bigal-fail-harder` (`5c96cde`, v1.0.33)
**Status:** implemented in 1.0.38 — the four paths below. The companion self-heal remains proposed.
**Motivating incident:** a customer's dashboards served stale data for two months. Every scheduled
run reported success.

---

## Why the branch does not already cover this

`bigal-fail-harder` fixes the *transform input* handoff. `_resolveRecordsSetting` /
`_resolveConfigSetting` now throw when a records or configuration setting is absent, blank,
unparseable, or not an array, for `UnnestRecords`, `MapRecords`, `ExtractRecords`, plus
`CloneStream`'s source count and `JoinStream`'s connection lookup. The rule it establishes is
stated in the commit and pinned by `test/SettingResolution_tests.js:85`:

> `'[]'` is the ONLY thing that means empty.

That rule is correct. The problem is that **`PullRecords` manufactures `'[]'` out of a failed
read**, so a broken source is laundered into the one value the new guard is designed to trust.
`git diff main..bigal-fail-harder -- source/services/DataMapper-BeaconProvider.js` contains no
`PullRecords` hunk, so the two changes do not overlap.

## The four paths that report success on failure

All in the `PullRecords` handler:

| # | Condition | Current behavior |
|---|---|---|
| 1 | `!_Client \|\| !SourceBeaconName \|\| !ConnectionHash \|\| !Entity` | `fHandlerCallback(null, { Records: [], RecordCount: 0 })` + a Log line |
| 2 | `pError` from the MeadowProxy dispatch | success with whatever partial rows accumulated; **no `Errors` field at all** |
| 3 | Any non-2xx that is not `>= 500` — notably **404** | falls through to the body handler |
| 4 | `Array.isArray(tmpBody) ? tmpBody : []` | a non-array body becomes an empty page |

Path 4 is the sharpest. Two real bodies hit it:

- a `404` error object, when the connection or the entity's endpoint does not exist;
- **`HTTP 200` with `{"Error":"You must be authenticated to access this resource."}`** — the
  platform API answers auth failures with a 200 and an error object, verified live.

The pull then sees `tmpRecords.length (0) < tmpBatchSize`, treats it as the last page, and returns
`Outputs.Result = JSON.stringify([])`. Only `>= 500`, after two retries, ever sets `Errors: 1`.

## What it looked like in production

The source connection an operation addressed had been deleted. Every scheduled run logged:

```
stage [proj-c182-Moisture_Samples] Complete in 3115ms — read=0 written=0 errors=0
stage [proj-c182-Moisture_Facts]   Complete in 13027ms — read=3369 written=3369 errors=0
stage [proj-c182-Moisture_Daily]   Complete in 6249ms — read=3369 written=1443 errors=0
group Succeeded.
```

Stage 1 is the only stage reading the external source. Stages 2 and 3 re-read the stale lake rows,
rewrote them, and bumped their `UpdateDate` — so the lake *looked* refreshed, the group stamped
`Succeeded`, and no alert fired. Two months.

## Proposed change

Fail the work item on each of the four paths. Concretely:

1. **Missing settings** — `fHandlerCallback(new Error(...))` naming the missing setting. A pull that
   cannot address a source has not read an empty source.
2. **Dispatch error** — fail, and include the offset and the underlying message. Partial rows must
   never be returned as a complete result.
3. **Non-2xx** — after the existing first-batch sort-filter fallback is spent, fail on any non-2xx
   rather than only `>= 500`. A `404` is the single most likely symptom of a missing endpoint or a
   deleted connection and is currently indistinguishable from "no rows".
4. **Non-array body** — fail rather than coercing to `[]`, and put a truncated rendering of the body
   in the message. Reuse `_describeSettingValue` from this branch. Special-case the
   `HTTP 200 + {Error: ...}` shape so the message says "the source answered 200 with an error
   payload" rather than "expected an array".

A caller for whom an unavailable source is acceptable wires the node's Error port — the same
escape hatch `_resolveRecordsSetting` already documents. Tolerance belongs in the operation graph,
not in the puller.

### Suggested tests

Mirroring `test/SettingResolution_tests.js`:

- a 200 with a JSON array is the only success
- a 200 with `{Error: ...}` fails, and the message says so
- a 404 fails once the sort-filter fallback has been used
- a dispatch error fails and does not return partial rows
- missing `Entity` / `ConnectionHash` / `SourceBeaconName` each fail by name
- a genuinely empty source still succeeds and emits `Result: '[]'` — the one case that must not regress

### Compatibility

Behavior-changing by design: graphs that today "succeed" against a broken source will begin to fail.
That is the point, and it is the same trade `bigal-fail-harder` already made for transform inputs.
Worth calling out in the release note, because the failures it surfaces will look like new breakage
and will in fact be pre-existing breakage becoming visible.

---

## Companion: let PullRecords self-heal a missing endpoint

Related but separable, and much lower priority **if the above lands**.

A dataset's dynamic CRUD endpoint must be enabled on its beacon before the pull's meadow LIST route
exists, and *endpoint enablement does not survive a beacon redeploy*. Today only the consuming
service's by-hand pipeline path re-ensures it (`Introspect` + `EnableEndpoint`) before running; the
scheduled path triggers the compiled operation directly and does not. The result is a stage that
works when pushed by hand and silently reads zero on schedule — the worst possible diagnostic
property, because the check disagrees with the thing actually running.

The fix belongs here, not in the scheduler: the scheduler lives wholly inside the UV fabric and
should not reach back into a consuming service. `PullRecords` already holds `SourceBeaconName`,
`ConnectionHash` and `Entity`, already has `_dispatch`, and this file already contains the
`DataBeaconAccess:ListConnections` → match-by-name → `IDBeaconConnection` lookup used by
`JoinStream` and `AggregateStream`. So the handler can, on a first-batch 404 (after the sort-filter
fallback), dispatch `DataBeaconManagement:Introspect` + `EnableEndpoint` to the source beacon and
retry the batch once before failing.

Order matters: **do the failure surfacing first.** With it in place a missing endpoint is a loud
error, and the self-heal becomes a convenience rather than a correctness fix. Without it, the
self-heal would paper over the very signal the first change exists to expose.
