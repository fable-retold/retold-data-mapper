/**
 * DataMapper FieldMapper View
 *
 * Three-column layout: source fields | mappings | target fields. Click a
 * source field, then click a target field, to create a mapping. Drag+drop
 * from source to target works too.
 */
const libPictView = require('pict-view');

const _ViewConfiguration =
	{
		ViewIdentifier: 'Mapper-FieldMapper',
		DefaultRenderable: 'Mapper-FieldMapper-Content',
		DefaultDestinationAddress: '#DataMapper-FieldMapper-Slot',
		AutoRender: false,

		CSS: /*css*/`
			.field-mapper { display: grid; grid-template-columns: 1fr 1.3fr 1fr; gap: 10px; min-height: 360px; }
			.fm-panel { background: #161b22; border: 1px solid #30363d; border-radius: 6px; display: flex; flex-direction: column; overflow: hidden; }
			.fm-panel-header { padding: 10px 12px; border-bottom: 1px solid #30363d; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #8b949e; text-transform: uppercase; letter-spacing: 0.5px; }
			.fm-panel-body { flex: 1; overflow: auto; padding: 8px; }
			.fm-field { background: #0d1117; border: 1px solid #30363d; padding: 6px 10px; border-radius: 4px; margin-bottom: 4px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 13px; user-select: none; }
			.fm-field:hover { border-color: #484f58; }
			.fm-field.selected { border-color: #ff9800; background: #2d1f00; }
			.fm-field.mapped { border-color: #3fb950; }
			.fm-field .fm-type { color: #8b949e; font-size: 11px; }
			.fm-empty { color: #8b949e; padding: 16px; text-align: center; font-style: italic; font-size: 13px; }
			.fm-mapping-drop { border: 1px dashed #30363d; border-radius: 4px; padding: 10px; text-align: center; color: #8b949e; margin: 0 8px 8px 8px; font-size: 12px; }
			.fm-mapping-drop.active { border-color: #ff9800; color: #ff9800; background: #1a140a; }
			.fm-mapping-row { display: grid; grid-template-columns: 1fr auto 1fr auto; gap: 6px; align-items: center; padding: 6px 10px; margin-bottom: 4px; background: #0d1117; border: 1px solid #30363d; border-radius: 4px; font-size: 13px; }
			.fm-arrow { color: #ff9800; font-weight: bold; }
			.fm-remove { background: transparent; border: 0; color: #da3633; cursor: pointer; font-size: 16px; padding: 0 4px; }
			.fm-footer { padding: 8px 12px; border-top: 1px solid #30363d; display: flex; gap: 6px; align-items: center; }
		`,

		Templates:
			[
				{
					Hash: 'Mapper-FieldMapper-Template',
					Template: /*html*/`
<div class="field-mapper">
	<div class="fm-panel">
		<div class="fm-panel-header">Source Fields <span>{~D:AppData.Mapper.SourceFieldCount~}</span></div>
		<div class="fm-panel-body" id="DataMapper-SourceFields-List">
			{~TS:Mapper-FieldMapper-SourceField:AppData.Mapper.SourceFieldsForTemplate~}
			{~D:AppData.Mapper.SourceEmptyHTML~}
		</div>
	</div>
	<div class="fm-panel">
		<div class="fm-panel-header">Field Mappings <span>{~D:AppData.Mapper.MappingCount~}</span></div>
		<div class="fm-mapping-drop {~D:AppData.Mapper.DropZoneClass~}">{~D:AppData.Mapper.DropZoneText~}</div>
		<div class="fm-panel-body" id="DataMapper-Mapping-List">
			{~TS:Mapper-FieldMapper-MappingRow:AppData.Mapper.MappingsForTemplate~}
		</div>
		<div class="fm-footer">
			<button class="btn primary" id="DataMapper-Save-Mapping">Save Mapping</button>
			<button class="btn" id="DataMapper-Clear-Mappings">Clear All</button>
		</div>
	</div>
	<div class="fm-panel">
		<div class="fm-panel-header">Target Fields <span>{~D:AppData.Mapper.TargetFieldCount~}</span></div>
		<div class="fm-panel-body" id="DataMapper-TargetFields-List">
			{~TS:Mapper-FieldMapper-TargetField:AppData.Mapper.TargetFieldsForTemplate~}
			{~D:AppData.Mapper.TargetEmptyHTML~}
		</div>
	</div>
</div>`
				},
				{
					Hash: 'Mapper-FieldMapper-SourceField',
					Template: /*html*/`<div class="fm-field {~D:Record.SelectedClass~}" data-source-field="{~D:Record.Name~}" draggable="true"><span>{~D:Record.Name~}</span><span class="fm-type">{~D:Record.Type~}</span></div>`
				},
				{
					Hash: 'Mapper-FieldMapper-TargetField',
					Template: /*html*/`<div class="fm-field {~D:Record.MappedClass~}" data-target-field="{~D:Record.Name~}"><span>{~D:Record.Name~}</span><span class="fm-type">{~D:Record.Type~}</span></div>`
				},
				{
					Hash: 'Mapper-FieldMapper-MappingRow',
					Template: /*html*/`<div class="fm-mapping-row"><span>{~D:Record.Source~}</span><span class="fm-arrow">&rarr;</span><span>{~D:Record.Target~}</span><button class="fm-remove" data-remove-mapping="{~D:Record.Index~}">&times;</button></div>`
				}
			],

		Renderables:
			[
				{
					RenderableHash: 'Mapper-FieldMapper-Content',
					TemplateHash: 'Mapper-FieldMapper-Template',
					ContentDestinationAddress: '#DataMapper-FieldMapper-Slot',
					RenderMethod: 'replace'
				}
			]
	};

class PictViewMapperFieldMapper extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
	}

	onBeforeRender(pRenderable)
	{
		let tmpState = this.pict.AppData.Mapper;
		let tmpSelected = tmpState.SelectedSourceField || '';

		let tmpSources = tmpState.SourceFields || [];
		tmpState.SourceFieldCount = `${tmpSources.length} field${tmpSources.length === 1 ? '' : 's'}`;
		tmpState.SourceFieldsForTemplate = tmpSources.map((pF) =>
			(
				{
					Name: pF.Name,
					Type: pF.Type || '',
					SelectedClass: (pF.Name === tmpSelected) ? 'selected' : ''
				}));
		tmpState.SourceEmptyHTML = (tmpSources.length === 0)
			? '<div class="fm-empty">Pick a source beacon, connection, and entity above.</div>'
			: '';

		let tmpMappings = tmpState.Mappings || [];
		let tmpMappedTargets = {};
		for (let i = 0; i < tmpMappings.length; i++) { tmpMappedTargets[tmpMappings[i].Target] = true; }

		let tmpTargets = tmpState.TargetFields || [];
		tmpState.TargetFieldCount = `${tmpTargets.length} field${tmpTargets.length === 1 ? '' : 's'}`;
		tmpState.TargetFieldsForTemplate = tmpTargets.map((pF) =>
			(
				{
					Name: pF.Name,
					Type: pF.Type || '',
					MappedClass: tmpMappedTargets[pF.Name] ? 'mapped' : ''
				}));
		tmpState.TargetEmptyHTML = (tmpTargets.length === 0)
			? '<div class="fm-empty">Pick a target beacon, connection, and entity above.</div>'
			: '';

		tmpState.MappingCount = `${tmpMappings.length} mapping${tmpMappings.length === 1 ? '' : 's'}`;
		tmpState.MappingsForTemplate = tmpMappings.map((pM, pIdx) =>
			(
				{ Source: pM.Source, Target: pM.Target, Index: pIdx }));

		if (tmpSelected)
		{
			tmpState.DropZoneClass = 'active';
			tmpState.DropZoneText = `Source "${tmpSelected}" selected — click a target field to map it`;
		}
		else
		{
			tmpState.DropZoneClass = '';
			tmpState.DropZoneText = 'Click a source field, then click a target field';
		}

		return super.onBeforeRender(pRenderable);
	}

	onAfterRender(pRenderable, pRenderDestinationAddress, pRecord, pContent)
	{
		let tmpProvider = this.pict.providers.MapperAPI;
		let tmpSelf = this;

		let tmpSourceFields = this.pict.ContentAssignment.getElement('[data-source-field]');
		if (tmpSourceFields && tmpSourceFields.length)
		{
			for (let i = 0; i < tmpSourceFields.length; i++)
			{
				let tmpEl = tmpSourceFields[i];
				tmpEl.addEventListener('click', (pEvent) =>
				{
					tmpProvider.selectSourceField(pEvent.currentTarget.getAttribute('data-source-field'));
				});
				tmpEl.addEventListener('dragstart', (pEvent) =>
				{
					let tmpName = pEvent.currentTarget.getAttribute('data-source-field');
					pEvent.dataTransfer.setData('text/plain', tmpName);
					tmpProvider.pict.AppData.Mapper.SelectedSourceField = tmpName;
				});
			}
		}

		let tmpTargetFields = this.pict.ContentAssignment.getElement('[data-target-field]');
		if (tmpTargetFields && tmpTargetFields.length)
		{
			for (let i = 0; i < tmpTargetFields.length; i++)
			{
				let tmpEl = tmpTargetFields[i];
				tmpEl.addEventListener('click', (pEvent) =>
				{
					let tmpTarget = pEvent.currentTarget.getAttribute('data-target-field');
					let tmpSource = tmpSelf.pict.AppData.Mapper.SelectedSourceField;
					if (tmpSource && tmpTarget) { tmpProvider.addMapping(tmpSource, tmpTarget); }
				});
				tmpEl.addEventListener('dragover', (pEvent) => pEvent.preventDefault());
				tmpEl.addEventListener('drop', (pEvent) =>
				{
					pEvent.preventDefault();
					let tmpSource = pEvent.dataTransfer.getData('text/plain');
					let tmpTarget = pEvent.currentTarget.getAttribute('data-target-field');
					if (tmpSource && tmpTarget) { tmpProvider.addMapping(tmpSource, tmpTarget); }
				});
			}
		}

		let tmpRemoveBtns = this.pict.ContentAssignment.getElement('[data-remove-mapping]');
		if (tmpRemoveBtns && tmpRemoveBtns.length)
		{
			for (let i = 0; i < tmpRemoveBtns.length; i++)
			{
				tmpRemoveBtns[i].addEventListener('click', (pEvent) =>
				{
					let tmpIndex = parseInt(pEvent.currentTarget.getAttribute('data-remove-mapping'), 10);
					tmpProvider.removeMapping(tmpIndex);
				});
			}
		}

		let tmpSaveBtn = this.pict.ContentAssignment.getElement('#DataMapper-Save-Mapping');
		if (tmpSaveBtn && tmpSaveBtn.length)
		{
			tmpSaveBtn[0].addEventListener('click', () => tmpProvider.saveMapping());
		}
		let tmpClearBtn = this.pict.ContentAssignment.getElement('#DataMapper-Clear-Mappings');
		if (tmpClearBtn && tmpClearBtn.length)
		{
			tmpClearBtn[0].addEventListener('click', () => tmpProvider.clearMappings());
		}

		return super.onAfterRender(pRenderable, pRenderDestinationAddress, pRecord, pContent);
	}
}

module.exports = PictViewMapperFieldMapper;
module.exports.default_configuration = _ViewConfiguration;
