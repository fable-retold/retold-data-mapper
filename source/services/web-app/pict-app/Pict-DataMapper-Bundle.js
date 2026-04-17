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

window.DataMapperApplication = libDataMapperApplication;
