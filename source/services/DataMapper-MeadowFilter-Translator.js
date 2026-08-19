/**
 * DataMapper -- meadow-filter string to structured SQL filter translator
 *
 * The pull-based operation layouts pass a meadow filter string
 * (`FBV~Action~NE~DELETE`) straight through to a `/FilteredTo/` URL, where
 * meadow-endpoints parses it. The SQL push-down layouts have no URL to splice
 * it into — they hand a structured spec to a databeacon SQL emitter. This
 * translates the one into the other so an operation author writes the same
 * filter grammar regardless of which layout the operation compiles to.
 *
 * The output shape is the emitter's Filter array:
 *   [ { Column, Operator, Value, Connector } ]
 * with SQL operator tokens ('!=', 'IN', 'IS NULL', …), never the meadow
 * mnemonics — see DataBeacon-SQLEmitter-Aggregate.js for why that distinction
 * is load-bearing ('IN' means IS NULL in one grammar and a value list in the
 * other).
 *
 * Stanza conversion is delegated to `meadow-filter` itself, so the grammar
 * has exactly one implementation. What this module adds is a preflight over
 * the instruction tokens: `meadow-filter` ignores stanzas it cannot parse and
 * still reports success, which in a push-down context means silently
 * aggregating rows the caller asked to exclude. Anything not on the supported
 * list throws instead.
 *
 * @author Steven Velozo <steven@velozo.com>
 * @license MIT
 */

const libMeadowFilterParse = require('meadow-filter').parse;

// Instructions that translate to a WHERE term. The JSON-valued stanzas
// (FBJV/FBJL/FBJD/FSJF) are excluded deliberately: meadow-filter renders them
// as MySQL-specific `JSON_VALID(...)` / `JSON_EXTRACT(...)` column expressions,
// which are neither simple identifiers nor portable across the five dialects
// the emitters support.
const SUPPORTED_INSTRUCTIONS =
{
	'FBV':   true,
	'FBVOR': true,
	'FBL':   true,
	'FBLOR': true,
	'FOP':   true,
	'FOPOR': true,
	'FCP':   true
};

const INSTRUCTION_GUIDANCE =
{
	'FBD':   'FBD/FBDOR date stanzas wrap the column in DATE(), which the SQL push-down emitters reject as a non-identifier. Filter on the raw column with GE/LE bounds instead.',
	'FBDOR': 'FBD/FBDOR date stanzas wrap the column in DATE(), which the SQL push-down emitters reject as a non-identifier. Filter on the raw column with GE/LE bounds instead.',
	'FBJV':   'JSON stanzas (FBJV/FBJVOR/FBJL/FBJLOR/FBJD) render engine-specific JSON functions and cannot be pushed down. Use the in-memory layout (OperationType=Aggregation) for JSON-valued filters.',
	'FBJVOR': 'JSON stanzas (FBJV/FBJVOR/FBJL/FBJLOR/FBJD) render engine-specific JSON functions and cannot be pushed down. Use the in-memory layout (OperationType=Aggregation) for JSON-valued filters.',
	'FBJL':   'JSON stanzas (FBJV/FBJVOR/FBJL/FBJLOR/FBJD) render engine-specific JSON functions and cannot be pushed down. Use the in-memory layout (OperationType=Aggregation) for JSON-valued filters.',
	'FBJLOR': 'JSON stanzas (FBJV/FBJVOR/FBJL/FBJLOR/FBJD) render engine-specific JSON functions and cannot be pushed down. Use the in-memory layout (OperationType=Aggregation) for JSON-valued filters.',
	'FBJD':   'JSON stanzas (FBJV/FBJVOR/FBJL/FBJLOR/FBJD) render engine-specific JSON functions and cannot be pushed down. Use the in-memory layout (OperationType=Aggregation) for JSON-valued filters.',
	'FSF':    'FSF sort stanzas have no meaning in an aggregate WHERE — set OperationConfiguration.OrderBy instead.',
	'FSJF':   'FSF/FSJF sort stanzas have no meaning in an aggregate WHERE — set OperationConfiguration.OrderBy instead.',
	'FDST':   'FDST (distinct) is not part of the aggregate push-down — a GROUP BY over the same columns is already distinct.'
};

/**
 * Collects the addFilter() calls meadow-filter makes against what it believes
 * is a foxhound query. Only the surface meadow-filter actually touches is
 * implemented.
 */
class FilterTermCollector
{
	constructor()
	{
		this.Terms = [];
		this.Sorts = [];
	}

	/**
	 * @param {string} pColumn - the column being filtered (empty for paren terms)
	 * @param {any} pValue - the filter value
	 * @param {string} [pOperator] - the SQL comparison operator
	 * @param {string} [pConnector] - AND / OR
	 *
	 * @return {FilterTermCollector} this, for chaining
	 */
	addFilter(pColumn, pValue, pOperator, pConnector)
	{
		let tmpOperator = (pOperator === undefined) ? '=' : pOperator;
		let tmpTerm = { Operator: tmpOperator };
		if (tmpOperator !== '(' && tmpOperator !== ')')
		{
			tmpTerm.Column = pColumn;
			tmpTerm.Value = pValue;
		}
		if (pConnector !== undefined && tmpOperator !== ')')
		{
			tmpTerm.Connector = pConnector;
		}
		this.Terms.push(tmpTerm);
		return this;
	}

	/**
	 * @param {Object} pSort - the sort stanza meadow-filter builds
	 *
	 * @return {FilterTermCollector} this, for chaining
	 */
	addSort(pSort)
	{
		this.Sorts.push(pSort);
		return this;
	}
}

/**
 * Check every instruction token in a meadow filter string against the set the
 * SQL push-down emitters can honor.
 *
 * @param {string} pFilterExpression - the meadow filter string
 *
 * @return {number} the number of stanzas the string contains
 */
const assertSupportedInstructions = (pFilterExpression) =>
{
	let tmpTerms = pFilterExpression.split('~');
	if (tmpTerms.length < 4)
	{
		throw new Error('FilterExpression: "' + pFilterExpression + '" is not a meadow filter string — expected tilde-delimited INSTRUCTION~FIELD~OPERATOR~VALUE stanzas (e.g. FBV~Action~NE~DELETE).');
	}
	if (tmpTerms.length % 4 !== 0)
	{
		throw new Error('FilterExpression: "' + pFilterExpression + '" has ' + tmpTerms.length + ' tilde-delimited terms, which is not a whole number of 4-term stanzas.');
	}

	for (let i = 0; i < tmpTerms.length; i += 4)
	{
		let tmpInstruction = tmpTerms[i];
		if (SUPPORTED_INSTRUCTIONS[tmpInstruction])
		{
			continue;
		}
		let tmpGuidance = INSTRUCTION_GUIDANCE[tmpInstruction];
		if (tmpGuidance)
		{
			throw new Error('FilterExpression: stanza ' + ((i / 4) + 1) + ' uses ' + tmpInstruction + ', which cannot be pushed into the source query. ' + tmpGuidance);
		}
		throw new Error('FilterExpression: stanza ' + ((i / 4) + 1) + ' uses unrecognized instruction "' + tmpInstruction + '". Supported: ' + Object.keys(SUPPORTED_INSTRUCTIONS).join(', ') + '.');
	}

	return tmpTerms.length / 4;
};

/**
 * Translate a meadow filter string into the structured Filter array the
 * databeacon SQL emitters accept.
 *
 * @param {string} pFilterExpression - meadow filter string (e.g. 'FBV~Action~NE~DELETE')
 *
 * @return {Array<Object>} the structured filter terms
 */
const translateFilterExpression = (pFilterExpression) =>
{
	if (typeof(pFilterExpression) !== 'string' || pFilterExpression.trim() === '')
	{
		throw new Error('FilterExpression: expected a non-empty meadow filter string.');
	}

	let tmpExpression = pFilterExpression.trim();
	assertSupportedInstructions(tmpExpression);

	let tmpCollector = new FilterTermCollector();
	libMeadowFilterParse(tmpExpression, tmpCollector);

	if (tmpCollector.Terms.length === 0)
	{
		throw new Error('FilterExpression: "' + tmpExpression + '" produced no filter terms.');
	}

	return tmpCollector.Terms;
};

module.exports = { translateFilterExpression, FilterTermCollector, SUPPORTED_INSTRUCTIONS };
