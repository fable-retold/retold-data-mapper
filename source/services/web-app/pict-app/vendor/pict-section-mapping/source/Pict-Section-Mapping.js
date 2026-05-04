/**
 * Pict-Section-Mapping
 *
 * Embeddable Pict view for Mapping CRUD. Mappings are intent docs that
 * the data-mapper compiles into Ultravisor Operations on demand. The
 * Run / Save-and-Schedule actions live on the editor and route through
 * the data-mapper bridge's /uv/* proxy endpoints to Ultravisor.
 *
 *   - List view with per-row Edit / Delete actions
 *   - Editor with form fields + JSON MappingConfiguration textarea
 *
 * Note: the data-mapper also has a separate visual mapping editor
 * (the existing pict-app at index.html) for graphical field mapping.
 * This section is the lightweight CRUD surface; the visual editor is
 * the richer alternative for editing MappingConfiguration.
 */
'use strict';

const libPictView    = require('pict-view');
const libDefaultConf = require('./Pict-Section-Mapping-DefaultConfiguration.js');
const libCSS         = require('./Pict-Section-Mapping-CSS.js');
const libAPIProvider = require('./providers/PictProvider-Mapping-API.js');

const DEFAULT_MAPPING_CONFIGURATION = {
	Entity:       '/* TargetEntity */',
	GUIDName:     'GUID/* TargetEntity */',
	GUIDTemplate: '/* {~D:Record.SourceField~} for unique-per-row GUID */',
	Solvers:      [],
	Mappings:
	{
		'/* TargetField */': '{~D:Record./* SourceField */~}'
	}
};

class PictSectionMapping extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, libDefaultConf, pOptions || {});
		super(pFable, tmpOptions, pServiceHash);

		this._API = new libAPIProvider({
			APIBaseUrl: this.options.APIBaseUrl,
			Scope:      this.options.Scope
		});

		this._state = { view: 'list', mappings: [], editing: null };

		if (this.pict && this.pict.CSSMap && typeof this.pict.CSSMap.addCSS === 'function')
		{
			this.pict.CSSMap.addCSS('Pict-Section-Mapping-CSS', libCSS, 500);
		}
	}

	openList()         { this._state.view = 'list'; this._state.editing = null; this.render(); }
	openEditor(pRec)   { this._state.editing = pRec || null; this._state.view = 'edit'; this.render(); }
	refresh()          { this.render(); }

	onAfterRender(pRenderable, pAddress, pRecord, pContent)
	{
		this.pict.CSSMap.injectCSS();
		this._mount();
		return super.onAfterRender(pRenderable, pAddress, pRecord, pContent);
	}

	_mount()
	{
		let tmpDest = this._dest();
		if (!tmpDest) return;
		tmpDest.innerHTML = '';
		tmpDest.classList.add('psm-root');
		tmpDest.classList.add('psm-mode-' + this.options.Mode);
		if (this.options.ShowToolbar) tmpDest.appendChild(this._buildToolbar());
		let tmpContent = document.createElement('div');
		tmpContent.className = 'psm-content';
		tmpDest.appendChild(tmpContent);
		if (this._state.view === 'list')      this._mountList(tmpContent);
		else if (this._state.view === 'edit') this._mountEditor(tmpContent);
	}

	_dest()
	{
		let tmpAddr = this.options.ContentDestinationAddress;
		if (!tmpAddr || typeof document === 'undefined') return null;
		return document.querySelector(tmpAddr);
	}

	_buildToolbar()
	{
		let tmpBar = document.createElement('div');
		tmpBar.className = 'psm-toolbar';
		let tmpTitle = document.createElement('h2'); tmpTitle.textContent = 'Mappings';
		tmpBar.appendChild(tmpTitle);

		if (this._state.view !== 'list')
		{
			let tmpBack = document.createElement('a');
			tmpBack.className = 'psm-btn'; tmpBack.textContent = '← All mappings';
			tmpBack.href = 'javascript:void(0)'; tmpBack.onclick = () => this.openList();
			tmpBar.appendChild(tmpBack);
		}

		let tmpSpacer = document.createElement('span');
		tmpSpacer.className = 'psm-toolbar-spacer';
		tmpBar.appendChild(tmpSpacer);

		let tmpScopeLabel = document.createElement('label');
		tmpScopeLabel.textContent = 'scope';
		let tmpScopeInput = document.createElement('input');
		tmpScopeInput.type = 'text'; tmpScopeInput.className = 'psm-scope-input';
		tmpScopeInput.placeholder = '(global)'; tmpScopeInput.spellcheck = false;
		tmpScopeInput.value = this._API.getScope();
		let tmpDebounce = null;
		tmpScopeInput.oninput = () =>
		{
			clearTimeout(tmpDebounce);
			tmpDebounce = setTimeout(() =>
			{
				this._API.setScope(tmpScopeInput.value.trim());
				this._state.view = 'list'; this._state.editing = null;
				this.render();
			}, 300);
		};
		tmpScopeLabel.appendChild(tmpScopeInput);
		let tmpScopeHint = document.createElement('span');
		tmpScopeHint.className = 'psm-scope-hint';
		tmpScopeHint.textContent = 'empty = global • * = all';
		tmpScopeLabel.appendChild(tmpScopeHint);
		tmpBar.appendChild(tmpScopeLabel);

		if (this.options.Mode === 'manage' && this._state.view === 'list')
		{
			let tmpNew = document.createElement('a');
			tmpNew.className = 'psm-btn psm-btn-primary'; tmpNew.textContent = '+ New mapping';
			tmpNew.href = 'javascript:void(0)'; tmpNew.onclick = () => this.openEditor(null);
			tmpBar.appendChild(tmpNew);
		}
		return tmpBar;
	}

	// ── List view ──────────────────────────────────────────────────

	_mountList(pHost)
	{
		let tmpStatus = document.createElement('div');
		tmpStatus.className = 'psm-empty'; tmpStatus.textContent = 'Loading…';
		pHost.appendChild(tmpStatus);

		this._API.listMappings().then((pData) =>
		{
			pHost.innerHTML = '';
			let tmpRows = (pData && pData.Mappings) || [];
			this._state.mappings = tmpRows;
			if (tmpRows.length === 0)
			{
				let tmpEmpty = document.createElement('div');
				tmpEmpty.className = 'psm-empty';
				let tmpScope = this._API.getScope();
				tmpEmpty.textContent = 'No mappings in '
					+ (tmpScope === '' ? 'global scope' : ('scope "' + tmpScope + '"'))
					+ '. Use scope=* to see all.';
				pHost.appendChild(tmpEmpty);
				return;
			}
			let tmpList = document.createElement('div');
			tmpList.className = 'psm-list';
			for (let i = 0; i < tmpRows.length; i++) tmpList.appendChild(this._buildListRow(tmpRows[i]));
			pHost.appendChild(tmpList);
		}).catch((pErr) =>
		{
			pHost.innerHTML = '';
			let tmpErr = document.createElement('div');
			tmpErr.className = 'psm-error';
			tmpErr.textContent = 'Failed to load mappings: ' + pErr.message;
			pHost.appendChild(tmpErr);
		});
	}

	_buildListRow(pRow)
	{
		let tmpRow = document.createElement('div');
		tmpRow.className = 'psm-list-row';

		let tmpName = document.createElement('div');
		tmpName.className = 'psm-row-name';
		tmpName.textContent = pRow.Name || '(unnamed)';
		if (pRow.Scope) { let tmpScope = document.createElement('span'); tmpScope.className = 'psm-row-scope'; tmpScope.textContent = '· ' + pRow.Scope; tmpName.appendChild(tmpScope); }
		tmpRow.appendChild(tmpName);

		let tmpDesc = document.createElement('div');
		tmpDesc.className = 'psm-row-desc';
		tmpDesc.textContent = pRow.Description || '';
		tmpRow.appendChild(tmpDesc);

		let tmpFlow = document.createElement('div');
		tmpFlow.className = 'psm-row-flow';
		tmpFlow.textContent = (pRow.SourceBeaconName || '?') + '/' + (pRow.SourceEntity || '?')
			+ ' → ' + (pRow.TargetBeaconName || '?') + '/' + (pRow.TargetEntity || '?');
		tmpRow.appendChild(tmpFlow);

		let tmpActions = document.createElement('div');
		tmpActions.className = 'psm-row-actions';
		if (this.options.Mode === 'manage')
		{
			let tmpRun = document.createElement('a');
			tmpRun.className = 'psm-btn psm-btn-success'; tmpRun.textContent = '▶ Run via UV';
			tmpRun.href = 'javascript:void(0)'; tmpRun.onclick = () => this._runViaUltravisor(pRow, tmpRow);
			tmpRun.title = 'Compile this mapping into an Ultravisor Operation, run it through UV\'s queue, and show the manifest summary.';
			tmpActions.appendChild(tmpRun);
			let tmpEdit = document.createElement('a');
			tmpEdit.className = 'psm-btn'; tmpEdit.textContent = 'Edit';
			tmpEdit.href = 'javascript:void(0)'; tmpEdit.onclick = () => this.openEditor(pRow);
			tmpActions.appendChild(tmpEdit);
			let tmpDel = document.createElement('a');
			tmpDel.className = 'psm-btn psm-btn-danger'; tmpDel.textContent = 'Delete';
			tmpDel.href = 'javascript:void(0)'; tmpDel.onclick = () => this._confirmDelete(pRow);
			tmpActions.appendChild(tmpDel);
		}
		tmpRow.appendChild(tmpActions);
		return tmpRow;
	}

	// Compile this mapping into a UV Operation (server-side), run it through
	// the queue, and render the manifest summary inline. This is the new
	// "glue" path — the data-mapper UI captures intent, UV does the work.
	_runViaUltravisor(pRow, pRowEl)
	{
		if (!pRow.IDMappingConfig)
		{
			this._toast('Run failed: missing IDMappingConfig', 'error');
			return;
		}
		let tmpRunBtn = pRowEl.querySelector('.psm-btn-success');
		let tmpOriginal = tmpRunBtn ? tmpRunBtn.textContent : '';
		if (tmpRunBtn) { tmpRunBtn.textContent = 'Running…'; tmpRunBtn.classList.add('psm-btn-disabled'); }

		this._API.runViaUltravisor(pRow.IDMappingConfig).then((pResult) =>
		{
			if (tmpRunBtn) { tmpRunBtn.textContent = tmpOriginal; tmpRunBtn.classList.remove('psm-btn-disabled'); }
			this._renderUVResult(pRowEl, pRow, pResult, false);
		}).catch((pErr) =>
		{
			if (tmpRunBtn) { tmpRunBtn.textContent = tmpOriginal; tmpRunBtn.classList.remove('psm-btn-disabled'); }
			this._renderUVResult(pRowEl, pRow, { Error: pErr.message }, true);
		});
	}

	_renderUVResult(pRowEl, pRow, pResult, pIsError)
	{
		let tmpExisting = pRowEl.nextElementSibling;
		if (tmpExisting && tmpExisting.classList && tmpExisting.classList.contains('psm-run-result')) tmpExisting.remove();

		let tmpPanel = document.createElement('div');
		tmpPanel.className = 'psm-run-result ' + (pIsError ? 'psm-run-error' : 'psm-run-success');

		let tmpHeader = document.createElement('h4');
		let tmpName = pRow.Name || pRow.Hash || ('mapping ' + pRow.IDMappingConfig);
		let tmpUVLabel = pResult && pResult.OperationHash ? (' [' + pResult.OperationHash + ']') : '';
		tmpHeader.textContent = pIsError
			? ('✗  ' + tmpName + ' — failed')
			: ('✓  ' + tmpName + tmpUVLabel + ' — ' + (pResult.Status || 'unknown'));
		tmpPanel.appendChild(tmpHeader);

		if (pIsError)
		{
			let tmpErr = document.createElement('div');
			tmpErr.style.color = '#fecaca'; tmpErr.style.fontFamily = 'monospace'; tmpErr.style.fontSize = '12px';
			tmpErr.textContent = pResult.Error;
			tmpPanel.appendChild(tmpErr);
		}
		else
		{
			let tmpStats = document.createElement('div');
			tmpStats.className = 'psm-run-stats';
			let tmpTopFields = ['ElapsedMs'];
			for (let i = 0; i < tmpTopFields.length; i++)
			{
				if (pResult[tmpTopFields[i]] === undefined || pResult[tmpTopFields[i]] === null) continue;
				let tmpStat = document.createElement('div');
				tmpStat.className = 'psm-run-stat';
				let tmpLabel = document.createElement('span');
				tmpLabel.className = 'psm-stat-label'; tmpLabel.textContent = tmpTopFields[i];
				let tmpValue = document.createElement('span');
				tmpValue.className = 'psm-stat-value'; tmpValue.textContent = String(pResult[tmpTopFields[i]]);
				tmpStat.appendChild(tmpLabel); tmpStat.appendChild(tmpValue);
				tmpStats.appendChild(tmpStat);
			}
			tmpPanel.appendChild(tmpStats);

			// Per-task breakdown — pull/map/write counts from the manifest.
			let tmpTO = pResult.TaskOutputs || {};
			let tmpTaskKeys = Object.keys(tmpTO);
			if (tmpTaskKeys.length > 0)
			{
				let tmpBreakdown = document.createElement('div');
				tmpBreakdown.className = 'psm-run-stats';
				tmpBreakdown.style.marginTop = '8px';
				for (let k = 0; k < tmpTaskKeys.length; k++)
				{
					let tmpKey = tmpTaskKeys[k];
					let tmpRow = tmpTO[tmpKey];
					let tmpStat = document.createElement('div');
					tmpStat.className = 'psm-run-stat';
					let tmpLabel = document.createElement('span');
					tmpLabel.className = 'psm-stat-label'; tmpLabel.textContent = tmpKey;
					let tmpValue = document.createElement('span');
					tmpValue.className = 'psm-stat-value';
					let tmpParts = [];
					if (tmpRow.RecordCount !== undefined) tmpParts.push('records=' + tmpRow.RecordCount);
					if (tmpRow.Written     !== undefined) tmpParts.push('written=' + tmpRow.Written);
					if (tmpRow.Errors      !== undefined && tmpRow.Errors !== 0) tmpParts.push('errors=' + tmpRow.Errors);
					tmpValue.textContent = tmpParts.join('  ');
					tmpStat.appendChild(tmpLabel); tmpStat.appendChild(tmpValue);
					tmpBreakdown.appendChild(tmpStat);
				}
				tmpPanel.appendChild(tmpBreakdown);
			}
		}
		pRowEl.parentNode.insertBefore(tmpPanel, pRowEl.nextSibling);
	}

	_confirmDelete(pRow)
	{
		let tmpModal = this.pict.views && this.pict.views.Modal;
		if (tmpModal && typeof tmpModal.confirm === 'function')
		{
			tmpModal.confirm(
				'Delete mapping "' + (pRow.Name || pRow.Hash) + '"? This cannot be undone.',
				{ confirmLabel: 'Delete', cancelLabel: 'Cancel', dangerous: true })
				.then((pOk) => { if (pOk) this._doDelete(pRow); });
			return;
		}
		// eslint-disable-next-line no-alert
		if (typeof confirm === 'function' && confirm('Delete mapping "' + (pRow.Name) + '"?')) this._doDelete(pRow);
	}

	_doDelete(pRow)
	{
		if (!pRow.IDMappingConfig) { this._toast('Delete failed: missing IDMappingConfig', 'error'); return; }
		this._API.deleteMapping(pRow.IDMappingConfig).then(() =>
		{
			this._toast('Mapping deleted.', 'success');
			this.openList();
		}).catch((pErr) => this._toast('Delete failed: ' + pErr.message, 'error'));
	}

	_toast(pMsg, pType)
	{
		let tmpModal = this.pict.views && this.pict.views.Modal;
		if (tmpModal && typeof tmpModal.toast === 'function') { tmpModal.toast(pMsg, { type: pType || 'info' }); return; }
		// eslint-disable-next-line no-console
		console.log('[psm]', pMsg);
	}

	// ── Editor ─────────────────────────────────────────────────────

	_mountEditor(pHost)
	{
		let tmpRec = this._state.editing || {
			Scope: this._API.getScope(),
			Name: '', Description: '',
			SourceBeaconName: '', SourceConnectionHash: '', SourceEntity: '',
			TargetBeaconName: '', TargetConnectionHash: '', TargetEntity: '',
			MappingConfiguration: JSON.stringify(DEFAULT_MAPPING_CONFIGURATION, null, 2)
		};
		let tmpIsNew = !(tmpRec && tmpRec.IDMappingConfig);

		let tmpConfText = (typeof tmpRec.MappingConfiguration === 'string')
			? tmpRec.MappingConfiguration
			: JSON.stringify(tmpRec.MappingConfiguration || {}, null, 2);

		let tmpWrap = document.createElement('div'); tmpWrap.className = 'psm-editor';
		let tmpHeader = document.createElement('div'); tmpHeader.className = 'psm-editor-header';
		let tmpHeaderTitle = document.createElement('h3');
		tmpHeaderTitle.textContent = tmpIsNew ? 'New mapping' : ('Edit mapping "' + (tmpRec.Name || tmpRec.IDMappingConfig) + '"');
		tmpHeader.appendChild(tmpHeaderTitle);
		tmpWrap.appendChild(tmpHeader);

		let tmpForm = document.createElement('div'); tmpForm.className = 'psm-editor-form';

		let tmpNameLbl = document.createElement('label'); tmpNameLbl.textContent = 'Name';
		let tmpNameInput = document.createElement('input'); tmpNameInput.type = 'text';
		tmpNameInput.value = tmpRec.Name || '';
		tmpNameInput.placeholder = 'Human-readable name (e.g. "weather → WeatherSummary")';
		tmpForm.appendChild(tmpNameLbl); tmpForm.appendChild(tmpNameInput);

		let tmpScopeLbl = document.createElement('label'); tmpScopeLbl.textContent = 'Scope';
		let tmpScopeInput = document.createElement('input'); tmpScopeInput.type = 'text';
		tmpScopeInput.value = tmpRec.Scope || ''; tmpScopeInput.placeholder = '(empty = global)';
		tmpForm.appendChild(tmpScopeLbl); tmpForm.appendChild(tmpScopeInput);

		let tmpDescLbl = document.createElement('label'); tmpDescLbl.textContent = 'Description';
		let tmpDescInput = document.createElement('input'); tmpDescInput.type = 'text';
		tmpDescInput.value = tmpRec.Description || '';
		tmpForm.appendChild(tmpDescLbl); tmpForm.appendChild(tmpDescInput);

		let tmpSTLbl = document.createElement('label'); tmpSTLbl.textContent = 'Source ↔ Target';
		let tmpST = document.createElement('div'); tmpST.className = 'psm-source-target';
		let tmpSrc = this._buildSTSection('Source',
			['SourceBeaconName', 'SourceConnectionHash', 'SourceEntity'],
			['Beacon', 'Connection', 'Entity'],
			[tmpRec.SourceBeaconName, tmpRec.SourceConnectionHash, tmpRec.SourceEntity]);
		let tmpTgt = this._buildSTSection('Target',
			['TargetBeaconName', 'TargetConnectionHash', 'TargetEntity'],
			['Beacon', 'Connection', 'Entity'],
			[tmpRec.TargetBeaconName, tmpRec.TargetConnectionHash, tmpRec.TargetEntity]);
		tmpST.appendChild(tmpSrc.section); tmpST.appendChild(tmpTgt.section);
		tmpForm.appendChild(tmpSTLbl); tmpForm.appendChild(tmpST);

		let tmpConfLbl = document.createElement('label'); tmpConfLbl.textContent = 'Configuration (JSON)';
		let tmpConfWrap = document.createElement('div');

		// Phase C: source-column discovery. "Discover columns" calls the
		// data-mapper bridge, which dispatches Introspect through UV
		// to the source beacon and returns the chosen entity's columns.
		// Each column renders as a chip; clicking inserts a {~D:Record.X~}
		// template snippet at the textarea's caret. Cuts the typing
		// without trying to be a full visual mapper.
		let tmpDiscoverBar = document.createElement('div');
		tmpDiscoverBar.className = 'psm-discover-bar';
		let tmpDiscoverBtn = document.createElement('a');
		tmpDiscoverBtn.className = 'psm-btn psm-btn-secondary';
		tmpDiscoverBtn.href = 'javascript:void(0)';
		tmpDiscoverBtn.textContent = '⌕ Discover source columns';
		tmpDiscoverBtn.title = 'Introspect the source beacon for the columns of the selected source Entity.';
		tmpDiscoverBar.appendChild(tmpDiscoverBtn);
		let tmpDiscoverStatus = document.createElement('span');
		tmpDiscoverStatus.className = 'psm-discover-status';
		tmpDiscoverStatus.style.marginLeft = '8px';
		tmpDiscoverStatus.style.fontSize = '12px';
		tmpDiscoverStatus.style.color = '#94a3b8';
		tmpDiscoverBar.appendChild(tmpDiscoverStatus);
		tmpConfWrap.appendChild(tmpDiscoverBar);

		let tmpChipBar = document.createElement('div');
		tmpChipBar.className = 'psm-chip-bar';
		tmpChipBar.style.display = 'none';
		tmpConfWrap.appendChild(tmpChipBar);

		let tmpConfTA = document.createElement('textarea'); tmpConfTA.spellcheck = false;
		tmpConfTA.value = tmpConfText;

		tmpDiscoverBtn.onclick = () =>
		{
			let tmpBN = tmpSrc.values()[0];
			let tmpCH = tmpSrc.values()[1];
			let tmpEN = tmpSrc.values()[2];
			if (!tmpBN || !tmpCH || !tmpEN)
			{
				tmpDiscoverStatus.textContent = 'fill source Beacon, Connection, Entity first';
				tmpDiscoverStatus.style.color = '#fbbf24';
				return;
			}
			tmpDiscoverStatus.textContent = 'introspecting…';
			tmpDiscoverStatus.style.color = '#94a3b8';
			tmpChipBar.innerHTML = '';
			tmpChipBar.style.display = 'none';
			this._API.listSourceColumns(tmpBN, tmpCH, tmpEN).then((pResult) =>
			{
				let tmpCols = (pResult && pResult.Columns) || [];
				if (tmpCols.length === 0)
				{
					tmpDiscoverStatus.textContent = 'no columns returned';
					tmpDiscoverStatus.style.color = '#fbbf24';
					return;
				}
				tmpDiscoverStatus.textContent = 'click a chip to insert {~D:Record.<col>~} at the cursor';
				tmpDiscoverStatus.style.color = '#86efac';
				tmpChipBar.style.display = 'flex';
				for (let i = 0; i < tmpCols.length; i++)
				{
					let tmpCol = tmpCols[i];
					let tmpChip = document.createElement('a');
					tmpChip.className = 'psm-chip';
					tmpChip.href = 'javascript:void(0)';
					tmpChip.textContent = tmpCol.Name + (tmpCol.DataType ? (' :' + tmpCol.DataType) : '');
					tmpChip.title = 'Insert "' + tmpCol.Name + '": "{~D:Record.' + tmpCol.Name + '~}", at cursor';
					tmpChip.onclick = () =>
					{
						let tmpSnippet = '"' + tmpCol.Name + '": "{~D:Record.' + tmpCol.Name + '~}",';
						let tmpStart = tmpConfTA.selectionStart || 0;
						let tmpEnd   = tmpConfTA.selectionEnd   || 0;
						let tmpVal   = tmpConfTA.value;
						tmpConfTA.value = tmpVal.slice(0, tmpStart) + tmpSnippet + tmpVal.slice(tmpEnd);
						let tmpCaret = tmpStart + tmpSnippet.length;
						tmpConfTA.focus();
						tmpConfTA.setSelectionRange(tmpCaret, tmpCaret);
					};
					tmpChipBar.appendChild(tmpChip);
				}
			}).catch((pErr) =>
			{
				tmpDiscoverStatus.textContent = 'failed: ' + pErr.message;
				tmpDiscoverStatus.style.color = '#fca5a5';
			});
		};

		let tmpConfHelp = document.createElement('div');
		tmpConfHelp.className = 'psm-help';
		tmpConfHelp.innerHTML = 'meadow-integration shape: <code>{ Entity, GUIDName, GUIDTemplate, Mappings: { TargetField: "{~D:Record.SourceField~}" }, Solvers }</code>.';
		tmpConfWrap.appendChild(tmpConfTA); tmpConfWrap.appendChild(tmpConfHelp);
		tmpForm.appendChild(tmpConfLbl); tmpForm.appendChild(tmpConfWrap);

		tmpWrap.appendChild(tmpForm);

		let tmpErrBox = document.createElement('div');
		tmpErrBox.className = 'psm-editor-error'; tmpErrBox.style.display = 'none';
		tmpWrap.appendChild(tmpErrBox);

		let tmpActions = document.createElement('div'); tmpActions.className = 'psm-editor-actions';
		let tmpCancel = document.createElement('a');
		tmpCancel.className = 'psm-btn'; tmpCancel.textContent = 'Cancel';
		tmpCancel.href = 'javascript:void(0)'; tmpCancel.onclick = () => this.openList();
		tmpActions.appendChild(tmpCancel);

		let tmpSave = document.createElement('a');
		tmpSave.className = 'psm-btn psm-btn-primary';
		tmpSave.textContent = tmpIsNew ? 'Create mapping' : 'Save changes';
		tmpSave.href = 'javascript:void(0)';
		tmpSave.onclick = () =>
		{
			let tmpName = tmpNameInput.value.trim();
			if (!tmpName) { this._showEditorError(tmpErrBox, 'Name is required.'); return; }
			let tmpConfRaw = tmpConfTA.value;
			let tmpConfParsed;
			try { tmpConfParsed = JSON.parse(tmpConfRaw); }
			catch (pErr) { this._showEditorError(tmpErrBox, 'Configuration JSON parse error: ' + pErr.message); return; }

			let tmpRecord = {
				Name:                  tmpName,
				Scope:                 tmpScopeInput.value.trim(),
				Description:           tmpDescInput.value,
				SourceBeaconName:      tmpSrc.values()[0],
				SourceConnectionHash:  tmpSrc.values()[1],
				SourceEntity:          tmpSrc.values()[2],
				TargetBeaconName:      tmpTgt.values()[0],
				TargetConnectionHash:  tmpTgt.values()[1],
				TargetEntity:          tmpTgt.values()[2],
				MappingConfiguration:  tmpConfParsed
			};
			if (!tmpIsNew && tmpRec.IDMappingConfig) tmpRecord.IDMappingConfig = tmpRec.IDMappingConfig;

			tmpSave.textContent = 'Saving…';
			this._API.saveMapping(tmpRecord).then(() =>
			{
				this._toast(tmpIsNew ? 'Mapping created.' : 'Mapping saved.', 'success');
				this.openList();
			}).catch((pErr) =>
			{
				tmpSave.textContent = tmpIsNew ? 'Create mapping' : 'Save changes';
				this._showEditorError(tmpErrBox, pErr.message);
			});
		};
		tmpActions.appendChild(tmpSave);
		tmpWrap.appendChild(tmpActions);

		pHost.appendChild(tmpWrap);
	}

	_buildSTSection(pTitle, pFieldNames, pLabels, pValues)
	{
		let tmpSection = document.createElement('div'); tmpSection.className = 'psm-st-section';
		let tmpHead = document.createElement('h4'); tmpHead.textContent = pTitle;
		tmpSection.appendChild(tmpHead);
		let tmpInputs = [];
		for (let i = 0; i < pFieldNames.length; i++)
		{
			let tmpRow = document.createElement('div'); tmpRow.className = 'psm-st-row';
			let tmpLabel = document.createElement('label'); tmpLabel.textContent = pLabels[i];
			let tmpInput = document.createElement('input'); tmpInput.type = 'text';
			tmpInput.value = pValues[i] || '';
			tmpInput.placeholder = pFieldNames[i];
			tmpRow.appendChild(tmpLabel); tmpRow.appendChild(tmpInput);
			tmpSection.appendChild(tmpRow);
			tmpInputs.push(tmpInput);
		}
		return { section: tmpSection, values: () => tmpInputs.map((i) => i.value.trim()) };
	}

	_showEditorError(pBox, pMsg) { pBox.textContent = pMsg; pBox.style.display = ''; }
}

PictSectionMapping.default_configuration = Object.assign({}, libDefaultConf,
	{
		Templates:
		[
			{ Hash: 'Pict-Section-Mapping-Shell', Template: '<div class="psm-shell-anchor"></div>' }
		],
		Renderables:
		[
			{ RenderableHash: 'Pict-Section-Mapping-Shell', TemplateHash: 'Pict-Section-Mapping-Shell',
				ContentDestinationAddress: libDefaultConf.DefaultDestinationAddress }
		]
	});

module.exports = PictSectionMapping;
module.exports.default_configuration = PictSectionMapping.default_configuration;
module.exports.APIProvider = libAPIProvider;
