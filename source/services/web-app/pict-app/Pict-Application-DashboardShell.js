/**
 * Retold DataMapper — Dashboard Shell Pict Application
 *
 * One-view application that mounts pict-section-dashboard in `manage`
 * mode. Used by dashboards.html. The same section is also available
 * for embedding into other Pict applications (set Mode='render-only'
 * to hide the CRUD chrome and just render dashboards in place).
 */
const libPictApplication = require('pict-application');
const libSectionDashboard = require('./vendor/pict-section-dashboard/source/Pict-Section-Dashboard.js');
const libSectionModal = require('pict-section-modal');

class DashboardShellApplication extends libPictApplication
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.serviceType = 'DashboardShellApplication';

		// Modal/toast section — pict-section-dashboard uses it for delete
		// confirmations and success toasts. Registering under the name
		// 'Modal' matches the lookup pattern in the section
		// (this.pict.views.Modal).
		this.pict.addView('Modal', {}, libSectionModal);

		this.pict.addView(
			'Dashboards',
			Object.assign({}, libSectionDashboard.default_configuration,
				{
					ContentDestinationAddress: '#dashboard-section',
					APIBaseUrl:                '/mapper',
					Mode:                      'manage',
					ShowToolbar:               true,
					AutoRender:                true
				}),
			libSectionDashboard);
	}

	onAfterInitializeAsync(fCallback)
	{
		// First render paints the section into #dashboard-section. The
		// section's own onAfterRender takes over from there.
		if (this.pict.views && this.pict.views.Dashboards)
		{
			this.pict.views.Dashboards.render();
		}
		return super.onAfterInitializeAsync(fCallback);
	}
}

module.exports = DashboardShellApplication;
