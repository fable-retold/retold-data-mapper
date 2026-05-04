/**
 * Retold DataMapper — Mapping Shell Pict Application
 *
 * One-view application that mounts pict-section-mapping in `manage`
 * mode. Used by mappings.html. The visual field-mapping editor lives
 * separately at index.html (DataMapperApplication); this shell is the
 * lightweight CRUD-and-Run surface.
 */
const libPictApplication = require('pict-application');
const libSectionMapping = require('./vendor/pict-section-mapping/source/Pict-Section-Mapping.js');
const libSectionModal = require('pict-section-modal');

class MappingShellApplication extends libPictApplication
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.serviceType = 'MappingShellApplication';

		this.pict.addView('Modal', {}, libSectionModal);

		this.pict.addView(
			'Mappings',
			Object.assign({}, libSectionMapping.default_configuration,
				{
					ContentDestinationAddress: '#mapping-section',
					APIBaseUrl:                '/mapper',
					Mode:                      'manage',
					ShowToolbar:               true,
					AutoRender:                true
				}),
			libSectionMapping);
	}

	onAfterInitializeAsync(fCallback)
	{
		if (this.pict.views && this.pict.views.Mappings)
		{
			this.pict.views.Mappings.render();
		}
		return super.onAfterInitializeAsync(fCallback);
	}
}

module.exports = MappingShellApplication;
