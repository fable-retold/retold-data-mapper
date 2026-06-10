# Unnest Records

`UnnestRecords` explodes an **array-of-objects column** into one target record **per element** (a 1 → N transform). It is the `DataMapperTransform:UnnestRecords` beacon action, and the typed operation `OperationType=Unnest`. Use it to flatten a repeating sub-structure — a form table, a line-item array, a list of measurements stored inside one parent row — into its own table where each element becomes a row.

For example, a `Document` whose `MoistureTable` column holds `[{Layer:'A',…},{Layer:'B',…}]` becomes two `MoistureReading` rows, one per layer, each carrying the parent's `SampleID`.

## Where it lives

Like the other typed operations, the routing (which beacons / connections / entities) lives on the surrounding `OperationConfig` row, and the per-element shaping lives in `OperationConfiguration`:

```json
{
	"Name": "Explode Document.MoistureTable -> MoistureReading",
	"OperationType": "Unnest",
	"SourceBeaconName": "source-databeacon",
	"SourceConnectionHash": "source-main",
	"SourceEntity": "Document",
	"TargetBeaconName": "target-databeacon",
	"TargetConnectionHash": "target-main",
	"TargetTable": "MoistureReading",
	"OperationConfiguration": { }
}
```

The data-mapper bridge compiles this into a `Pull → UnnestRecords → BuildComprehension → Write` Ultravisor operation graph (the same shape as `Extraction`, with `UnnestRecords` in the middle). The action can also be driven directly with `Records` + `OperationConfiguration` settings.

## The format

```json
{
	"Entity": "MoistureReading",
	"GUIDName": "GUIDMoistureReading",
	"GUIDTemplate": "MR_{~D:Record.SampleID~}_{~D:Record.ElementIndex~}",
	"ArrayPath": "MoistureTable",
	"ParentCarry": {
		"SampleID": "{~D:Record.SampleID~}",
		"ElementIndex": "{~D:Record.ElementIndex~}"
	},
	"ElementProjection": {
		"Layer": "{~D:Element.Layer~}",
		"MoisturePct": "{~D:Element.MoisturePct~}",
		"Pass": "{~D:Element.Pass~}"
	},
	"Filter": null,
	"Solvers": []
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `Entity` | yes | The target entity name (also the comprehension key downstream). |
| `GUIDName` | recommended | The GUID/identity column on the target record. Defaults to `"GUID" + Entity` when omitted. |
| `GUIDTemplate` | recommended | A **per-element** deterministic GUID. Reference something element-unique — `Record.ElementIndex` or a field of the element — so every element of a parent gets a distinct GUID; otherwise all elements of one parent collapse to a single upserted row. Determinism is what lets reruns upsert instead of duplicating. |
| `ArrayPath` | **yes** | A dotted path on the source record to the array-of-objects to explode (e.g. `MoistureTable` or `FormData.MoistureTable`). A column that holds the array as a **JSON string** is parsed inline (see below). |
| `ElementProjection` | yes | Target column → expression, evaluated in the **`Element.*` scope** (the current array element). At least one entry is required. |
| `ParentCarry` | no | Target column → expression, evaluated in the **`Record.*` scope** (the parent row). Use it to carry parent keys onto every emitted row. |
| `Filter` | no | A per-element equality map; an element is skipped when any `key` does not match (`==` with a string-coerced fallback). |
| `Solvers` | no | Derived-value solver expressions (`fable.ExpressionParser`) evaluated per emitted row. Optional. |

## Scopes: `Element.*` vs `Record.*`

For each array element, the handler builds a synthetic record `{ ...ParentRow, ElementIndex, Element }` and resolves the mapping against it:

- **`ElementProjection`** values use **`{~D:Element.<field>~}`** — the fields of the current array element.
- **`ParentCarry`** values and **`GUIDTemplate`** use **`{~D:Record.<field>~}`** — the parent row, plus the synthetic **`Record.ElementIndex`** (the 0-based index of the element within its parent's array).

Internally the `Element.*` references are rewritten to `Record.Element.*`, so the standard `TabularTransform` template grammar (and `Solvers`) applies unchanged.

## JSON-string columns

When `ArrayPath` resolves to a **string** rather than an array — common for an intermediate lake table that stores the array as a JSON `TEXT`/`JSON` column — it is `JSON.parse`d inline before exploding. So both of these source shapes work without any extra step:

- a native array column: `MoistureTable = [ {…}, {…} ]`
- a JSON-string column: `MoistureTable = "[{…},{…}]"`

(If the array is nested *inside* a larger JSON-blob column — e.g. the whole `FormData` is one JSON string and the array is at `FormData.MoistureTable` — surface `FormData` as a parsed object first; `UnnestRecords` parses a string **at `ArrayPath`**, not an enclosing blob.)

## Edge cases

- **Empty array** (`[]`) → emits 0 rows for that parent. Not an error; not counted as skipped.
- **Missing / non-array `ArrayPath`** (e.g. `null`) → the parent is skipped and counted in `SkippedNoArray`.
- **Booleans** in element fields render to the strings `"true"` / `"false"` through the template engine, so a target column receiving one should be a string (or coerce on write) rather than an integer/boolean SQL type.

## Output row-count guard

`UnnestRecords` *multiplies* rows, so the usual input guard is not sufficient — it also checks the **running output count** against `DATA_MAPPER_MAX_INMEMORY_ROWS` (default `250000`) and fails fast if N parents × M elements would exceed it. Compose smaller input sets upstream (filter the source) if you hit it.

## Outputs

```jsonc
{
	"RecordCount": 3,        // emitted element rows
	"ElementCount": 3,       // alias of RecordCount
	"FilteredOutCount": 0,   // elements dropped by Filter
	"SkippedNoArray": 1,     // parents whose ArrayPath was not an array
	"Errors": [],
	"Result": "[ … ]"        // the emitted rows (stringified)
}
```

## Worked example

Source `Document` rows (`MoistureTable` is a JSON-string column):

| IDDocument | SampleID | MoistureTable |
|---|---|---|
| 1 | S-100 | `[{"Layer":"A","MoisturePct":12.4,"Pass":true},{"Layer":"B","MoisturePct":18.7,"Pass":false}]` |
| 2 | S-101 | `[{"Layer":"A","MoisturePct":7.7,"Pass":true}]` |
| 3 | S-102 | `[]` |
| 4 | S-103 | `null` |

With the `OperationConfiguration` above, the target `MoistureReading` receives **3 rows** (2 + 1 + 0 + skipped):

| GUIDMoistureReading | SampleID | ElementIndex | Layer | MoisturePct | Pass |
|---|---|---|---|---|---|
| MR_S-100_0 | S-100 | 0 | A | 12.4 | true |
| MR_S-100_1 | S-100 | 1 | B | 18.7 | false |
| MR_S-101_0 | S-101 | 0 | A | 7.7 | true |

## Notes

- **Lightweight fallback.** As with `MapRecords`, when the data-mapper runs without Pict's `parseTemplate`, `UnnestRecords` resolves `{~D:Record.<dotted.path>~}` via a built-in dotted-path resolver (sufficient for `ParentCarry`/`ElementProjection`/`GUIDTemplate`); the full `TabularTransform` path (with `Solvers`) applies when running under Pict, which is the production beacon.
- **There is no existing array→rows primitive to reach for instead.** The ExpressionParser `MULTIROWMAP` directive is a windowed map/reduce that emits a flat array of scalars, not one record per element; `MultipleGUIDUniqueness` is scalar-keyed. `UnnestRecords` is the array-of-objects exploder.
