/**
 * DataMapper MappingList View
 *
 * Lists MappingConfig rows persisted in the mapper's internal SQLite. Click
 * to load into the editor; × to delete.
 */
const libPictView = require('pict-view');

const _ViewConfiguration =
	{
		ViewIdentifier: 'Mapper-MappingList',
		DefaultRenderable: 'Mapper-MappingList-Content',
		DefaultDestinationAddress: '#DataMapper-MappingList-Slot',
		AutoRender: false,

		CSS: /*css*/`
			.mapping-list { background: #161b22; border: 1px solid #30363d; border-radius: 6px; }
			.ml-header { padding: 10px 16px; border-bottom: 1px solid #30363d; display: flex; justify-content: space-between; align-items: center; }
			.ml-header h2 { margin: 0; font-size: 14px; color: #e6edf3; font-weight: 600; }
			.ml-empty { padding: 16px; text-align: center; color: #8b949e; font-style: italic; }
			.ml-row { display: grid; grid-template-columns: 1fr auto auto; gap: 8px; padding: 10px 16px; border-bottom: 1px solid #21262d; align-items: center; }
			.ml-row:last-child { border-bottom: 0; }
			.ml-row:hover { background: #1c2333; }
			.ml-name { font-size: 13px; color: #e6edf3; font-weight: 500; }
			.ml-sub { font-size: 12px; color: #8b949e; }
		`,

		Templates:
			[
				{
					Hash: 'Mapper-MappingList-Template',
					Template: /*html*/`
<div class="mapping-list">
	<div class="ml-header">
		<h2>Saved Mappings</h2>
		<button class="btn" id="DataMapper-Refresh-Mappings">Refresh</button>
	</div>
	{~TS:Mapper-MappingList-Row:AppData.Mapper.SavedMappingsForTemplate~}
	{~D:AppData.Mapper.SavedMappingsEmptyHTML~}
</div>`
				},
				{
					Hash: 'Mapper-MappingList-Row',
					Template: /*html*/`
<div class="ml-row">
	<div>
		<div class="ml-name">{~D:Record.Name~}</div>
		<div class="ml-sub">{~D:Record.Subline~}</div>
	</div>
	<button class="btn" data-load-mapping="{~D:Record.IDMappingConfig~}">Load</button>
	<button class="btn danger" data-delete-mapping="{~D:Record.IDMappingConfig~}">&times;</button>
</div>`
				}
			],

		Renderables:
			[
				{
					RenderableHash: 'Mapper-MappingList-Content',
					TemplateHash: 'Mapper-MappingList-Template',
					ContentDestinationAddress: '#DataMapper-MappingList-Slot',
					RenderMethod: 'replace'
				}
			]
	};

class PictViewMapperMappingList extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
	}

	onBeforeRender(pRenderable)
	{
		let tmpState = this.pict.AppData.Mapper;
		let tmpSaved = tmpState.SavedMappings || [];

		tmpState.SavedMappingsForTemplate = tmpSaved.map((pM) =>
		{
			let tmpParts = [];
			if (pM.SourceBeaconName) tmpParts.push(`${pM.SourceBeaconName}${pM.SourceEntity ? '/' + pM.SourceEntity : ''}`);
			if (pM.TargetBeaconName) tmpParts.push(`${pM.TargetBeaconName}${pM.TargetEntity ? '/' + pM.TargetEntity : ''}`);
			return {
				IDMappingConfig: pM.IDMappingConfig,
				Name: pM.Name || '(unnamed)',
				Subline: tmpParts.join(' → ')
			};
		});

		tmpState.SavedMappingsEmptyHTML = (tmpSaved.length === 0)
			? '<div class="ml-empty">No saved mappings yet. Save one from the Visual Mapper tab.</div>'
			: '';

		return super.onBeforeRender(pRenderable);
	}

	onAfterRender(pRenderable, pRenderDestinationAddress, pRecord, pContent)
	{
		let tmpProvider = this.pict.providers.MapperAPI;

		let tmpRefreshBtn = this.pict.ContentAssignment.getElement('#DataMapper-Refresh-Mappings');
		if (tmpRefreshBtn && tmpRefreshBtn.length)
		{
			tmpRefreshBtn[0].addEventListener('click', () => tmpProvider.loadSavedMappings());
		}

		let tmpLoadBtns = this.pict.ContentAssignment.getElement('[data-load-mapping]');
		if (tmpLoadBtns && tmpLoadBtns.length)
		{
			for (let i = 0; i < tmpLoadBtns.length; i++)
			{
				tmpLoadBtns[i].addEventListener('click', (pEvent) =>
				{
					let tmpID = parseInt(pEvent.currentTarget.getAttribute('data-load-mapping'), 10);
					if (tmpID) tmpProvider.loadSavedMapping(tmpID);
				});
			}
		}

		let tmpDeleteBtns = this.pict.ContentAssignment.getElement('[data-delete-mapping]');
		if (tmpDeleteBtns && tmpDeleteBtns.length)
		{
			for (let i = 0; i < tmpDeleteBtns.length; i++)
			{
				tmpDeleteBtns[i].addEventListener('click', (pEvent) =>
				{
					let tmpID = parseInt(pEvent.currentTarget.getAttribute('data-delete-mapping'), 10);
					if (tmpID) tmpProvider.deleteSavedMapping(tmpID);
				});
			}
		}

		return super.onAfterRender(pRenderable, pRenderDestinationAddress, pRecord, pContent);
	}
}

module.exports = PictViewMapperMappingList;
module.exports.default_configuration = _ViewConfiguration;
