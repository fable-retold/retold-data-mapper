/**
 * Pict-Section-Mapping API Provider
 *
 * REST client for the data-mapper /mapper/mappings* surface.
 * Uses the same active-scope localStorage key as the dashboard
 * and operation sections so a host mounting any combination
 * of them gets one coherent active scope.
 */
'use strict';

const SCOPE_STORAGE_KEY = 'retold.dataMapper.activeScope';

class MappingAPIProvider
{
	constructor(pOptions)
	{
		let tmpOptions = pOptions || {};
		this._apiBaseUrl = tmpOptions.APIBaseUrl || '/mapper';
		this._scopeOverride = (typeof tmpOptions.Scope === 'string') ? tmpOptions.Scope : null;
	}

	getScope(pCallScope)
	{
		if (typeof pCallScope === 'string') return pCallScope;
		if (typeof this._scopeOverride === 'string') return this._scopeOverride;
		if (typeof localStorage !== 'undefined')
		{
			let tmpStored = localStorage.getItem(SCOPE_STORAGE_KEY);
			if (tmpStored !== null) return tmpStored;
		}
		return '';
	}

	setScope(pScope)
	{
		if (typeof localStorage !== 'undefined')
		{
			if (pScope) localStorage.setItem(SCOPE_STORAGE_KEY, pScope);
			else localStorage.removeItem(SCOPE_STORAGE_KEY);
		}
		this._scopeOverride = (typeof pScope === 'string') ? pScope : null;
	}

	_fetch(pMethod, pPath, pBody)
	{
		let tmpOpts = { method: pMethod, headers: {} };
		if (pBody !== undefined && pBody !== null)
		{
			tmpOpts.headers['Content-Type'] = 'application/json';
			tmpOpts.body = JSON.stringify(pBody);
		}
		return fetch(this._apiBaseUrl + pPath, tmpOpts).then((pRes) =>
		{
			if (!pRes.ok)
			{
				return pRes.text().then((pText) =>
				{
					let tmpMsg = pText && pText.length < 400 ? pText : ('HTTP ' + pRes.status);
					throw new Error(tmpMsg);
				});
			}
			let tmpCT = pRes.headers.get('content-type') || '';
			if (tmpCT.indexOf('application/json') === 0) return pRes.json();
			return pRes.text();
		});
	}

	_scopeQuery(pScope)
	{
		let tmpScope = this.getScope(pScope);
		if (tmpScope === '') return '';
		return '?scope=' + encodeURIComponent(tmpScope);
	}

	listMappings(pScope) { return this._fetch('GET', '/mappings' + this._scopeQuery(pScope)); }

	saveMapping(pRecord, pScope)
	{
		let tmpRecord = Object.assign({}, pRecord);
		if (tmpRecord.Scope === undefined) tmpRecord.Scope = this.getScope(pScope);
		if (tmpRecord.IDMappingConfig)
		{
			let tmpID = tmpRecord.IDMappingConfig;
			delete tmpRecord.IDMappingConfig;
			return this._fetch('PUT', '/mapping/' + tmpID, tmpRecord);
		}
		return this._fetch('POST', '/mappings', tmpRecord);
	}

	deleteMapping(pID) { return this._fetch('DELETE', '/mapping/' + pID); }

	// Phase B "glue": compile this mapping into an Ultravisor Operation,
	// POST it to UV, trigger via the queue, and return the manifest summary.
	// Server side does the compile + post + trigger; UI just renders the result.
	runViaUltravisor(pID) { return this._fetch('POST', '/uv/run-mapping/' + pID, {}); }

	// Phase C: introspection-driven authoring. Fetch the columns for one
	// entity on a source beacon so the editor can render them as
	// click-to-insert chips. Server handles the hash→ID resolution.
	listSourceColumns(pBeaconName, pConnectionHash, pEntity)
	{
		let tmpQuery = '?ConnectionHash=' + encodeURIComponent(pConnectionHash) +
			'&Entity=' + encodeURIComponent(pEntity);
		return this._fetch('GET', '/beacon/' + encodeURIComponent(pBeaconName) + '/columns' + tmpQuery);
	}
}

module.exports = MappingAPIProvider;
module.exports.SCOPE_STORAGE_KEY = SCOPE_STORAGE_KEY;
