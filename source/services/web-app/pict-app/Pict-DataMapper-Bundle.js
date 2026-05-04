/**
 * Retold DataMapper — Browser Bundle Entry
 *
 * Quackage (browserify) processes this file to produce retold-data-mapper.js.
 */
let libPictApplication = require('pict-application');
let libPictView = require('pict-view');

let libDataMapperApplication = require('./Pict-Application-DataMapper.js');

let libMapperAPIProvider = require('./providers/Pict-Provider-MapperAPI.js');

let libViewLayout = require('./views/PictView-Mapper-Layout.js');
let libViewBeaconBrowser = require('./views/PictView-Mapper-BeaconBrowser.js');
let libViewFieldMapper = require('./views/PictView-Mapper-FieldMapper.js');
let libViewMappingList = require('./views/PictView-Mapper-MappingList.js');
let libViewJSONEditor = require('./views/PictView-Mapper-JSONEditor.js');

// Embeddable Pict-section views — bundled here so standalone shell
// pages (dashboards.html, mappings.html) can mount them, and so any
// "ENHANCE another product" host that consumes this bundle gets the
// sections via the global names below.
let libSectionDashboard = require('./vendor/pict-section-dashboard/source/Pict-Section-Dashboard.js');
let libSectionMapping   = require('./vendor/pict-section-mapping/source/Pict-Section-Mapping.js');
let libDashboardShellApp = require('./Pict-Application-DashboardShell.js');
let libMappingShellApp   = require('./Pict-Application-MappingShell.js');

window.DataMapperApplication = libDataMapperApplication;
window.PictSectionDashboard = libSectionDashboard;
window.PictSectionMapping   = libSectionMapping;
window.DashboardShellApplication = libDashboardShellApp;
window.MappingShellApplication   = libMappingShellApp;
