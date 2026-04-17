/**
 * DataMapper JSONEditor View
 *
 * Dual-mode config editor: shows the generated MappingConfiguration JSON
 * and supports import via paste, file picker, or drag-drop onto the textarea.
 */
const libPictView = require('pict-view');

const _ViewConfiguration =
	{
		ViewIdentifier: 'Mapper-JSONEditor',
		DefaultRenderable: 'Mapper-JSONEditor-Content',
		DefaultDestinationAddress: '#DataMapper-JSONEditor-Slot',
		AutoRender: false,

		CSS: /*css*/`
			.json-editor { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 12px 16px; }
			.json-editor-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
			.json-editor-header h2 { margin: 0; font-size: 14px; font-weight: 600; color: #e6edf3; }
			.json-editor-actions { display: flex; gap: 6px; }
			.json-editor textarea { width: 100%; min-height: 360px; background: #0d1117; color: #e6edf3; border: 1px solid #30363d; border-radius: 4px; font-family: 'Menlo', 'Monaco', 'Consolas', monospace; font-size: 12px; padding: 10px; resize: vertical; }
			.json-editor textarea.drop-active { border-color: #ff9800; }
		`,

		Templates:
			[
				{
					Hash: 'Mapper-JSONEditor-Template',
					Template: /*html*/`
<div class="json-editor">
	<div class="json-editor-header">
		<h2>MappingConfiguration JSON</h2>
		<div class="json-editor-actions">
			<button class="btn" id="DataMapper-JSON-Regenerate">Regenerate</button>
			<button class="btn" id="DataMapper-JSON-Apply">Apply to Editor</button>
			<button class="btn" id="DataMapper-JSON-Copy">Copy</button>
			<button class="btn" id="DataMapper-JSON-Upload">Upload…</button>
			<input type="file" id="DataMapper-JSON-File" accept=".json" style="display:none">
		</div>
	</div>
	<textarea id="DataMapper-JSON-Text" placeholder='{ "Entity":"MyEntity", "Mappings":{...} }'>{~D:AppData.Mapper.JSONText~}</textarea>
</div>`
				}
			],

		Renderables:
			[
				{
					RenderableHash: 'Mapper-JSONEditor-Content',
					TemplateHash: 'Mapper-JSONEditor-Template',
					ContentDestinationAddress: '#DataMapper-JSONEditor-Slot',
					RenderMethod: 'replace'
				}
			]
	};

class PictViewMapperJSONEditor extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
	}

	onAfterRender(pRenderable, pRenderDestinationAddress, pRecord, pContent)
	{
		let tmpProvider = this.pict.providers.MapperAPI;
		let tmpSelf = this;

		let tmpTextareaEl = this.pict.ContentAssignment.getElement('#DataMapper-JSON-Text');
		let tmpTextarea = (tmpTextareaEl && tmpTextareaEl.length) ? tmpTextareaEl[0] : null;

		let tmpRegenBtn = this.pict.ContentAssignment.getElement('#DataMapper-JSON-Regenerate');
		if (tmpRegenBtn && tmpRegenBtn.length)
		{
			tmpRegenBtn[0].addEventListener('click', () =>
			{
				tmpProvider._regenerateJSON();
				if (tmpTextarea) tmpTextarea.value = tmpSelf.pict.AppData.Mapper.JSONText;
			});
		}

		let tmpApplyBtn = this.pict.ContentAssignment.getElement('#DataMapper-JSON-Apply');
		if (tmpApplyBtn && tmpApplyBtn.length)
		{
			tmpApplyBtn[0].addEventListener('click', () =>
			{
				if (tmpTextarea) tmpProvider.applyJSONText(tmpTextarea.value);
			});
		}

		let tmpCopyBtn = this.pict.ContentAssignment.getElement('#DataMapper-JSON-Copy');
		if (tmpCopyBtn && tmpCopyBtn.length)
		{
			tmpCopyBtn[0].addEventListener('click', () =>
			{
				if (!tmpTextarea) return;
				try
				{
					navigator.clipboard.writeText(tmpTextarea.value);
					tmpSelf.pict.AppData.Mapper.StatusMessage = 'JSON copied.';
				}
				catch (e)
				{
					tmpTextarea.select();
					document.execCommand('copy');
					tmpSelf.pict.AppData.Mapper.StatusMessage = 'JSON copied.';
				}
				if (tmpSelf.pict.views['Mapper-Layout']) tmpSelf.pict.views['Mapper-Layout'].render();
			});
		}

		let tmpUploadBtn = this.pict.ContentAssignment.getElement('#DataMapper-JSON-Upload');
		let tmpFileInputEl = this.pict.ContentAssignment.getElement('#DataMapper-JSON-File');
		let tmpFileInput = (tmpFileInputEl && tmpFileInputEl.length) ? tmpFileInputEl[0] : null;
		if (tmpUploadBtn && tmpUploadBtn.length && tmpFileInput)
		{
			tmpUploadBtn[0].addEventListener('click', () => tmpFileInput.click());
			tmpFileInput.addEventListener('change', (pEvent) =>
			{
				let tmpFile = pEvent.target.files[0];
				if (!tmpFile) return;
				let tmpReader = new FileReader();
				tmpReader.onload = (pLoadEvent) =>
				{
					if (tmpTextarea) tmpTextarea.value = pLoadEvent.target.result;
					tmpProvider.applyJSONText(pLoadEvent.target.result);
				};
				tmpReader.readAsText(tmpFile);
				pEvent.target.value = '';
			});
		}

		if (tmpTextarea)
		{
			tmpTextarea.addEventListener('dragover', (pEvent) =>
			{
				pEvent.preventDefault();
				tmpTextarea.classList.add('drop-active');
			});
			tmpTextarea.addEventListener('dragleave', () => tmpTextarea.classList.remove('drop-active'));
			tmpTextarea.addEventListener('drop', (pEvent) =>
			{
				pEvent.preventDefault();
				tmpTextarea.classList.remove('drop-active');
				let tmpFiles = pEvent.dataTransfer.files;
				if (tmpFiles && tmpFiles.length > 0)
				{
					let tmpReader = new FileReader();
					tmpReader.onload = (pLoadEvent) =>
					{
						tmpTextarea.value = pLoadEvent.target.result;
						tmpProvider.applyJSONText(pLoadEvent.target.result);
					};
					tmpReader.readAsText(tmpFiles[0]);
				}
			});
		}

		return super.onAfterRender(pRenderable, pRenderDestinationAddress, pRecord, pContent);
	}
}

module.exports = PictViewMapperJSONEditor;
module.exports.default_configuration = _ViewConfiguration;
