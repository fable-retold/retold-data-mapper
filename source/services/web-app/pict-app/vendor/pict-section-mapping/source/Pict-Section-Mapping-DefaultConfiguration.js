/**
 * Pict-Section-Mapping default configuration.
 */
'use strict';

module.exports =
{
	ViewIdentifier:            'Pict-Section-Mapping',
	DefaultRenderable:         'Pict-Section-Mapping-Shell',
	DefaultDestinationAddress: '#Pict-Section-Mapping',
	AutoRender:                true,

	APIBaseUrl:           '/mapper',
	Mode:                 'manage',     // 'manage' | 'list-only'
	ShowToolbar:          true,
	Scope:                null
};
