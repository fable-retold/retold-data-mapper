/**
 * DataMapper BeaconBrowser View
 *
 * Two side-by-side selector rows (source + target): beacon → connection →
 * entity dropdowns. Dispatches happen via the MapperAPI provider; this view
 * just reads state and emits click/change events.
 */
const libPictView = require('pict-view');

const _ViewConfiguration =
	{
		ViewIdentifier: 'Mapper-BeaconBrowser',
		DefaultRenderable: 'Mapper-BeaconBrowser-Content',
		DefaultDestinationAddress: '#DataMapper-BeaconBrowser-Slot',
		AutoRender: false,

		CSS: /*css*/`
			.beacon-browser { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 12px 16px; margin-bottom: 12px; }
			.bb-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
			.bb-row:last-child { margin-bottom: 0; }
			.bb-label { width: 64px; color: #8b949e; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
			.bb-divider { height: 1px; background: #30363d; margin: 10px 0; }
		`,

		Templates:
			[
				{
					Hash: 'Mapper-BeaconBrowser-Template',
					Template: /*html*/`
<div class="beacon-browser">
	<div class="mapper-section-title">Beacon &amp; Entity Selection</div>
	<div class="bb-row">
		<span class="bb-label">Source</span>
		<select id="DataMapper-Source-Beacon">
			<option value="">— beacon —</option>
			{~TS:Mapper-BeaconBrowser-BeaconOpt:AppData.Mapper.SourceBeacons~}
		</select>
		<select id="DataMapper-Source-Connection">
			<option value="">— connection —</option>
			{~TS:Mapper-BeaconBrowser-ConnOpt:AppData.Mapper.SourceConnectionsForTemplate~}
		</select>
		<select id="DataMapper-Source-Entity">
			<option value="">— entity —</option>
			{~TS:Mapper-BeaconBrowser-EntityOpt:AppData.Mapper.SourceEntitiesForTemplate~}
		</select>
	</div>
	<div class="bb-divider"></div>
	<div class="bb-row">
		<span class="bb-label">Target</span>
		<select id="DataMapper-Target-Beacon">
			<option value="">— beacon —</option>
			{~TS:Mapper-BeaconBrowser-BeaconOpt:AppData.Mapper.TargetBeacons~}
		</select>
		<select id="DataMapper-Target-Connection">
			<option value="">— connection —</option>
			{~TS:Mapper-BeaconBrowser-ConnOpt:AppData.Mapper.TargetConnectionsForTemplate~}
		</select>
		<select id="DataMapper-Target-Entity">
			<option value="">— entity —</option>
			{~TS:Mapper-BeaconBrowser-EntityOpt:AppData.Mapper.TargetEntitiesForTemplate~}
		</select>
	</div>
</div>`
				},
				{
					Hash: 'Mapper-BeaconBrowser-BeaconOpt',
					Template: /*html*/`<option value="{~D:Record.Name~}" {~D:Record.SelectedAttr~}>{~D:Record.Name~}</option>`
				},
				{
					Hash: 'Mapper-BeaconBrowser-ConnOpt',
					Template: /*html*/`<option value="{~D:Record.IDBeaconConnection~}" {~D:Record.SelectedAttr~}>#{~D:Record.IDBeaconConnection~} {~D:Record.Name~} ({~D:Record.Type~})</option>`
				},
				{
					Hash: 'Mapper-BeaconBrowser-EntityOpt',
					Template: /*html*/`<option value="{~D:Record.TableName~}" {~D:Record.SelectedAttr~}>{~D:Record.TableName~} ({~D:Record.ColumnCount~} cols)</option>`
				}
			],

		Renderables:
			[
				{
					RenderableHash: 'Mapper-BeaconBrowser-Content',
					TemplateHash: 'Mapper-BeaconBrowser-Template',
					ContentDestinationAddress: '#DataMapper-BeaconBrowser-Slot',
					RenderMethod: 'replace'
				}
			]
	};

class PictViewMapperBeaconBrowser extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
	}

	onAfterRender(pRenderable, pRenderDestinationAddress, pRecord, pContent)
	{
		let tmpProvider = this.pict.providers.MapperAPI;

		let fBindChange = (pSelector, fHandler) =>
		{
			let tmpEl = this.pict.ContentAssignment.getElement(pSelector);
			if (tmpEl && tmpEl.length) tmpEl[0].addEventListener('change', fHandler);
		};

		fBindChange('#DataMapper-Source-Beacon', (pEvent) =>
		{
			tmpProvider.loadSourceConnections(pEvent.target.value);
		});
		fBindChange('#DataMapper-Source-Connection', (pEvent) =>
		{
			let tmpID = parseInt(pEvent.target.value, 10);
			if (tmpID) { tmpProvider.introspectSource(tmpID); }
		});
		fBindChange('#DataMapper-Source-Entity', (pEvent) =>
		{
			tmpProvider.setSourceEntity(pEvent.target.value);
		});

		fBindChange('#DataMapper-Target-Beacon', (pEvent) =>
		{
			tmpProvider.loadTargetConnections(pEvent.target.value);
		});
		fBindChange('#DataMapper-Target-Connection', (pEvent) =>
		{
			let tmpID = parseInt(pEvent.target.value, 10);
			if (tmpID) { tmpProvider.introspectTarget(tmpID); }
		});
		fBindChange('#DataMapper-Target-Entity', (pEvent) =>
		{
			tmpProvider.setTargetEntity(pEvent.target.value);
		});

		return super.onAfterRender(pRenderable, pRenderDestinationAddress, pRecord, pContent);
	}
}

module.exports = PictViewMapperBeaconBrowser;
module.exports.default_configuration = _ViewConfiguration;
