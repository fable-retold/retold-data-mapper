/**
 * Retold Data Mapper — per-run session forwarding.
 *
 * Two seams:
 *   - ConnectionBridge._injectRunSessionTemplate stamps a Session template onto
 *     every beacon node (identified by Data.AffinityKey) so the run's forwarded
 *     identity reaches the beacon dispatch. Transform nodes are left alone.
 *   - BeaconProvider._sanitizeForwardSession normalizes the resolved value,
 *     treating an empty value or an unresolved template as "no identity".
 *
 *   npx mocha test/DataMapper_SessionForwarding_tests.js -u tdd --exit
 */

const libAssert = require('assert');
const libConnectionBridge = require('../source/services/DataMapper-ConnectionBridge.js');
const libBeaconProvider = require('../source/services/DataMapper-BeaconProvider.js');

const SESSION_TEMPLATE = '{~D:Record.Operation.Session~}';

function injectInto(pGraph)
{
	// The method does not use `this`; call it against a bare object.
	return libConnectionBridge.prototype._injectRunSessionTemplate.call({}, pGraph);
}

suite('DataMapper — _injectRunSessionTemplate', () =>
{
	test('stamps the Session template onto beacon nodes (Data.AffinityKey present)', () =>
	{
		let tmpGraph = { Graph: { Nodes: [
			{ Hash: 'start', Type: 'start' },
			{ Hash: 'pull', Type: 'beacon-datamapperrecords-pullrecords', Data: { SourceBeaconName: 'mpi', AffinityKey: 'data-mapper' } },
			{ Hash: 'write', Type: 'beacon-datamapperrecords-writerecords', Data: { TargetBeaconName: 'lake', AffinityKey: 'data-mapper' } }
		] } };
		injectInto(tmpGraph);
		libAssert.strictEqual(tmpGraph.Graph.Nodes[1].Data.Session, SESSION_TEMPLATE, 'pull node stamped');
		libAssert.strictEqual(tmpGraph.Graph.Nodes[2].Data.Session, SESSION_TEMPLATE, 'write node stamped');
	});

	test('leaves transform nodes (no AffinityKey) untouched', () =>
	{
		let tmpGraph = { Graph: { Nodes: [
			{ Hash: 'extract', Type: 'beacon-datamappertransform-extractrecords', Data: { Projection: {} } },
			{ Hash: 'start', Type: 'start' }
		] } };
		injectInto(tmpGraph);
		libAssert.strictEqual(tmpGraph.Graph.Nodes[0].Data.Session, undefined, 'transform node not stamped');
		libAssert.ok(!('Data' in tmpGraph.Graph.Nodes[1]) || tmpGraph.Graph.Nodes[1].Data === undefined);
	});

	test('is a safe no-op on a malformed graph', () =>
	{
		libAssert.doesNotThrow(() => injectInto(null));
		libAssert.doesNotThrow(() => injectInto({}));
		libAssert.doesNotThrow(() => injectInto({ Graph: {} }));
	});
});

suite('DataMapper — _sanitizeForwardSession', () =>
{
	test('a real session id passes through', () =>
	{
		libAssert.strictEqual(libBeaconProvider._sanitizeForwardSession('sess-abc-123'), 'sess-abc-123');
	});

	test('an UNRESOLVED template resolves to no-identity (empty)', () =>
	{
		libAssert.strictEqual(libBeaconProvider._sanitizeForwardSession(SESSION_TEMPLATE), '');
	});

	test('empty / non-string values resolve to no-identity (empty)', () =>
	{
		libAssert.strictEqual(libBeaconProvider._sanitizeForwardSession(''), '');
		libAssert.strictEqual(libBeaconProvider._sanitizeForwardSession(undefined), '');
		libAssert.strictEqual(libBeaconProvider._sanitizeForwardSession(null), '');
		libAssert.strictEqual(libBeaconProvider._sanitizeForwardSession({ SessionID: 'x' }), '');
	});
});
