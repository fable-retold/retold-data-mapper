"use strict";

(function (f) {
  if (typeof exports === "object" && typeof module !== "undefined") {
    module.exports = f();
  } else if (typeof define === "function" && define.amd) {
    define([], f);
  } else {
    var g;
    if (typeof window !== "undefined") {
      g = window;
    } else if (typeof global !== "undefined") {
      g = global;
    } else if (typeof self !== "undefined") {
      g = self;
    } else {
      g = this;
    }
    g.retoldDataMapper = f();
  }
})(function () {
  var define, module, exports;
  return function () {
    function r(e, n, t) {
      function o(i, f) {
        if (!n[i]) {
          if (!e[i]) {
            var c = "function" == typeof require && require;
            if (!f && c) return c(i, !0);
            if (u) return u(i, !0);
            var a = new Error("Cannot find module '" + i + "'");
            throw a.code = "MODULE_NOT_FOUND", a;
          }
          var p = n[i] = {
            exports: {}
          };
          e[i][0].call(p.exports, function (r) {
            var n = e[i][1][r];
            return o(n || r);
          }, p, p.exports, r, e, n, t);
        }
        return n[i].exports;
      }
      for (var u = "function" == typeof require && require, i = 0; i < t.length; i++) o(t[i]);
      return o;
    }
    return r;
  }()({
    1: [function (require, module, exports) {
      module.exports = {
        "name": "fable-serviceproviderbase",
        "version": "3.0.19",
        "description": "Simple base classes for fable services.",
        "main": "source/Fable-ServiceProviderBase.js",
        "scripts": {
          "start": "node source/Fable-ServiceProviderBase.js",
          "test": "npx quack test",
          "tests": "npx quack test -g",
          "coverage": "npx quack coverage",
          "build": "npx quack build",
          "types": "tsc -p ./tsconfig.build.json",
          "check": "tsc -p . --noEmit"
        },
        "types": "types/source/Fable-ServiceProviderBase.d.ts",
        "mocha": {
          "diff": true,
          "extension": ["js"],
          "package": "./package.json",
          "reporter": "spec",
          "slow": "75",
          "timeout": "5000",
          "ui": "tdd",
          "watch-files": ["source/**/*.js", "test/**/*.js"],
          "watch-ignore": ["lib/vendor"]
        },
        "repository": {
          "type": "git",
          "url": "https://github.com/stevenvelozo/fable-serviceproviderbase.git"
        },
        "keywords": ["entity", "behavior"],
        "author": "Steven Velozo <steven@velozo.com> (http://velozo.com/)",
        "license": "MIT",
        "bugs": {
          "url": "https://github.com/stevenvelozo/fable-serviceproviderbase/issues"
        },
        "homepage": "https://github.com/stevenvelozo/fable-serviceproviderbase",
        "devDependencies": {
          "@types/mocha": "^10.0.10",
          "fable": "^3.1.62",
          "quackage": "^1.0.58",
          "typescript": "^5.9.3"
        }
      };
    }, {}],
    2: [function (require, module, exports) {
      /**
      * Fable Service Base
      * @author <steven@velozo.com>
      */

      const libPackage = require('../package.json');
      class FableServiceProviderBase {
        /**
         * The constructor can be used in two ways:
         * 1) With a fable, options object and service hash (the options object and service hash are optional)a
         * 2) With an object or nothing as the first parameter, where it will be treated as the options object
         *
         * @param {import('fable')|Record<string, any>} [pFable] - (optional) The fable instance, or the options object if there is no fable
         * @param {Record<string, any>|string} [pOptions] - (optional) The options object, or the service hash if there is no fable
         * @param {string} [pServiceHash] - (optional) The service hash to identify this service instance
         */
        constructor(pFable, pOptions, pServiceHash) {
          /** @type {import('fable')} */
          this.fable;
          /** @type {string} */
          this.UUID;
          /** @type {Record<string, any>} */
          this.options;
          /** @type {Record<string, any>} */
          this.services;
          /** @type {Record<string, any>} */
          this.servicesMap;

          // Check if a fable was passed in; connect it if so
          if (typeof pFable === 'object' && pFable.isFable) {
            this.connectFable(pFable);
          } else {
            this.fable = false;
          }

          // Initialize the services map if it wasn't passed in
          /** @type {Record<string, any>} */
          this._PackageFableServiceProvider = libPackage;

          // initialize options and UUID based on whether the fable was passed in or not.
          if (this.fable) {
            this.UUID = pFable.getUUID();
            this.options = typeof pOptions === 'object' ? pOptions : {};
          } else {
            // With no fable, check to see if there was an object passed into either of the first two
            // Parameters, and if so, treat it as the options object
            this.options = typeof pFable === 'object' && !pFable.isFable ? pFable : typeof pOptions === 'object' ? pOptions : {};
            this.UUID = `CORE-SVC-${Math.floor(Math.random() * (99999 - 10000) + 10000)}`;
          }

          // It's expected that the deriving class will set this
          this.serviceType = `Unknown-${this.UUID}`;

          // The service hash is used to identify the specific instantiation of the service in the services map
          this.Hash = typeof pServiceHash === 'string' ? pServiceHash : !this.fable && typeof pOptions === 'string' ? pOptions : `${this.UUID}`;
        }

        /**
         * @param {import('fable')} pFable
         */
        connectFable(pFable) {
          if (typeof pFable !== 'object' || !pFable.isFable) {
            let tmpErrorMessage = `Fable Service Provider Base: Cannot connect to Fable, invalid Fable object passed in.  The pFable parameter was a [${typeof pFable}].}`;
            console.log(tmpErrorMessage);
            return new Error(tmpErrorMessage);
          }
          if (!this.fable) {
            this.fable = pFable;
          }
          if (!this.log) {
            this.log = this.fable.Logging;
          }
          if (!this.services) {
            this.services = this.fable.services;
          }
          if (!this.servicesMap) {
            this.servicesMap = this.fable.servicesMap;
          }
          return true;
        }
        static isFableService = true;
      }
      module.exports = FableServiceProviderBase;

      // This is left here in case we want to go back to having different code/base class for "core" services
      module.exports.CoreServiceProviderBase = FableServiceProviderBase;
    }, {
      "../package.json": 1
    }],
    3: [function (require, module, exports) {
      module.exports = {
        "name": "pict-application",
        "version": "1.0.33",
        "description": "Application base class for a pict view-based application",
        "main": "source/Pict-Application.js",
        "scripts": {
          "test": "npx quack test",
          "start": "node source/Pict-Application.js",
          "coverage": "npx quack coverage",
          "build": "npx quack build",
          "docker-dev-build": "docker build ./ -f Dockerfile_LUXURYCode -t pict-application-image:local",
          "docker-dev-run": "docker run -it -d --name pict-application-dev -p 30001:8080 -p 38086:8086 -v \"$PWD/.config:/home/coder/.config\"  -v \"$PWD:/home/coder/pict-application\" -u \"$(id -u):$(id -g)\" -e \"DOCKER_USER=$USER\" pict-application-image:local",
          "docker-dev-shell": "docker exec -it pict-application-dev /bin/bash",
          "tests": "npx quack test -g",
          "lint": "eslint source/**",
          "types": "tsc -p ."
        },
        "types": "types/source/Pict-Application.d.ts",
        "repository": {
          "type": "git",
          "url": "git+https://github.com/stevenvelozo/pict-application.git"
        },
        "author": "steven velozo <steven@velozo.com>",
        "license": "MIT",
        "bugs": {
          "url": "https://github.com/stevenvelozo/pict-application/issues"
        },
        "homepage": "https://github.com/stevenvelozo/pict-application#readme",
        "devDependencies": {
          "@eslint/js": "^9.28.0",
          "browser-env": "^3.3.0",
          "eslint": "^9.28.0",
          "pict": "^1.0.348",
          "pict-provider": "^1.0.10",
          "pict-view": "^1.0.66",
          "quackage": "^1.0.58",
          "typescript": "^5.9.3"
        },
        "mocha": {
          "diff": true,
          "extension": ["js"],
          "package": "./package.json",
          "reporter": "spec",
          "slow": "75",
          "timeout": "5000",
          "ui": "tdd",
          "watch-files": ["source/**/*.js", "test/**/*.js"],
          "watch-ignore": ["lib/vendor"]
        },
        "dependencies": {
          "fable-serviceproviderbase": "^3.0.19"
        }
      };
    }, {}],
    4: [function (require, module, exports) {
      const libFableServiceBase = require('fable-serviceproviderbase');
      const libPackage = require('../package.json');
      const defaultPictSettings = {
        Name: 'DefaultPictApplication',
        // The main "viewport" is the view that is used to host our application
        MainViewportViewIdentifier: 'Default-View',
        MainViewportRenderableHash: false,
        MainViewportDestinationAddress: false,
        MainViewportDefaultDataAddress: false,
        // Whether or not we should automatically render the main viewport and other autorender views after we initialize the pict application
        AutoSolveAfterInitialize: true,
        AutoRenderMainViewportViewAfterInitialize: true,
        AutoRenderViewsAfterInitialize: false,
        AutoLoginAfterInitialize: false,
        AutoLoadDataAfterLogin: false,
        ConfigurationOnlyViews: [],
        Manifests: {},
        // The prefix to prepend on all template destination hashes
        IdentifierAddressPrefix: 'PICT-'
      };

      /**
       * Base class for pict applications.
       */
      class PictApplication extends libFableServiceBase {
        /**
         * @param {import('fable')} pFable
         * @param {Record<string, any>} [pOptions]
         * @param {string} [pServiceHash]
         */
        constructor(pFable, pOptions, pServiceHash) {
          let tmpCarryOverConfiguration = typeof pFable.settings.PictApplicationConfiguration === 'object' ? pFable.settings.PictApplicationConfiguration : {};
          let tmpOptions = Object.assign({}, JSON.parse(JSON.stringify(defaultPictSettings)), tmpCarryOverConfiguration, pOptions);
          super(pFable, tmpOptions, pServiceHash);

          /** @type {any} */
          this.options;
          /** @type {any} */
          this.log;
          /** @type {import('pict') & import('fable')} */
          this.fable;
          /** @type {string} */
          this.UUID;
          /** @type {string} */
          this.Hash;
          /**
           * @type {{ [key: string]: any }}
           */
          this.servicesMap;
          this.serviceType = 'PictApplication';
          /** @type {Record<string, any>} */
          this._Package = libPackage;

          // Convenience and consistency naming
          this.pict = this.fable;
          // Wire in the essential Pict state
          /** @type {Record<string, any>} */
          this.AppData = this.fable.AppData;
          /** @type {Record<string, any>} */
          this.Bundle = this.fable.Bundle;

          /** @type {number} */
          this.initializeTimestamp;
          /** @type {number} */
          this.lastSolvedTimestamp;
          /** @type {number} */
          this.lastLoginTimestamp;
          /** @type {number} */
          this.lastMarshalFromViewsTimestamp;
          /** @type {number} */
          this.lastMarshalToViewsTimestamp;
          /** @type {number} */
          this.lastAutoRenderTimestamp;
          /** @type {number} */
          this.lastLoadDataTimestamp;

          // Load all the manifests for the application
          let tmpManifestKeys = Object.keys(this.options.Manifests);
          if (tmpManifestKeys.length > 0) {
            for (let i = 0; i < tmpManifestKeys.length; i++) {
              // Load each manifest
              let tmpManifestKey = tmpManifestKeys[i];
              this.fable.instantiateServiceProvider('Manifest', this.options.Manifests[tmpManifestKey], tmpManifestKey);
            }
          }
        }

        /* -------------------------------------------------------------------------- */
        /*                     Code Section: Solve All Views                          */
        /* -------------------------------------------------------------------------- */
        /**
         * @return {boolean}
         */
        onPreSolve() {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onPreSolve:`);
          }
          return true;
        }
        /**
         * @param {(error?: Error) => void} fCallback
         */
        onPreSolveAsync(fCallback) {
          this.onPreSolve();
          return fCallback();
        }

        /**
         * @return {boolean}
         */
        onBeforeSolve() {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onBeforeSolve:`);
          }
          return true;
        }
        /**
         * @param {(error?: Error) => void} fCallback
         */
        onBeforeSolveAsync(fCallback) {
          this.onBeforeSolve();
          return fCallback();
        }

        /**
         * @return {boolean}
         */
        onSolve() {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onSolve:`);
          }
          return true;
        }
        /**
         * @param {(error?: Error) => void} fCallback
         */
        onSolveAsync(fCallback) {
          this.onSolve();
          return fCallback();
        }

        /**
         * @return {boolean}
         */
        solve() {
          if (this.pict.LogNoisiness > 2) {
            this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} executing solve() function...`);
          }

          // Walk through any loaded providers and solve them as well.
          let tmpLoadedProviders = Object.keys(this.pict.providers);
          let tmpProvidersToSolve = [];
          for (let i = 0; i < tmpLoadedProviders.length; i++) {
            let tmpProvider = this.pict.providers[tmpLoadedProviders[i]];
            if (tmpProvider.options.AutoSolveWithApp) {
              tmpProvidersToSolve.push(tmpProvider);
            }
          }
          // Sort the providers by their priority (if they are all priority 0, it will end up being add order due to JSON Object Property Key order stuff)
          tmpProvidersToSolve.sort((a, b) => {
            return a.options.AutoSolveOrdinal - b.options.AutoSolveOrdinal;
          });
          for (let i = 0; i < tmpProvidersToSolve.length; i++) {
            tmpProvidersToSolve[i].solve(tmpProvidersToSolve[i]);
          }
          this.onBeforeSolve();
          // Now walk through any loaded views and initialize them as well.
          let tmpLoadedViews = Object.keys(this.pict.views);
          let tmpViewsToSolve = [];
          for (let i = 0; i < tmpLoadedViews.length; i++) {
            let tmpView = this.pict.views[tmpLoadedViews[i]];
            if (tmpView.options.AutoInitialize) {
              tmpViewsToSolve.push(tmpView);
            }
          }
          // Sort the views by their priority (if they are all priority 0, it will end up being add order due to JSON Object Property Key order stuff)
          tmpViewsToSolve.sort((a, b) => {
            return a.options.AutoInitializeOrdinal - b.options.AutoInitializeOrdinal;
          });
          for (let i = 0; i < tmpViewsToSolve.length; i++) {
            tmpViewsToSolve[i].solve();
          }
          this.onSolve();
          this.onAfterSolve();
          this.lastSolvedTimestamp = this.fable.log.getTimeStamp();
          return true;
        }
        /**
         * @param {(error?: Error) => void} fCallback
         */
        solveAsync(fCallback) {
          let tmpAnticipate = this.fable.instantiateServiceProviderWithoutRegistration('Anticipate');
          tmpAnticipate.anticipate(this.onBeforeSolveAsync.bind(this));

          // Allow the callback to be passed in as the last parameter no matter what
          let tmpCallback = typeof fCallback === 'function' ? fCallback : false;
          if (!tmpCallback) {
            this.log.warn(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} solveAsync was called without a valid callback.  A callback will be generated but this could lead to race conditions.`);
            tmpCallback = pError => {
              if (pError) {
                this.log.error(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} solveAsync Auto Callback Error: ${pError}`, pError);
              }
            };
          }
          // Walk through any loaded providers and solve them as well.
          let tmpLoadedProviders = Object.keys(this.pict.providers);
          let tmpProvidersToSolve = [];
          for (let i = 0; i < tmpLoadedProviders.length; i++) {
            let tmpProvider = this.pict.providers[tmpLoadedProviders[i]];
            if (tmpProvider.options.AutoSolveWithApp) {
              tmpProvidersToSolve.push(tmpProvider);
            }
          }
          // Sort the providers by their priority (if they are all priority 0, it will end up being add order due to JSON Object Property Key order stuff)
          tmpProvidersToSolve.sort((a, b) => {
            return a.options.AutoSolveOrdinal - b.options.AutoSolveOrdinal;
          });
          for (let i = 0; i < tmpProvidersToSolve.length; i++) {
            tmpAnticipate.anticipate(tmpProvidersToSolve[i].solveAsync.bind(tmpProvidersToSolve[i]));
          }

          // Walk through any loaded views and solve them as well.
          let tmpLoadedViews = Object.keys(this.pict.views);
          let tmpViewsToSolve = [];
          for (let i = 0; i < tmpLoadedViews.length; i++) {
            let tmpView = this.pict.views[tmpLoadedViews[i]];
            if (tmpView.options.AutoSolveWithApp) {
              tmpViewsToSolve.push(tmpView);
            }
          }
          // Sort the views by their priority (if they are all priority 0, it will end up being add order due to JSON Object Property Key order stuff)
          tmpViewsToSolve.sort((a, b) => {
            return a.options.AutoSolveOrdinal - b.options.AutoSolveOrdinal;
          });
          for (let i = 0; i < tmpViewsToSolve.length; i++) {
            tmpAnticipate.anticipate(tmpViewsToSolve[i].solveAsync.bind(tmpViewsToSolve[i]));
          }
          tmpAnticipate.anticipate(this.onSolveAsync.bind(this));
          tmpAnticipate.anticipate(this.onAfterSolveAsync.bind(this));
          tmpAnticipate.wait(pError => {
            if (this.pict.LogNoisiness > 2) {
              this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} solveAsync() complete.`);
            }
            this.lastSolvedTimestamp = this.fable.log.getTimeStamp();
            return tmpCallback(pError);
          });
        }

        /**
         * @return {boolean}
         */
        onAfterSolve() {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onAfterSolve:`);
          }
          return true;
        }
        /**
         * @param {(error?: Error) => void} fCallback
         */
        onAfterSolveAsync(fCallback) {
          this.onAfterSolve();
          return fCallback();
        }

        /* -------------------------------------------------------------------------- */
        /*                     Code Section: Application Login                        */
        /* -------------------------------------------------------------------------- */

        /**
         * @param {(error?: Error) => void} fCallback
         */
        onBeforeLoginAsync(fCallback) {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onBeforeLoginAsync:`);
          }
          return fCallback();
        }

        /**
         * @param {(error?: Error) => void} fCallback
         */
        onLoginAsync(fCallback) {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onLoginAsync:`);
          }
          return fCallback();
        }

        /**
         * @param {(error?: Error) => void} fCallback
         */
        loginAsync(fCallback) {
          const tmpAnticipate = this.fable.instantiateServiceProviderWithoutRegistration('Anticipate');
          let tmpCallback = fCallback;
          if (typeof tmpCallback !== 'function') {
            this.log.warn(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} loginAsync was called without a valid callback.  A callback will be generated but this could lead to race conditions.`);
            tmpCallback = pError => {
              if (pError) {
                this.log.error(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} loginAsync Auto Callback Error: ${pError}`, pError);
              }
            };
          }
          tmpAnticipate.anticipate(this.onBeforeLoginAsync.bind(this));
          tmpAnticipate.anticipate(this.onLoginAsync.bind(this));
          tmpAnticipate.anticipate(this.onAfterLoginAsync.bind(this));

          // check and see if we should automatically trigger a data load
          if (this.options.AutoLoadDataAfterLogin) {
            tmpAnticipate.anticipate(fNext => {
              if (!this.isLoggedIn()) {
                return fNext();
              }
              if (this.pict.LogNoisiness > 1) {
                this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} auto loading data after login...`);
              }
              //TODO: should data load errors funnel here? this creates a weird coupling between login and data load callbacks
              this.loadDataAsync(pError => {
                fNext(pError);
              });
            });
          }
          tmpAnticipate.wait(pError => {
            if (this.pict.LogNoisiness > 2) {
              this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} loginAsync() complete.`);
            }
            this.lastLoginTimestamp = this.fable.log.getTimeStamp();
            return tmpCallback(pError);
          });
        }

        /**
         * Check if the application state is logged in. Defaults to true. Override this method in your application based on login requirements.
         *
         * @return {boolean}
         */
        isLoggedIn() {
          return true;
        }

        /**
         * @param {(error?: Error) => void} fCallback
         */
        onAfterLoginAsync(fCallback) {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onAfterLoginAsync:`);
          }
          return fCallback();
        }

        /* -------------------------------------------------------------------------- */
        /*                     Code Section: Application LoadData                     */
        /* -------------------------------------------------------------------------- */

        /**
         * @param {(error?: Error) => void} fCallback
         */
        onBeforeLoadDataAsync(fCallback) {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onBeforeLoadDataAsync:`);
          }
          return fCallback();
        }

        /**
         * @param {(error?: Error) => void} fCallback
         */
        onLoadDataAsync(fCallback) {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onLoadDataAsync:`);
          }
          return fCallback();
        }

        /**
         * @param {(error?: Error) => void} fCallback
         */
        loadDataAsync(fCallback) {
          const tmpAnticipate = this.fable.instantiateServiceProviderWithoutRegistration('Anticipate');
          let tmpCallback = fCallback;
          if (typeof tmpCallback !== 'function') {
            this.log.warn(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} loadDataAsync was called without a valid callback.  A callback will be generated but this could lead to race conditions.`);
            tmpCallback = pError => {
              if (pError) {
                this.log.error(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} loadDataAsync Auto Callback Error: ${pError}`, pError);
              }
            };
          }
          tmpAnticipate.anticipate(this.onBeforeLoadDataAsync.bind(this));

          // Walk through any loaded providers and load their data as well.
          let tmpLoadedProviders = Object.keys(this.pict.providers);
          let tmpProvidersToLoadData = [];
          for (let i = 0; i < tmpLoadedProviders.length; i++) {
            let tmpProvider = this.pict.providers[tmpLoadedProviders[i]];
            if (tmpProvider.options.AutoLoadDataWithApp) {
              tmpProvidersToLoadData.push(tmpProvider);
            }
          }
          // Sort the providers by their priority (if they are all priority 0, it will end up being add order due to JSON Object Property Key order stuff)
          tmpProvidersToLoadData.sort((a, b) => {
            return a.options.AutoLoadDataOrdinal - b.options.AutoLoadDataOrdinal;
          });
          for (const tmpProvider of tmpProvidersToLoadData) {
            tmpAnticipate.anticipate(tmpProvider.onBeforeLoadDataAsync.bind(tmpProvider));
          }
          tmpAnticipate.anticipate(this.onLoadDataAsync.bind(this));

          //TODO: think about ways to parallelize these
          for (const tmpProvider of tmpProvidersToLoadData) {
            tmpAnticipate.anticipate(tmpProvider.onLoadDataAsync.bind(tmpProvider));
          }
          tmpAnticipate.anticipate(this.onAfterLoadDataAsync.bind(this));
          for (const tmpProvider of tmpProvidersToLoadData) {
            tmpAnticipate.anticipate(tmpProvider.onAfterLoadDataAsync.bind(tmpProvider));
          }
          tmpAnticipate.wait(/** @param {Error} [pError] */
          pError => {
            if (this.pict.LogNoisiness > 2) {
              this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} loadDataAsync() complete.`);
            }
            this.lastLoadDataTimestamp = this.fable.log.getTimeStamp();
            return tmpCallback(pError);
          });
        }

        /**
         * @param {(error?: Error) => void} fCallback
         */
        onAfterLoadDataAsync(fCallback) {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onAfterLoadDataAsync:`);
          }
          return fCallback();
        }

        /* -------------------------------------------------------------------------- */
        /*                     Code Section: Application SaveData                     */
        /* -------------------------------------------------------------------------- */

        /**
         * @param {(error?: Error) => void} fCallback
         */
        onBeforeSaveDataAsync(fCallback) {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onBeforeSaveDataAsync:`);
          }
          return fCallback();
        }

        /**
         * @param {(error?: Error) => void} fCallback
         */
        onSaveDataAsync(fCallback) {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onSaveDataAsync:`);
          }
          return fCallback();
        }

        /**
         * @param {(error?: Error) => void} fCallback
         */
        saveDataAsync(fCallback) {
          const tmpAnticipate = this.fable.instantiateServiceProviderWithoutRegistration('Anticipate');
          let tmpCallback = fCallback;
          if (typeof tmpCallback !== 'function') {
            this.log.warn(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} saveDataAsync was called without a valid callback.  A callback will be generated but this could lead to race conditions.`);
            tmpCallback = pError => {
              if (pError) {
                this.log.error(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} saveDataAsync Auto Callback Error: ${pError}`, pError);
              }
            };
          }
          tmpAnticipate.anticipate(this.onBeforeSaveDataAsync.bind(this));

          // Walk through any loaded providers and load their data as well.
          let tmpLoadedProviders = Object.keys(this.pict.providers);
          let tmpProvidersToSaveData = [];
          for (let i = 0; i < tmpLoadedProviders.length; i++) {
            let tmpProvider = this.pict.providers[tmpLoadedProviders[i]];
            if (tmpProvider.options.AutoSaveDataWithApp) {
              tmpProvidersToSaveData.push(tmpProvider);
            }
          }
          // Sort the providers by their priority (if they are all priority 0, it will end up being add order due to JSON Object Property Key order stuff)
          tmpProvidersToSaveData.sort((a, b) => {
            return a.options.AutoSaveDataOrdinal - b.options.AutoSaveDataOrdinal;
          });
          for (const tmpProvider of tmpProvidersToSaveData) {
            tmpAnticipate.anticipate(tmpProvider.onBeforeSaveDataAsync.bind(tmpProvider));
          }
          tmpAnticipate.anticipate(this.onSaveDataAsync.bind(this));

          //TODO: think about ways to parallelize these
          for (const tmpProvider of tmpProvidersToSaveData) {
            tmpAnticipate.anticipate(tmpProvider.onSaveDataAsync.bind(tmpProvider));
          }
          tmpAnticipate.anticipate(this.onAfterSaveDataAsync.bind(this));
          for (const tmpProvider of tmpProvidersToSaveData) {
            tmpAnticipate.anticipate(tmpProvider.onAfterSaveDataAsync.bind(tmpProvider));
          }
          tmpAnticipate.wait(/** @param {Error} [pError] */
          pError => {
            if (this.pict.LogNoisiness > 2) {
              this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} saveDataAsync() complete.`);
            }
            this.lastSaveDataTimestamp = this.fable.log.getTimeStamp();
            return tmpCallback(pError);
          });
        }

        /**
         * @param {(error?: Error) => void} fCallback
         */
        onAfterSaveDataAsync(fCallback) {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onAfterSaveDataAsync:`);
          }
          return fCallback();
        }

        /* -------------------------------------------------------------------------- */
        /*                     Code Section: Initialize Application                   */
        /* -------------------------------------------------------------------------- */
        /**
         * @return {boolean}
         */
        onBeforeInitialize() {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onBeforeInitialize:`);
          }
          return true;
        }
        /**
         * @param {(error?: Error) => void} fCallback
         */
        onBeforeInitializeAsync(fCallback) {
          this.onBeforeInitialize();
          return fCallback();
        }

        /**
         * @return {boolean}
         */
        onInitialize() {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onInitialize:`);
          }
          return true;
        }
        /**
         * @param {(error?: Error) => void} fCallback
         */
        onInitializeAsync(fCallback) {
          this.onInitialize();
          return fCallback();
        }

        /**
         * @return {boolean}
         */
        initialize() {
          if (this.pict.LogControlFlow) {
            this.log.trace(`PICT-ControlFlow APPLICATION [${this.UUID}]::[${this.Hash}] ${this.options.Name} initialize:`);
          }
          if (!this.initializeTimestamp) {
            this.onBeforeInitialize();
            if ('ConfigurationOnlyViews' in this.options) {
              // Load all the configuration only views
              for (let i = 0; i < this.options.ConfigurationOnlyViews.length; i++) {
                let tmpViewIdentifier = typeof this.options.ConfigurationOnlyViews[i].ViewIdentifier === 'undefined' ? `AutoView-${this.fable.getUUID()}` : this.options.ConfigurationOnlyViews[i].ViewIdentifier;
                this.log.info(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} adding configuration only view: ${tmpViewIdentifier}`);
                this.pict.addView(tmpViewIdentifier, this.options.ConfigurationOnlyViews[i]);
              }
            }
            this.onInitialize();

            // Walk through any loaded providers and initialize them as well.
            let tmpLoadedProviders = Object.keys(this.pict.providers);
            let tmpProvidersToInitialize = [];
            for (let i = 0; i < tmpLoadedProviders.length; i++) {
              let tmpProvider = this.pict.providers[tmpLoadedProviders[i]];
              if (tmpProvider.options.AutoInitialize) {
                tmpProvidersToInitialize.push(tmpProvider);
              }
            }
            // Sort the providers by their priority (if they are all priority 0, it will end up being add order due to JSON Object Property Key order stuff)
            tmpProvidersToInitialize.sort((a, b) => {
              return a.options.AutoInitializeOrdinal - b.options.AutoInitializeOrdinal;
            });
            for (let i = 0; i < tmpProvidersToInitialize.length; i++) {
              tmpProvidersToInitialize[i].initialize();
            }

            // Now walk through any loaded views and initialize them as well.
            let tmpLoadedViews = Object.keys(this.pict.views);
            let tmpViewsToInitialize = [];
            for (let i = 0; i < tmpLoadedViews.length; i++) {
              let tmpView = this.pict.views[tmpLoadedViews[i]];
              if (tmpView.options.AutoInitialize) {
                tmpViewsToInitialize.push(tmpView);
              }
            }
            // Sort the views by their priority (if they are all priority 0, it will end up being add order due to JSON Object Property Key order stuff)
            tmpViewsToInitialize.sort((a, b) => {
              return a.options.AutoInitializeOrdinal - b.options.AutoInitializeOrdinal;
            });
            for (let i = 0; i < tmpViewsToInitialize.length; i++) {
              tmpViewsToInitialize[i].initialize();
            }
            this.onAfterInitialize();
            if (this.options.AutoSolveAfterInitialize) {
              if (this.pict.LogNoisiness > 1) {
                this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} auto solving after initialization...`);
              }
              // Solve the template synchronously
              this.solve();
            }
            // Now check and see if we should automatically render as well
            if (this.options.AutoRenderMainViewportViewAfterInitialize) {
              if (this.pict.LogNoisiness > 1) {
                this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} auto rendering after initialization...`);
              }
              // Render the template synchronously
              this.render();
            }
            this.initializeTimestamp = this.fable.log.getTimeStamp();
            this.onCompletionOfInitialize();
            return true;
          } else {
            this.log.warn(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} initialize called but initialization is already completed.  Aborting.`);
            return false;
          }
        }
        /**
         * @param {(error?: Error) => void} fCallback
         */
        initializeAsync(fCallback) {
          if (this.pict.LogControlFlow) {
            this.log.trace(`PICT-ControlFlow APPLICATION [${this.UUID}]::[${this.Hash}] ${this.options.Name} initializeAsync:`);
          }

          // Allow the callback to be passed in as the last parameter no matter what
          let tmpCallback = typeof fCallback === 'function' ? fCallback : false;
          if (!tmpCallback) {
            this.log.warn(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} initializeAsync was called without a valid callback.  A callback will be generated but this could lead to race conditions.`);
            tmpCallback = pError => {
              if (pError) {
                this.log.error(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} initializeAsync Auto Callback Error: ${pError}`, pError);
              }
            };
          }
          if (!this.initializeTimestamp) {
            let tmpAnticipate = this.fable.instantiateServiceProviderWithoutRegistration('Anticipate');
            if (this.pict.LogNoisiness > 3) {
              this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} beginning initialization...`);
            }
            if ('ConfigurationOnlyViews' in this.options) {
              // Load all the configuration only views
              for (let i = 0; i < this.options.ConfigurationOnlyViews.length; i++) {
                let tmpViewIdentifier = typeof this.options.ConfigurationOnlyViews[i].ViewIdentifier === 'undefined' ? `AutoView-${this.fable.getUUID()}` : this.options.ConfigurationOnlyViews[i].ViewIdentifier;
                this.log.info(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} adding configuration only view: ${tmpViewIdentifier}`);
                this.pict.addView(tmpViewIdentifier, this.options.ConfigurationOnlyViews[i]);
              }
            }
            tmpAnticipate.anticipate(this.onBeforeInitializeAsync.bind(this));
            tmpAnticipate.anticipate(this.onInitializeAsync.bind(this));

            // Walk through any loaded providers and solve them as well.
            let tmpLoadedProviders = Object.keys(this.pict.providers);
            let tmpProvidersToInitialize = [];
            for (let i = 0; i < tmpLoadedProviders.length; i++) {
              let tmpProvider = this.pict.providers[tmpLoadedProviders[i]];
              if (tmpProvider.options.AutoInitialize) {
                tmpProvidersToInitialize.push(tmpProvider);
              }
            }
            // Sort the providers by their priority (if they are all priority 0, it will end up being add order due to JSON Object Property Key order stuff)
            tmpProvidersToInitialize.sort((a, b) => {
              return a.options.AutoInitializeOrdinal - b.options.AutoInitializeOrdinal;
            });
            for (let i = 0; i < tmpProvidersToInitialize.length; i++) {
              tmpAnticipate.anticipate(tmpProvidersToInitialize[i].initializeAsync.bind(tmpProvidersToInitialize[i]));
            }

            // Now walk through any loaded views and initialize them as well.
            // TODO: Some optimization cleverness could be gained by grouping them into a parallelized async operation, by ordinal.
            let tmpLoadedViews = Object.keys(this.pict.views);
            let tmpViewsToInitialize = [];
            for (let i = 0; i < tmpLoadedViews.length; i++) {
              let tmpView = this.pict.views[tmpLoadedViews[i]];
              if (tmpView.options.AutoInitialize) {
                tmpViewsToInitialize.push(tmpView);
              }
            }
            // Sort the views by their priority
            // If they are all the default priority 0, it will end up being add order due to JSON Object Property Key order stuff
            tmpViewsToInitialize.sort((a, b) => {
              return a.options.AutoInitializeOrdinal - b.options.AutoInitializeOrdinal;
            });
            for (let i = 0; i < tmpViewsToInitialize.length; i++) {
              let tmpView = tmpViewsToInitialize[i];
              tmpAnticipate.anticipate(tmpView.initializeAsync.bind(tmpView));
            }
            tmpAnticipate.anticipate(this.onAfterInitializeAsync.bind(this));
            if (this.options.AutoLoginAfterInitialize) {
              if (this.pict.LogNoisiness > 1) {
                this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} auto login (asynchronously) after initialization...`);
              }
              tmpAnticipate.anticipate(this.loginAsync.bind(this));
            }
            if (this.options.AutoSolveAfterInitialize) {
              if (this.pict.LogNoisiness > 1) {
                this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} auto solving (asynchronously) after initialization...`);
              }
              tmpAnticipate.anticipate(this.solveAsync.bind(this));
            }
            if (this.options.AutoRenderMainViewportViewAfterInitialize) {
              if (this.pict.LogNoisiness > 1) {
                this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} auto rendering (asynchronously) after initialization...`);
              }
              tmpAnticipate.anticipate(this.renderMainViewportAsync.bind(this));
            }
            tmpAnticipate.wait(pError => {
              if (pError) {
                this.log.error(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} initializeAsync Error: ${pError.message || pError}`, {
                  stack: pError.stack
                });
              }
              this.initializeTimestamp = this.fable.log.getTimeStamp();
              if (this.pict.LogNoisiness > 2) {
                this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} initialization complete.`);
              }
              return tmpCallback();
            });
          } else {
            this.log.warn(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} async initialize called but initialization is already completed.  Aborting.`);
            // TODO: Should this be an error?
            return this.onCompletionOfInitializeAsync(tmpCallback);
          }
        }

        /**
         * @return {boolean}
         */
        onAfterInitialize() {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onAfterInitialize:`);
          }
          return true;
        }
        /**
         * @param {(error?: Error) => void} fCallback
         */
        onAfterInitializeAsync(fCallback) {
          this.onAfterInitialize();
          return fCallback();
        }

        /**
         * @return {boolean}
         */
        onCompletionOfInitialize() {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onCompletionOfInitialize:`);
          }
          return true;
        }
        /**
         * @param {(error?: Error) => void} fCallback
         */
        onCompletionOfInitializeAsync(fCallback) {
          this.onCompletionOfInitialize();
          return fCallback();
        }

        /* -------------------------------------------------------------------------- */
        /*                     Code Section: Marshal Data From All Views              */
        /* -------------------------------------------------------------------------- */
        /**
         * @return {boolean}
         */
        onBeforeMarshalFromViews() {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onBeforeMarshalFromViews:`);
          }
          return true;
        }
        /**
         * @param {(error?: Error) => void} fCallback
         */
        onBeforeMarshalFromViewsAsync(fCallback) {
          this.onBeforeMarshalFromViews();
          return fCallback();
        }

        /**
         * @return {boolean}
         */
        onMarshalFromViews() {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onMarshalFromViews:`);
          }
          return true;
        }
        /**
         * @param {(error?: Error) => void} fCallback
         */
        onMarshalFromViewsAsync(fCallback) {
          this.onMarshalFromViews();
          return fCallback();
        }

        /**
         * @return {boolean}
         */
        marshalFromViews() {
          if (this.pict.LogNoisiness > 2) {
            this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} executing marshalFromViews() function...`);
          }
          this.onBeforeMarshalFromViews();
          // Now walk through any loaded views and initialize them as well.
          let tmpLoadedViews = Object.keys(this.pict.views);
          let tmpViewsToMarshalFromViews = [];
          for (let i = 0; i < tmpLoadedViews.length; i++) {
            let tmpView = this.pict.views[tmpLoadedViews[i]];
            tmpViewsToMarshalFromViews.push(tmpView);
          }
          for (let i = 0; i < tmpViewsToMarshalFromViews.length; i++) {
            tmpViewsToMarshalFromViews[i].marshalFromView();
          }
          this.onMarshalFromViews();
          this.onAfterMarshalFromViews();
          this.lastMarshalFromViewsTimestamp = this.fable.log.getTimeStamp();
          return true;
        }

        /**
         * @param {(error?: Error) => void} fCallback
         */
        marshalFromViewsAsync(fCallback) {
          let tmpAnticipate = this.fable.instantiateServiceProviderWithoutRegistration('Anticipate');

          // Allow the callback to be passed in as the last parameter no matter what
          let tmpCallback = typeof fCallback === 'function' ? fCallback : false;
          if (!tmpCallback) {
            this.log.warn(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} marshalFromViewsAsync was called without a valid callback.  A callback will be generated but this could lead to race conditions.`);
            tmpCallback = pError => {
              if (pError) {
                this.log.error(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} marshalFromViewsAsync Auto Callback Error: ${pError}`, pError);
              }
            };
          }
          tmpAnticipate.anticipate(this.onBeforeMarshalFromViewsAsync.bind(this));
          // Walk through any loaded views and marshalFromViews them as well.
          let tmpLoadedViews = Object.keys(this.pict.views);
          let tmpViewsToMarshalFromViews = [];
          for (let i = 0; i < tmpLoadedViews.length; i++) {
            let tmpView = this.pict.views[tmpLoadedViews[i]];
            tmpViewsToMarshalFromViews.push(tmpView);
          }
          for (let i = 0; i < tmpViewsToMarshalFromViews.length; i++) {
            tmpAnticipate.anticipate(tmpViewsToMarshalFromViews[i].marshalFromViewAsync.bind(tmpViewsToMarshalFromViews[i]));
          }
          tmpAnticipate.anticipate(this.onMarshalFromViewsAsync.bind(this));
          tmpAnticipate.anticipate(this.onAfterMarshalFromViewsAsync.bind(this));
          tmpAnticipate.wait(pError => {
            if (this.pict.LogNoisiness > 2) {
              this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} marshalFromViewsAsync() complete.`);
            }
            this.lastMarshalFromViewsTimestamp = this.fable.log.getTimeStamp();
            return tmpCallback(pError);
          });
        }

        /**
         * @return {boolean}
         */
        onAfterMarshalFromViews() {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onAfterMarshalFromViews:`);
          }
          return true;
        }
        /**
         * @param {(error?: Error) => void} fCallback
         */
        onAfterMarshalFromViewsAsync(fCallback) {
          this.onAfterMarshalFromViews();
          return fCallback();
        }

        /* -------------------------------------------------------------------------- */
        /*                     Code Section: Marshal Data To All Views                */
        /* -------------------------------------------------------------------------- */
        /**
         * @return {boolean}
         */
        onBeforeMarshalToViews() {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onBeforeMarshalToViews:`);
          }
          return true;
        }
        /**
         * @param {(error?: Error) => void} fCallback
         */
        onBeforeMarshalToViewsAsync(fCallback) {
          this.onBeforeMarshalToViews();
          return fCallback();
        }

        /**
         * @return {boolean}
         */
        onMarshalToViews() {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onMarshalToViews:`);
          }
          return true;
        }
        /**
         * @param {(error?: Error) => void} fCallback
         */
        onMarshalToViewsAsync(fCallback) {
          this.onMarshalToViews();
          return fCallback();
        }

        /**
         * @return {boolean}
         */
        marshalToViews() {
          if (this.pict.LogNoisiness > 2) {
            this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} executing marshalToViews() function...`);
          }
          this.onBeforeMarshalToViews();
          // Now walk through any loaded views and initialize them as well.
          let tmpLoadedViews = Object.keys(this.pict.views);
          let tmpViewsToMarshalToViews = [];
          for (let i = 0; i < tmpLoadedViews.length; i++) {
            let tmpView = this.pict.views[tmpLoadedViews[i]];
            tmpViewsToMarshalToViews.push(tmpView);
          }
          for (let i = 0; i < tmpViewsToMarshalToViews.length; i++) {
            tmpViewsToMarshalToViews[i].marshalToView();
          }
          this.onMarshalToViews();
          this.onAfterMarshalToViews();
          this.lastMarshalToViewsTimestamp = this.fable.log.getTimeStamp();
          return true;
        }
        /**
         * @param {(error?: Error) => void} fCallback
         */
        marshalToViewsAsync(fCallback) {
          let tmpAnticipate = this.fable.instantiateServiceProviderWithoutRegistration('Anticipate');

          // Allow the callback to be passed in as the last parameter no matter what
          let tmpCallback = typeof fCallback === 'function' ? fCallback : false;
          if (!tmpCallback) {
            this.log.warn(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} marshalToViewsAsync was called without a valid callback.  A callback will be generated but this could lead to race conditions.`);
            tmpCallback = pError => {
              if (pError) {
                this.log.error(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} marshalToViewsAsync Auto Callback Error: ${pError}`, pError);
              }
            };
          }
          tmpAnticipate.anticipate(this.onBeforeMarshalToViewsAsync.bind(this));
          // Walk through any loaded views and marshalToViews them as well.
          let tmpLoadedViews = Object.keys(this.pict.views);
          let tmpViewsToMarshalToViews = [];
          for (let i = 0; i < tmpLoadedViews.length; i++) {
            let tmpView = this.pict.views[tmpLoadedViews[i]];
            tmpViewsToMarshalToViews.push(tmpView);
          }
          for (let i = 0; i < tmpViewsToMarshalToViews.length; i++) {
            tmpAnticipate.anticipate(tmpViewsToMarshalToViews[i].marshalToViewAsync.bind(tmpViewsToMarshalToViews[i]));
          }
          tmpAnticipate.anticipate(this.onMarshalToViewsAsync.bind(this));
          tmpAnticipate.anticipate(this.onAfterMarshalToViewsAsync.bind(this));
          tmpAnticipate.wait(pError => {
            if (this.pict.LogNoisiness > 2) {
              this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} marshalToViewsAsync() complete.`);
            }
            this.lastMarshalToViewsTimestamp = this.fable.log.getTimeStamp();
            return tmpCallback(pError);
          });
        }

        /**
         * @return {boolean}
         */
        onAfterMarshalToViews() {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onAfterMarshalToViews:`);
          }
          return true;
        }
        /**
         * @param {(error?: Error) => void} fCallback
         */
        onAfterMarshalToViewsAsync(fCallback) {
          this.onAfterMarshalToViews();
          return fCallback();
        }

        /* -------------------------------------------------------------------------- */
        /*                     Code Section: Render View                              */
        /* -------------------------------------------------------------------------- */
        /**
         * @return {boolean}
         */
        onBeforeRender() {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onBeforeRender:`);
          }
          return true;
        }
        /**
         * @param {(error?: Error) => void} fCallback
         */
        onBeforeRenderAsync(fCallback) {
          this.onBeforeRender();
          return fCallback();
        }

        /**
         * @param {string} [pViewIdentifier] - The hash of the view to render. By default, the main viewport view is rendered.
         * @param {string} [pRenderableHash] - The hash of the renderable to render.
         * @param {string} [pRenderDestinationAddress] - The address where the renderable will be rendered.
         * @param {string} [pTemplateDataAddress] - The address where the data for the template is stored.
         *
         * TODO: Should we support objects for pTemplateDataAddress for parity with pict-view?
         */
        render(pViewIdentifier, pRenderableHash, pRenderDestinationAddress, pTemplateDataAddress) {
          let tmpViewIdentifier = typeof pViewIdentifier !== 'string' ? this.options.MainViewportViewIdentifier : pViewIdentifier;
          let tmpRenderableHash = typeof pRenderableHash !== 'string' ? this.options.MainViewportRenderableHash : pRenderableHash;
          let tmpRenderDestinationAddress = typeof pRenderDestinationAddress !== 'string' ? this.options.MainViewportDestinationAddress : pRenderDestinationAddress;
          let tmpTemplateDataAddress = typeof pTemplateDataAddress !== 'string' ? this.options.MainViewportDefaultDataAddress : pTemplateDataAddress;
          if (this.pict.LogControlFlow) {
            this.log.trace(`PICT-ControlFlow APPLICATION [${this.UUID}]::[${this.Hash}] ${this.options.Name} VIEW Renderable[${tmpRenderableHash}] Destination[${tmpRenderDestinationAddress}] TemplateDataAddress[${tmpTemplateDataAddress}] render:`);
          }
          this.onBeforeRender();

          // Now get the view (by hash) from the loaded views
          let tmpView = typeof tmpViewIdentifier === 'string' ? this.servicesMap.PictView[tmpViewIdentifier] : false;
          if (!tmpView) {
            this.log.error(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} could not render from View ${tmpViewIdentifier} because it is not a valid view.`);
            return false;
          }
          this.onRender();
          tmpView.render(tmpRenderableHash, tmpRenderDestinationAddress, tmpTemplateDataAddress);
          this.onAfterRender();
          return true;
        }
        /**
         * @return {boolean}
         */
        onRender() {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onRender:`);
          }
          return true;
        }
        /**
         * @param {(error?: Error) => void} fCallback
         */
        onRenderAsync(fCallback) {
          this.onRender();
          return fCallback();
        }

        /**
         * @param {string|((error?: Error) => void)} pViewIdentifier - The hash of the view to render. By default, the main viewport view is rendered. (or the callback)
         * @param {string|((error?: Error) => void)} [pRenderableHash] - The hash of the renderable to render. (or the callback)
         * @param {string|((error?: Error) => void)} [pRenderDestinationAddress] - The address where the renderable will be rendered. (or the callback)
         * @param {string|((error?: Error) => void)} [pTemplateDataAddress] - The address where the data for the template is stored. (or the callback)
         * @param {(error?: Error) => void} [fCallback] - The callback, if all other parameters are provided.
         *
         * TODO: Should we support objects for pTemplateDataAddress for parity with pict-view?
         */
        renderAsync(pViewIdentifier, pRenderableHash, pRenderDestinationAddress, pTemplateDataAddress, fCallback) {
          let tmpViewIdentifier = typeof pViewIdentifier !== 'string' ? this.options.MainViewportViewIdentifier : pViewIdentifier;
          let tmpRenderableHash = typeof pRenderableHash !== 'string' ? this.options.MainViewportRenderableHash : pRenderableHash;
          let tmpRenderDestinationAddress = typeof pRenderDestinationAddress !== 'string' ? this.options.MainViewportDestinationAddress : pRenderDestinationAddress;
          let tmpTemplateDataAddress = typeof pTemplateDataAddress !== 'string' ? this.options.MainViewportDefaultDataAddress : pTemplateDataAddress;

          // Allow the callback to be passed in as the last parameter no matter what
          let tmpCallback = typeof fCallback === 'function' ? fCallback : typeof pTemplateDataAddress === 'function' ? pTemplateDataAddress : typeof pRenderDestinationAddress === 'function' ? pRenderDestinationAddress : typeof pRenderableHash === 'function' ? pRenderableHash : typeof pViewIdentifier === 'function' ? pViewIdentifier : false;
          if (!tmpCallback) {
            this.log.warn(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} renderAsync was called without a valid callback.  A callback will be generated but this could lead to race conditions.`);
            tmpCallback = pError => {
              if (pError) {
                this.log.error(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} renderAsync Auto Callback Error: ${pError}`, pError);
              }
            };
          }
          if (this.pict.LogControlFlow) {
            this.log.trace(`PICT-ControlFlow APPLICATION [${this.UUID}]::[${this.Hash}] ${this.options.Name} VIEW Renderable[${tmpRenderableHash}] Destination[${tmpRenderDestinationAddress}] TemplateDataAddress[${tmpTemplateDataAddress}] renderAsync:`);
          }
          let tmpRenderAnticipate = this.fable.newAnticipate();
          tmpRenderAnticipate.anticipate(this.onBeforeRenderAsync.bind(this));
          let tmpView = typeof tmpViewIdentifier === 'string' ? this.servicesMap.PictView[tmpViewIdentifier] : false;
          if (!tmpView) {
            let tmpErrorMessage = `PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} could not asynchronously render from View ${tmpViewIdentifier} because it is not a valid view.`;
            if (this.pict.LogNoisiness > 3) {
              this.log.error(tmpErrorMessage);
            }
            return tmpCallback(new Error(tmpErrorMessage));
          }
          tmpRenderAnticipate.anticipate(this.onRenderAsync.bind(this));
          tmpRenderAnticipate.anticipate(fNext => {
            tmpView.renderAsync.call(tmpView, tmpRenderableHash, tmpRenderDestinationAddress, tmpTemplateDataAddress, fNext);
          });
          tmpRenderAnticipate.anticipate(this.onAfterRenderAsync.bind(this));
          return tmpRenderAnticipate.wait(tmpCallback);
        }

        /**
         * @return {boolean}
         */
        onAfterRender() {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} onAfterRender:`);
          }
          return true;
        }
        /**
         * @param {(error?: Error) => void} fCallback
         */
        onAfterRenderAsync(fCallback) {
          this.onAfterRender();
          return fCallback();
        }

        /**
         * @return {boolean}
         */
        renderMainViewport() {
          if (this.pict.LogControlFlow) {
            this.log.trace(`PICT-ControlFlow APPLICATION [${this.UUID}]::[${this.Hash}] ${this.options.Name} renderMainViewport:`);
          }
          return this.render();
        }
        /**
         * @param {(error?: Error) => void} fCallback
         */
        renderMainViewportAsync(fCallback) {
          if (this.pict.LogControlFlow) {
            this.log.trace(`PICT-ControlFlow APPLICATION [${this.UUID}]::[${this.Hash}] ${this.options.Name} renderMainViewportAsync:`);
          }
          return this.renderAsync(fCallback);
        }
        /**
         * @return {void}
         */
        renderAutoViews() {
          if (this.pict.LogNoisiness > 0) {
            this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} beginning renderAutoViews...`);
          }
          // Now walk through any loaded views and sort them by the AutoRender ordinal
          let tmpLoadedViews = Object.keys(this.pict.views);
          // Sort the views by their priority
          // If they are all the default priority 0, it will end up being add order due to JSON Object Property Key order stuff
          tmpLoadedViews.sort((a, b) => {
            return this.pict.views[a].options.AutoRenderOrdinal - this.pict.views[b].options.AutoRenderOrdinal;
          });
          for (let i = 0; i < tmpLoadedViews.length; i++) {
            let tmpView = this.pict.views[tmpLoadedViews[i]];
            if (tmpView.options.AutoRender) {
              tmpView.render();
            }
          }
          if (this.pict.LogNoisiness > 0) {
            this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} renderAutoViewsAsync complete.`);
          }
        }
        /**
         * @param {(error?: Error) => void} fCallback
         */
        renderAutoViewsAsync(fCallback) {
          let tmpAnticipate = this.fable.instantiateServiceProviderWithoutRegistration('Anticipate');

          // Allow the callback to be passed in as the last parameter no matter what
          let tmpCallback = typeof fCallback === 'function' ? fCallback : false;
          if (!tmpCallback) {
            this.log.warn(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} renderAutoViewsAsync was called without a valid callback.  A callback will be generated but this could lead to race conditions.`);
            tmpCallback = pError => {
              if (pError) {
                this.log.error(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} renderAutoViewsAsync Auto Callback Error: ${pError}`, pError);
              }
            };
          }
          if (this.pict.LogNoisiness > 0) {
            this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} beginning renderAutoViewsAsync...`);
          }

          // Now walk through any loaded views and sort them by the AutoRender ordinal
          // TODO: Some optimization cleverness could be gained by grouping them into a parallelized async operation, by ordinal.
          let tmpLoadedViews = Object.keys(this.pict.views);
          // Sort the views by their priority
          // If they are all the default priority 0, it will end up being add order due to JSON Object Property Key order stuff
          tmpLoadedViews.sort((a, b) => {
            return this.pict.views[a].options.AutoRenderOrdinal - this.pict.views[b].options.AutoRenderOrdinal;
          });
          for (let i = 0; i < tmpLoadedViews.length; i++) {
            let tmpView = this.pict.views[tmpLoadedViews[i]];
            if (tmpView.options.AutoRender) {
              tmpAnticipate.anticipate(tmpView.renderAsync.bind(tmpView));
            }
          }
          tmpAnticipate.wait(pError => {
            this.lastAutoRenderTimestamp = this.fable.log.getTimeStamp();
            if (this.pict.LogNoisiness > 0) {
              this.log.trace(`PictApp [${this.UUID}]::[${this.Hash}] ${this.options.Name} renderAutoViewsAsync complete.`);
            }
            return tmpCallback(pError);
          });
        }

        /**
         * @return {boolean}
         */
        get isPictApplication() {
          return true;
        }
      }
      module.exports = PictApplication;
    }, {
      "../package.json": 3,
      "fable-serviceproviderbase": 2
    }],
    5: [function (require, module, exports) {
      module.exports = {
        "name": "pict-view",
        "version": "1.0.68",
        "description": "Pict View Base Class",
        "main": "source/Pict-View.js",
        "scripts": {
          "test": "npx quack test",
          "tests": "npx quack test -g",
          "start": "node source/Pict-View.js",
          "coverage": "npx quack coverage",
          "build": "npx quack build",
          "docker-dev-build": "docker build ./ -f Dockerfile_LUXURYCode -t pict-view-image:local",
          "docker-dev-run": "docker run -it -d --name pict-view-dev -p 30001:8080 -p 38086:8086 -v \"$PWD/.config:/home/coder/.config\"  -v \"$PWD:/home/coder/pict-view\" -u \"$(id -u):$(id -g)\" -e \"DOCKER_USER=$USER\" pict-view-image:local",
          "docker-dev-shell": "docker exec -it pict-view-dev /bin/bash",
          "types": "tsc -p .",
          "lint": "eslint source/**"
        },
        "types": "types/source/Pict-View.d.ts",
        "repository": {
          "type": "git",
          "url": "git+https://github.com/stevenvelozo/pict-view.git"
        },
        "author": "steven velozo <steven@velozo.com>",
        "license": "MIT",
        "bugs": {
          "url": "https://github.com/stevenvelozo/pict-view/issues"
        },
        "homepage": "https://github.com/stevenvelozo/pict-view#readme",
        "devDependencies": {
          "@eslint/js": "^9.39.1",
          "browser-env": "^3.3.0",
          "eslint": "^9.39.1",
          "pict": "^1.0.363",
          "quackage": "^1.0.65",
          "typescript": "^5.9.3"
        },
        "mocha": {
          "diff": true,
          "extension": ["js"],
          "package": "./package.json",
          "reporter": "spec",
          "slow": "75",
          "timeout": "5000",
          "ui": "tdd",
          "watch-files": ["source/**/*.js", "test/**/*.js"],
          "watch-ignore": ["lib/vendor"]
        },
        "dependencies": {
          "fable": "^3.1.67",
          "fable-serviceproviderbase": "^3.0.19"
        }
      };
    }, {}],
    6: [function (require, module, exports) {
      const libFableServiceBase = require('fable-serviceproviderbase');
      const libPackage = require('../package.json');
      const defaultPictViewSettings = {
        DefaultRenderable: false,
        DefaultDestinationAddress: false,
        DefaultTemplateRecordAddress: false,
        ViewIdentifier: false,
        // If this is set to true, when the App initializes this will.
        // After the App initializes, initialize will be called as soon as it's added.
        AutoInitialize: true,
        AutoInitializeOrdinal: 0,
        // If this is set to true, when the App autorenders (on load) this will.
        // After the App initializes, render will be called as soon as it's added.
        AutoRender: true,
        AutoRenderOrdinal: 0,
        AutoSolveWithApp: true,
        AutoSolveOrdinal: 0,
        CSSHash: false,
        CSS: false,
        CSSProvider: false,
        CSSPriority: 500,
        Templates: [],
        DefaultTemplates: [],
        Renderables: [],
        Manifests: {}
      };

      /** @typedef {(error?: Error) => void} ErrorCallback */
      /** @typedef {number | boolean} PictTimestamp */

      /**
       * @typedef {'replace' | 'append' | 'prepend' | 'append_once' | 'virtual-assignment'} RenderMethod
       */
      /**
       * @typedef {Object} Renderable
       *
       * @property {string} RenderableHash - A unique hash for the renderable.
       * @property {string} TemplateHash - The hash of the template to use for rendering this renderable.
       * @property {string} [DefaultTemplateRecordAddress] - The default address for resolving the data record for this renderable.
       * @property {string} [ContentDestinationAddress] - The default address (DOM CSS selector) for rendering the content of this renderable.
       * @property {RenderMethod} [RenderMethod=replace] - The method to use when projecting the renderable to the DOM ('replace', 'append', 'prepend', 'append_once', 'virtual-assignment').
       * @property {string} [TestAddress] - The address to use for testing the renderable.
       * @property {string} [TransactionHash] - The transaction hash for the root renderable.
       * @property {string} [RootRenderableViewHash] - The hash of the root renderable.
       * @property {string} [Content] - The rendered content for this renderable, if applicable.
       */

      /**
       * Represents a view in the Pict ecosystem.
       */
      class PictView extends libFableServiceBase {
        /**
         * @param {any} pFable - The Fable object that this service is attached to.
         * @param {any} [pOptions] - (optional) The options for this service.
         * @param {string} [pServiceHash] - (optional) The hash of the service.
         */
        constructor(pFable, pOptions, pServiceHash) {
          // Intersect default options, parent constructor, service information
          let tmpOptions = Object.assign({}, JSON.parse(JSON.stringify(defaultPictViewSettings)), pOptions);
          super(pFable, tmpOptions, pServiceHash);
          //FIXME: add types to fable and ancillaries
          /** @type {any} */
          this.fable;
          /** @type {any} */
          this.options;
          /** @type {String} */
          this.UUID;
          /** @type {String} */
          this.Hash;
          /** @type {any} */
          this.log;
          const tmpHashIsUUID = this.Hash === this.UUID;
          //NOTE: since many places are using the view UUID as the HTML element ID, we prefix it to avoid starting with a number
          this.UUID = `V-${this.UUID}`;
          if (tmpHashIsUUID) {
            this.Hash = this.UUID;
          }
          if (!this.options.ViewIdentifier) {
            this.options.ViewIdentifier = `AutoViewID-${this.fable.getUUID()}`;
          }
          this.serviceType = 'PictView';
          /** @type {Record<string, any>} */
          this._Package = libPackage;
          // Convenience and consistency naming
          /** @type {import('pict') & { log: any, instantiateServiceProviderWithoutRegistration: (hash: String) => any, instantiateServiceProviderIfNotExists: (hash: string) => any, TransactionTracking: import('pict/types/source/services/Fable-Service-TransactionTracking') }} */
          this.pict = this.fable;
          // Wire in the essential Pict application state
          this.AppData = this.pict.AppData;
          this.Bundle = this.pict.Bundle;

          /** @type {PictTimestamp} */
          this.initializeTimestamp = false;
          /** @type {PictTimestamp} */
          this.lastSolvedTimestamp = false;
          /** @type {PictTimestamp} */
          this.lastRenderedTimestamp = false;
          /** @type {PictTimestamp} */
          this.lastMarshalFromViewTimestamp = false;
          /** @type {PictTimestamp} */
          this.lastMarshalToViewTimestamp = false;
          this.pict.instantiateServiceProviderIfNotExists('TransactionTracking');

          // Load all templates from the array in the options
          // Templates are in the form of {Hash:'Some-Template-Hash',Template:'Template content',Source:'TemplateSource'}
          for (let i = 0; i < this.options.Templates.length; i++) {
            let tmpTemplate = this.options.Templates[i];
            if (!('Hash' in tmpTemplate) || !('Template' in tmpTemplate)) {
              this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not load Template ${i} in the options array.`, tmpTemplate);
            } else {
              if (!tmpTemplate.Source) {
                tmpTemplate.Source = `PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} options object.`;
              }
              this.pict.TemplateProvider.addTemplate(tmpTemplate.Hash, tmpTemplate.Template, tmpTemplate.Source);
            }
          }

          // Load all default templates from the array in the options
          // Templates are in the form of {Prefix:'',Postfix:'-List-Row',Template:'Template content',Source:'TemplateSourceString'}
          for (let i = 0; i < this.options.DefaultTemplates.length; i++) {
            let tmpDefaultTemplate = this.options.DefaultTemplates[i];
            if (!('Postfix' in tmpDefaultTemplate) || !('Template' in tmpDefaultTemplate)) {
              this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not load Default Template ${i} in the options array.`, tmpDefaultTemplate);
            } else {
              if (!tmpDefaultTemplate.Source) {
                tmpDefaultTemplate.Source = `PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} options object.`;
              }
              this.pict.TemplateProvider.addDefaultTemplate(tmpDefaultTemplate.Prefix, tmpDefaultTemplate.Postfix, tmpDefaultTemplate.Template, tmpDefaultTemplate.Source);
            }
          }

          // Load the CSS if it's available
          if (this.options.CSS) {
            let tmpCSSHash = this.options.CSSHash ? this.options.CSSHash : `View-${this.options.ViewIdentifier}`;
            let tmpCSSProvider = this.options.CSSProvider ? this.options.CSSProvider : tmpCSSHash;
            this.pict.CSSMap.addCSS(tmpCSSHash, this.options.CSS, tmpCSSProvider, this.options.CSSPriority);
          }

          // Load all renderables
          // Renderables are launchable renderable instructions with templates
          // They look as such: {Identifier:'ContentEntry', TemplateHash:'Content-Entry-Section-Main', ContentDestinationAddress:'#ContentSection', RecordAddress:'AppData.Content.DefaultText', ManifestTransformation:'ManyfestHash', ManifestDestinationAddress:'AppData.Content.DataToTransformContent'}
          // The only parts that are necessary are Identifier and Template
          // A developer can then do render('ContentEntry') and it just kinda works.  Or they can override the ContentDestinationAddress
          /** @type {Record<String, Renderable>} */
          this.renderables = {};
          for (let i = 0; i < this.options.Renderables.length; i++) {
            /** @type {Renderable} */
            let tmpRenderable = this.options.Renderables[i];
            this.addRenderable(tmpRenderable);
          }
        }

        /**
         * Adds a renderable to the view.
         *
         * @param {string | Renderable} pRenderableHash - The hash of the renderable, or a renderable object.
         * @param {string} [pTemplateHash] - (optional) The hash of the template for the renderable.
         * @param {string} [pDefaultTemplateRecordAddress] - (optional) The default data address for the template.
         * @param {string} [pDefaultDestinationAddress] - (optional) The default destination address for the renderable.
         * @param {RenderMethod} [pRenderMethod=replace] - (optional) The method to use when rendering the renderable (ex. 'replace').
         */
        addRenderable(pRenderableHash, pTemplateHash, pDefaultTemplateRecordAddress, pDefaultDestinationAddress, pRenderMethod) {
          /** @type {Renderable} */
          let tmpRenderable;
          if (typeof pRenderableHash == 'object') {
            // The developer passed in the renderable as an object.
            // Use theirs instead!
            tmpRenderable = pRenderableHash;
          } else {
            /** @type {RenderMethod} */
            let tmpRenderMethod = typeof pRenderMethod !== 'string' ? pRenderMethod : 'replace';
            tmpRenderable = {
              RenderableHash: pRenderableHash,
              TemplateHash: pTemplateHash,
              DefaultTemplateRecordAddress: pDefaultTemplateRecordAddress,
              ContentDestinationAddress: pDefaultDestinationAddress,
              RenderMethod: tmpRenderMethod
            };
          }
          if (typeof tmpRenderable.RenderableHash != 'string' || typeof tmpRenderable.TemplateHash != 'string') {
            this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not load Renderable; RenderableHash or TemplateHash are invalid.`, tmpRenderable);
          } else {
            if (this.pict.LogNoisiness > 0) {
              this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} adding renderable [${tmpRenderable.RenderableHash}] pointed to template ${tmpRenderable.TemplateHash}.`);
            }
            this.renderables[tmpRenderable.RenderableHash] = tmpRenderable;
          }
        }

        /* -------------------------------------------------------------------------- */
        /*                        Code Section: Initialization                        */
        /* -------------------------------------------------------------------------- */
        /**
         * Lifecycle hook that triggers before the view is initialized.
         */
        onBeforeInitialize() {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onBeforeInitialize:`);
          }
          return true;
        }

        /**
         * Lifecycle hook that triggers before the view is initialized (async flow).
         *
         * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
         */
        onBeforeInitializeAsync(fCallback) {
          this.onBeforeInitialize();
          return fCallback();
        }

        /**
         * Lifecycle hook that triggers when the view is initialized.
         */
        onInitialize() {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onInitialize:`);
          }
          return true;
        }

        /**
         * Lifecycle hook that triggers when the view is initialized (async flow).
         *
         * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
         */
        onInitializeAsync(fCallback) {
          this.onInitialize();
          return fCallback();
        }

        /**
         * Performs view initialization.
         */
        initialize() {
          if (this.pict.LogControlFlow) {
            this.log.trace(`PICT-ControlFlow VIEW [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} initialize:`);
          }
          if (!this.initializeTimestamp) {
            this.onBeforeInitialize();
            this.onInitialize();
            this.onAfterInitialize();
            this.initializeTimestamp = this.pict.log.getTimeStamp();
            return true;
          } else {
            this.log.warn(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} initialize called but initialization is already completed.  Aborting.`);
            return false;
          }
        }

        /**
         * Performs view initialization (async flow).
         *
         * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
         */
        initializeAsync(fCallback) {
          if (this.pict.LogControlFlow) {
            this.log.trace(`PICT-ControlFlow VIEW [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} initializeAsync:`);
          }
          if (!this.initializeTimestamp) {
            let tmpAnticipate = this.pict.instantiateServiceProviderWithoutRegistration('Anticipate');
            if (this.pict.LogNoisiness > 0) {
              this.log.info(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} beginning initialization...`);
            }
            tmpAnticipate.anticipate(this.onBeforeInitializeAsync.bind(this));
            tmpAnticipate.anticipate(this.onInitializeAsync.bind(this));
            tmpAnticipate.anticipate(this.onAfterInitializeAsync.bind(this));
            tmpAnticipate.wait(/** @param {Error} pError */
            pError => {
              if (pError) {
                this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} initialization failed: ${pError.message || pError}`, {
                  stack: pError.stack
                });
              }
              this.initializeTimestamp = this.pict.log.getTimeStamp();
              if (this.pict.LogNoisiness > 0) {
                this.log.info(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} initialization complete.`);
              }
              return fCallback();
            });
          } else {
            this.log.warn(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} async initialize called but initialization is already completed.  Aborting.`);
            // TODO: Should this be an error?
            return fCallback();
          }
        }
        onAfterInitialize() {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onAfterInitialize:`);
          }
          return true;
        }

        /**
         * Lifecycle hook that triggers after the view is initialized (async flow).
         *
         * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
         */
        onAfterInitializeAsync(fCallback) {
          this.onAfterInitialize();
          return fCallback();
        }

        /* -------------------------------------------------------------------------- */
        /*                            Code Section: Render                            */
        /* -------------------------------------------------------------------------- */
        /**
         * Lifecycle hook that triggers before the view is rendered.
         *
         * @param {Renderable} pRenderable - The renderable that will be rendered.
         */
        onBeforeRender(pRenderable) {
          // Overload this to mess with stuff before the content gets generated from the template
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onBeforeRender:`);
          }
          return true;
        }

        /**
         * Lifecycle hook that triggers before the view is rendered (async flow).
         *
         * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
         * @param {Renderable} pRenderable - The renderable that will be rendered.
         */
        onBeforeRenderAsync(fCallback, pRenderable) {
          this.onBeforeRender(pRenderable);
          return fCallback();
        }

        /**
         * Lifecycle hook that triggers before the view is projected into the DOM.
         *
         * @param {Renderable} pRenderable - The renderable that will be projected.
         */
        onBeforeProject(pRenderable) {
          // Overload this to mess with stuff before the content gets generated from the template
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onBeforeProject:`);
          }
          return true;
        }

        /**
         * Lifecycle hook that triggers before the view is projected into the DOM (async flow).
         *
         * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
         * @param {Renderable} pRenderable - The renderable that will be projected.
         */
        onBeforeProjectAsync(fCallback, pRenderable) {
          this.onBeforeProject(pRenderable);
          return fCallback();
        }

        /**
         * Builds the render options for a renderable.
         *
         * For DRY purposes on the three flavors of render.
         *
         * @param {string|ErrorCallback} [pRenderableHash] - The hash of the renderable to render.
         * @param {string|ErrorCallback} [pRenderDestinationAddress] - The address where the renderable will be rendered.
         * @param {string|object|ErrorCallback} [pTemplateRecordAddress] - The address of (or actual obejct) where the data for the template is stored.
         */
        buildRenderOptions(pRenderableHash, pRenderDestinationAddress, pTemplateRecordAddress) {
          let tmpRenderOptions = {
            Valid: true
          };
          tmpRenderOptions.RenderableHash = typeof pRenderableHash === 'string' ? pRenderableHash : typeof this.options.DefaultRenderable == 'string' ? this.options.DefaultRenderable : false;
          if (!tmpRenderOptions.RenderableHash) {
            this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not find a suitable RenderableHash ${tmpRenderOptions.RenderableHash} (param ${pRenderableHash}because it is not a valid renderable.`);
            tmpRenderOptions.Valid = false;
          }
          tmpRenderOptions.Renderable = this.renderables[tmpRenderOptions.RenderableHash];
          if (!tmpRenderOptions.Renderable) {
            this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not render ${tmpRenderOptions.RenderableHash} (param ${pRenderableHash}) because it does not exist.`);
            tmpRenderOptions.Valid = false;
          }
          tmpRenderOptions.DestinationAddress = typeof pRenderDestinationAddress === 'string' ? pRenderDestinationAddress : typeof tmpRenderOptions.Renderable.ContentDestinationAddress === 'string' ? tmpRenderOptions.Renderable.ContentDestinationAddress : typeof this.options.DefaultDestinationAddress === 'string' ? this.options.DefaultDestinationAddress : false;
          if (!tmpRenderOptions.DestinationAddress) {
            this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not render ${tmpRenderOptions.RenderableHash} (param ${pRenderableHash}) because it does not have a valid destination address (param ${pRenderDestinationAddress}).`);
            tmpRenderOptions.Valid = false;
          }
          if (typeof pTemplateRecordAddress === 'object') {
            tmpRenderOptions.RecordAddress = 'Passed in as object';
            tmpRenderOptions.Record = pTemplateRecordAddress;
          } else {
            tmpRenderOptions.RecordAddress = typeof pTemplateRecordAddress === 'string' ? pTemplateRecordAddress : typeof tmpRenderOptions.Renderable.DefaultTemplateRecordAddress === 'string' ? tmpRenderOptions.Renderable.DefaultTemplateRecordAddress : typeof this.options.DefaultTemplateRecordAddress === 'string' ? this.options.DefaultTemplateRecordAddress : false;
            tmpRenderOptions.Record = typeof tmpRenderOptions.RecordAddress === 'string' ? this.pict.DataProvider.getDataByAddress(tmpRenderOptions.RecordAddress) : undefined;
          }
          return tmpRenderOptions;
        }

        /**
         * Assigns the content to the destination address.
         *
         * For DRY purposes on the three flavors of render.
         *
         * @param {Renderable} pRenderable - The renderable to render.
         * @param {string} pRenderDestinationAddress - The address where the renderable will be rendered.
         * @param {string} pContent - The content to render.
         * @returns {boolean} - Returns true if the content was assigned successfully.
         * @memberof PictView
         */
        assignRenderContent(pRenderable, pRenderDestinationAddress, pContent) {
          return this.pict.ContentAssignment.projectContent(pRenderable.RenderMethod, pRenderDestinationAddress, pContent, pRenderable.TestAddress);
        }

        /**
         * Render a renderable from this view.
         *
         * @param {string} [pRenderableHash] - The hash of the renderable to render.
         * @param {string} [pRenderDestinationAddress] - The address where the renderable will be rendered.
         * @param {string|object} [pTemplateRecordAddress] - The address where the data for the template is stored.
         * @param {Renderable} [pRootRenderable] - The root renderable for the render operation, if applicable.
         * @return {boolean}
         */
        render(pRenderableHash, pRenderDestinationAddress, pTemplateRecordAddress, pRootRenderable) {
          return this.renderWithScope(this, pRenderableHash, pRenderDestinationAddress, pTemplateRecordAddress, pRootRenderable);
        }

        /**
         * Render a renderable from this view, providing a specifici scope for the template.
         *
         * @param {any} pScope - The scope to use for the template rendering.
         * @param {string} [pRenderableHash] - The hash of the renderable to render.
         * @param {string} [pRenderDestinationAddress] - The address where the renderable will be rendered.
         * @param {string|object} [pTemplateRecordAddress] - The address where the data for the template is stored.
         * @param {Renderable} [pRootRenderable] - The root renderable for the render operation, if applicable.
         * @return {boolean}
         */
        renderWithScope(pScope, pRenderableHash, pRenderDestinationAddress, pTemplateRecordAddress, pRootRenderable) {
          let tmpRenderableHash = typeof pRenderableHash === 'string' ? pRenderableHash : typeof this.options.DefaultRenderable == 'string' ? this.options.DefaultRenderable : false;
          if (!tmpRenderableHash) {
            this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not render ${tmpRenderableHash} (param ${pRenderableHash}) because it is not a valid renderable.`);
            return false;
          }

          /** @type {Renderable} */
          let tmpRenderable;
          if (tmpRenderableHash == '__Virtual') {
            tmpRenderable = {
              RenderableHash: '__Virtual',
              TemplateHash: this.renderables[this.options.DefaultRenderable].TemplateHash,
              ContentDestinationAddress: typeof pRenderDestinationAddress === 'string' ? pRenderDestinationAddress : typeof tmpRenderable.ContentDestinationAddress === 'string' ? tmpRenderable.ContentDestinationAddress : typeof this.options.DefaultDestinationAddress === 'string' ? this.options.DefaultDestinationAddress : null,
              RenderMethod: 'virtual-assignment',
              TransactionHash: pRootRenderable && pRootRenderable.TransactionHash,
              RootRenderableViewHash: pRootRenderable && pRootRenderable.RootRenderableViewHash
            };
          } else {
            tmpRenderable = Object.assign({}, this.renderables[tmpRenderableHash]);
            tmpRenderable.ContentDestinationAddress = typeof pRenderDestinationAddress === 'string' ? pRenderDestinationAddress : typeof tmpRenderable.ContentDestinationAddress === 'string' ? tmpRenderable.ContentDestinationAddress : typeof this.options.DefaultDestinationAddress === 'string' ? this.options.DefaultDestinationAddress : null;
          }
          if (!tmpRenderable.TransactionHash) {
            tmpRenderable.TransactionHash = `ViewRender-V-${this.options.ViewIdentifier}-R-${tmpRenderableHash}-U-${this.pict.getUUID()}`;
            tmpRenderable.RootRenderableViewHash = this.Hash;
            this.pict.TransactionTracking.registerTransaction(tmpRenderable.TransactionHash);
          }
          if (!tmpRenderable) {
            this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not render ${tmpRenderableHash} (param ${pRenderableHash}) because it does not exist.`);
            return false;
          }
          if (!tmpRenderable.ContentDestinationAddress) {
            this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not render ${tmpRenderableHash} (param ${pRenderableHash}) because it does not have a valid destination address.`);
            return false;
          }
          let tmpRecordAddress;
          let tmpRecord;
          if (typeof pTemplateRecordAddress === 'object') {
            tmpRecord = pTemplateRecordAddress;
            tmpRecordAddress = 'Passed in as object';
          } else {
            tmpRecordAddress = typeof pTemplateRecordAddress === 'string' ? pTemplateRecordAddress : typeof tmpRenderable.DefaultTemplateRecordAddress === 'string' ? tmpRenderable.DefaultTemplateRecordAddress : typeof this.options.DefaultTemplateRecordAddress === 'string' ? this.options.DefaultTemplateRecordAddress : false;
            tmpRecord = typeof tmpRecordAddress === 'string' ? this.pict.DataProvider.getDataByAddress(tmpRecordAddress) : undefined;
          }

          // Execute the developer-overridable pre-render behavior
          this.onBeforeRender(tmpRenderable);
          if (this.pict.LogControlFlow) {
            this.log.trace(`PICT-ControlFlow VIEW [${this.UUID}]::[${this.Hash}] Renderable[${tmpRenderableHash}] Destination[${tmpRenderable.ContentDestinationAddress}] TemplateRecordAddress[${tmpRecordAddress}] render:`);
          }
          if (this.pict.LogNoisiness > 0) {
            this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} Beginning Render of Renderable[${tmpRenderableHash}] to Destination [${tmpRenderable.ContentDestinationAddress}]...`);
          }
          // Generate the content output from the template and data
          tmpRenderable.Content = this.pict.parseTemplateByHash(tmpRenderable.TemplateHash, tmpRecord, null, [this], pScope, {
            RootRenderable: typeof pRootRenderable === 'object' ? pRootRenderable : tmpRenderable
          });
          if (this.pict.LogNoisiness > 0) {
            this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} Assigning Renderable[${tmpRenderableHash}] content length ${tmpRenderable.Content.length} to Destination [${tmpRenderable.ContentDestinationAddress}] using render method [${tmpRenderable.RenderMethod}].`);
          }
          this.onBeforeProject(tmpRenderable);
          this.onProject(tmpRenderable);
          if (tmpRenderable.RenderMethod !== 'virtual-assignment') {
            this.onAfterProject(tmpRenderable);

            // Execute the developer-overridable post-render behavior
            this.onAfterRender(tmpRenderable);
          }
          return true;
        }

        /**
         * Render a renderable from this view.
         *
         * @param {string|ErrorCallback} [pRenderableHash] - The hash of the renderable to render.
         * @param {string|ErrorCallback} [pRenderDestinationAddress] - The address where the renderable will be rendered.
         * @param {string|object|ErrorCallback} [pTemplateRecordAddress] - The address where the data for the template is stored.
         * @param {Renderable|ErrorCallback} [pRootRenderable] - The root renderable for the render operation, if applicable.
         * @param {ErrorCallback} [fCallback] - The callback to call when the async operation is complete.
         *
         * @return {void}
         */
        renderAsync(pRenderableHash, pRenderDestinationAddress, pTemplateRecordAddress, pRootRenderable, fCallback) {
          return this.renderWithScopeAsync(this, pRenderableHash, pRenderDestinationAddress, pTemplateRecordAddress, pRootRenderable, fCallback);
        }

        /**
         * Render a renderable from this view.
         *
         * @param {any} pScope - The scope to use for the template rendering.
         * @param {string|ErrorCallback} [pRenderableHash] - The hash of the renderable to render.
         * @param {string|ErrorCallback} [pRenderDestinationAddress] - The address where the renderable will be rendered.
         * @param {string|object|ErrorCallback} [pTemplateRecordAddress] - The address where the data for the template is stored.
         * @param {Renderable|ErrorCallback} [pRootRenderable] - The root renderable for the render operation, if applicable.
         * @param {ErrorCallback} [fCallback] - The callback to call when the async operation is complete.
         *
         * @return {void}
         */
        renderWithScopeAsync(pScope, pRenderableHash, pRenderDestinationAddress, pTemplateRecordAddress, pRootRenderable, fCallback) {
          let tmpRenderableHash = typeof pRenderableHash === 'string' ? pRenderableHash : typeof this.options.DefaultRenderable == 'string' ? this.options.DefaultRenderable : false;

          // Allow the callback to be passed in as the last parameter no matter what
          /** @type {ErrorCallback} */
          let tmpCallback = typeof fCallback === 'function' ? fCallback : typeof pTemplateRecordAddress === 'function' ? pTemplateRecordAddress : typeof pRenderDestinationAddress === 'function' ? pRenderDestinationAddress : typeof pRenderableHash === 'function' ? pRenderableHash : typeof pRootRenderable === 'function' ? pRootRenderable : null;
          if (!tmpCallback) {
            this.log.warn(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.Name} renderAsync was called without a valid callback.  A callback will be generated but this could lead to race conditions.`);
            tmpCallback = pError => {
              if (pError) {
                this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.Name} renderAsync Auto Callback Error: ${pError}`, pError);
              }
            };
          }
          if (!tmpRenderableHash) {
            this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not asynchronously render ${tmpRenderableHash} (param ${pRenderableHash}because it is not a valid renderable.`);
            return tmpCallback(new Error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not asynchronously render ${tmpRenderableHash} (param ${pRenderableHash}because it is not a valid renderable.`));
          }

          /** @type {Renderable} */
          let tmpRenderable;
          if (tmpRenderableHash == '__Virtual') {
            tmpRenderable = {
              RenderableHash: '__Virtual',
              TemplateHash: this.renderables[this.options.DefaultRenderable].TemplateHash,
              ContentDestinationAddress: typeof pRenderDestinationAddress === 'string' ? pRenderDestinationAddress : typeof this.options.DefaultDestinationAddress === 'string' ? this.options.DefaultDestinationAddress : null,
              RenderMethod: 'virtual-assignment',
              TransactionHash: pRootRenderable && typeof pRootRenderable !== 'function' && pRootRenderable.TransactionHash,
              RootRenderableViewHash: pRootRenderable && typeof pRootRenderable !== 'function' && pRootRenderable.RootRenderableViewHash
            };
          } else {
            tmpRenderable = Object.assign({}, this.renderables[tmpRenderableHash]);
            tmpRenderable.ContentDestinationAddress = typeof pRenderDestinationAddress === 'string' ? pRenderDestinationAddress : typeof tmpRenderable.ContentDestinationAddress === 'string' ? tmpRenderable.ContentDestinationAddress : typeof this.options.DefaultDestinationAddress === 'string' ? this.options.DefaultDestinationAddress : null;
          }
          if (!tmpRenderable.TransactionHash) {
            tmpRenderable.TransactionHash = `ViewRender-V-${this.options.ViewIdentifier}-R-${tmpRenderableHash}-U-${this.pict.getUUID()}`;
            tmpRenderable.RootRenderableViewHash = this.Hash;
            this.pict.TransactionTracking.registerTransaction(tmpRenderable.TransactionHash);
          }
          if (!tmpRenderable) {
            this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not render ${tmpRenderableHash} (param ${pRenderableHash}) because it does not exist.`);
            return tmpCallback(new Error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not render ${tmpRenderableHash} (param ${pRenderableHash}) because it does not exist.`));
          }
          if (!tmpRenderable.ContentDestinationAddress) {
            this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not render ${tmpRenderableHash} (param ${pRenderableHash}) because it does not have a valid destination address.`);
            return tmpCallback(new Error(`Could not render ${tmpRenderableHash}`));
          }
          let tmpRecordAddress;
          let tmpRecord;
          if (typeof pTemplateRecordAddress === 'object') {
            tmpRecord = pTemplateRecordAddress;
            tmpRecordAddress = 'Passed in as object';
          } else {
            tmpRecordAddress = typeof pTemplateRecordAddress === 'string' ? pTemplateRecordAddress : typeof tmpRenderable.DefaultTemplateRecordAddress === 'string' ? tmpRenderable.DefaultTemplateRecordAddress : typeof this.options.DefaultTemplateRecordAddress === 'string' ? this.options.DefaultTemplateRecordAddress : false;
            tmpRecord = typeof tmpRecordAddress === 'string' ? this.pict.DataProvider.getDataByAddress(tmpRecordAddress) : undefined;
          }
          if (this.pict.LogControlFlow) {
            this.log.trace(`PICT-ControlFlow VIEW [${this.UUID}]::[${this.Hash}] Renderable[${tmpRenderableHash}] Destination[${tmpRenderable.ContentDestinationAddress}] TemplateRecordAddress[${tmpRecordAddress}] renderAsync:`);
          }
          if (this.pict.LogNoisiness > 2) {
            this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} Beginning Asynchronous Render (callback-style)...`);
          }
          let tmpAnticipate = this.fable.newAnticipate();
          tmpAnticipate.anticipate(fOnBeforeRenderCallback => {
            this.onBeforeRenderAsync(fOnBeforeRenderCallback, tmpRenderable);
          });
          tmpAnticipate.anticipate(fAsyncTemplateCallback => {
            // Render the template (asynchronously)
            this.pict.parseTemplateByHash(tmpRenderable.TemplateHash, tmpRecord, (pError, pContent) => {
              if (pError) {
                this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not render (asynchronously) ${tmpRenderableHash} (param ${pRenderableHash}) because it did not parse the template.`, pError);
                return fAsyncTemplateCallback(pError);
              }
              tmpRenderable.Content = pContent;
              return fAsyncTemplateCallback();
            }, [this], pScope, {
              RootRenderable: typeof pRootRenderable === 'object' ? pRootRenderable : tmpRenderable
            });
          });
          tmpAnticipate.anticipate(fNext => {
            this.onBeforeProjectAsync(fNext, tmpRenderable);
          });
          tmpAnticipate.anticipate(fNext => {
            this.onProjectAsync(fNext, tmpRenderable);
          });
          if (tmpRenderable.RenderMethod !== 'virtual-assignment') {
            tmpAnticipate.anticipate(fNext => {
              this.onAfterProjectAsync(fNext, tmpRenderable);
            });

            // Execute the developer-overridable post-render behavior
            tmpAnticipate.anticipate(fNext => {
              this.onAfterRenderAsync(fNext, tmpRenderable);
            });
          }
          tmpAnticipate.wait(tmpCallback);
        }

        /**
         * Renders the default renderable.
         *
         * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
         */
        renderDefaultAsync(fCallback) {
          // Render the default renderable
          this.renderAsync(fCallback);
        }

        /**
         * @param {string} [pRenderableHash] - The hash of the renderable to render.
         * @param {string} [pRenderDestinationAddress] - The address where the renderable will be rendered.
         * @param {string|object} [pTemplateRecordAddress] - The address of (or actual obejct) where the data for the template is stored.
         */
        basicRender(pRenderableHash, pRenderDestinationAddress, pTemplateRecordAddress) {
          return this.basicRenderWithScope(this, pRenderableHash, pRenderDestinationAddress, pTemplateRecordAddress);
        }

        /**
         * @param {any} pScope - The scope to use for the template rendering.
         * @param {string} [pRenderableHash] - The hash of the renderable to render.
         * @param {string} [pRenderDestinationAddress] - The address where the renderable will be rendered.
         * @param {string|object} [pTemplateRecordAddress] - The address of (or actual obejct) where the data for the template is stored.
         */
        basicRenderWithScope(pScope, pRenderableHash, pRenderDestinationAddress, pTemplateRecordAddress) {
          let tmpRenderOptions = this.buildRenderOptions(pRenderableHash, pRenderDestinationAddress, pTemplateRecordAddress);
          if (tmpRenderOptions.Valid) {
            this.assignRenderContent(tmpRenderOptions.Renderable, tmpRenderOptions.DestinationAddress, this.pict.parseTemplateByHash(tmpRenderOptions.Renderable.TemplateHash, tmpRenderOptions.Record, null, [this], pScope, {
              RootRenderable: tmpRenderOptions.Renderable
            }));
            return true;
          } else {
            this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not perform a basic render of ${tmpRenderOptions.RenderableHash} because it is not valid.`);
            return false;
          }
        }

        /**
         * @param {string|ErrorCallback} [pRenderableHash] - The hash of the renderable to render.
         * @param {string|ErrorCallback} [pRenderDestinationAddress] - The address where the renderable will be rendered.
         * @param {string|Object|ErrorCallback} [pTemplateRecordAddress] - The address of (or actual obejct) where the data for the template is stored.
         * @param {ErrorCallback} [fCallback] - The callback to call when the async operation is complete.
         */
        basicRenderAsync(pRenderableHash, pRenderDestinationAddress, pTemplateRecordAddress, fCallback) {
          return this.basicRenderWithScopeAsync(this, pRenderableHash, pRenderDestinationAddress, pTemplateRecordAddress, fCallback);
        }

        /**
         * @param {any} pScope - The scope to use for the template rendering.
         * @param {string|ErrorCallback} [pRenderableHash] - The hash of the renderable to render.
         * @param {string|ErrorCallback} [pRenderDestinationAddress] - The address where the renderable will be rendered.
         * @param {string|Object|ErrorCallback} [pTemplateRecordAddress] - The address of (or actual obejct) where the data for the template is stored.
         * @param {ErrorCallback} [fCallback] - The callback to call when the async operation is complete.
         */
        basicRenderWithScopeAsync(pScope, pRenderableHash, pRenderDestinationAddress, pTemplateRecordAddress, fCallback) {
          // Allow the callback to be passed in as the last parameter no matter what
          /** @type {ErrorCallback} */
          let tmpCallback = typeof fCallback === 'function' ? fCallback : typeof pTemplateRecordAddress === 'function' ? pTemplateRecordAddress : typeof pRenderDestinationAddress === 'function' ? pRenderDestinationAddress : typeof pRenderableHash === 'function' ? pRenderableHash : null;
          if (!tmpCallback) {
            this.log.warn(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.Name} basicRenderAsync was called without a valid callback.  A callback will be generated but this could lead to race conditions.`);
            tmpCallback = pError => {
              if (pError) {
                this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.Name} basicRenderAsync Auto Callback Error: ${pError}`, pError);
              }
            };
          }
          const tmpRenderOptions = this.buildRenderOptions(pRenderableHash, pRenderDestinationAddress, pTemplateRecordAddress);
          if (tmpRenderOptions.Valid) {
            this.pict.parseTemplateByHash(tmpRenderOptions.Renderable.TemplateHash, tmpRenderOptions.Record,
            /**
             * @param {Error} [pError] - The error that occurred during template parsing.
             * @param {string} [pContent] - The content that was rendered from the template.
             */
            (pError, pContent) => {
              if (pError) {
                this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not render (asynchronously) ${tmpRenderOptions.RenderableHash} because it did not parse the template.`, pError);
                return tmpCallback(pError);
              }
              this.assignRenderContent(tmpRenderOptions.Renderable, tmpRenderOptions.DestinationAddress, pContent);
              return tmpCallback();
            }, [this], pScope, {
              RootRenderable: tmpRenderOptions.Renderable
            });
          } else {
            let tmpErrorMessage = `PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} could not perform a basic render of ${tmpRenderOptions.RenderableHash} because it is not valid.`;
            this.log.error(tmpErrorMessage);
            return tmpCallback(new Error(tmpErrorMessage));
          }
        }

        /**
         * @param {Renderable} pRenderable - The renderable that was rendered.
         */
        onProject(pRenderable) {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onProject:`);
          }
          if (pRenderable.RenderMethod === 'virtual-assignment') {
            this.pict.TransactionTracking.pushToTransactionQueue(pRenderable.TransactionHash, {
              ViewHash: this.Hash,
              Renderable: pRenderable
            }, 'Deferred-Post-Content-Assignment');
          }
          if (this.pict.LogNoisiness > 0) {
            this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} Assigning Renderable[${pRenderable.RenderableHash}] content length ${pRenderable.Content.length} to Destination [${pRenderable.ContentDestinationAddress}] using Async render method ${pRenderable.RenderMethod}.`);
          }

          // Assign the content to the destination address
          this.pict.ContentAssignment.projectContent(pRenderable.RenderMethod, pRenderable.ContentDestinationAddress, pRenderable.Content, pRenderable.TestAddress);
          this.lastRenderedTimestamp = this.pict.log.getTimeStamp();
        }

        /**
         * Lifecycle hook that triggers after the view is projected into the DOM (async flow).
         *
         * @param {(error?: Error, content?: string) => void} fCallback - The callback to call when the async operation is complete.
         * @param {Renderable} pRenderable - The renderable that is being projected.
         */
        onProjectAsync(fCallback, pRenderable) {
          this.onProject(pRenderable);
          return fCallback();
        }

        /**
         * Lifecycle hook that triggers after the view is rendered.
         *
         * @param {Renderable} pRenderable - The renderable that was rendered.
         */
        onAfterRender(pRenderable) {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onAfterRender:`);
          }
          if (pRenderable && pRenderable.RootRenderableViewHash === this.Hash) {
            const tmpTransactionQueue = this.pict.TransactionTracking.clearTransactionQueue(pRenderable.TransactionHash) || [];
            for (const tmpEvent of tmpTransactionQueue) {
              const tmpView = this.pict.views[tmpEvent.Data.ViewHash];
              if (!tmpView) {
                this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onAfterRender: Could not find view for transaction hash ${pRenderable.TransactionHash} and ViewHash ${tmpEvent.Data.ViewHash}.`);
                continue;
              }
              tmpView.onAfterProject();

              // Execute the developer-overridable post-render behavior
              tmpView.onAfterRender(tmpEvent.Data.Renderable);
            }
            // Queue is drained and nested child renders have each cleaned up
            // their own transactions; remove this root render's entry from
            // the tracking map so it does not leak.
            this.pict.TransactionTracking.unregisterTransaction(pRenderable.TransactionHash);
          }
          return true;
        }

        /**
         * Lifecycle hook that triggers after the view is rendered (async flow).
         *
         * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
         * @param {Renderable} pRenderable - The renderable that was rendered.
         */
        onAfterRenderAsync(fCallback, pRenderable) {
          // NOTE: this.onAfterRender(pRenderable) will itself clear the
          // transaction queue and unregister the transaction if this view is
          // the root renderable - see onAfterRender above. So by the time the
          // loop below runs, the queue is already empty and there is nothing
          // to drain. Keeping the async queue walk here defensively in case
          // future subclasses override onAfterRender in ways that skip the
          // drain, but the common path is now "sync drain, async no-op".
          this.onAfterRender(pRenderable);
          const tmpAnticipate = this.fable.newAnticipate();
          const tmpIsRootRenderable = pRenderable && pRenderable.RootRenderableViewHash === this.Hash;
          if (tmpIsRootRenderable) {
            const queue = this.pict.TransactionTracking.clearTransactionQueue(pRenderable.TransactionHash) || [];
            for (const event of queue) {
              /** @type {PictView} */
              const tmpView = this.pict.views[event.Data.ViewHash];
              if (!tmpView) {
                this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onAfterRenderAsync: Could not find view for transaction hash ${pRenderable.TransactionHash} and ViewHash ${event.Data.ViewHash}.`);
                continue;
              }
              tmpAnticipate.anticipate(tmpView.onAfterProjectAsync.bind(tmpView));
              tmpAnticipate.anticipate(fNext => {
                tmpView.onAfterRenderAsync(fNext, event.Data.Renderable);
              });

              // Execute the developer-overridable post-render behavior
            }
          }
          return tmpAnticipate.wait(pError => {
            // Nested virtual-assignment children have now settled their own
            // onAfterRenderAsync chains (and unregistered their own
            // transactions along the way). Ensure this root render's entry
            // is also gone - unregisterTransaction is a no-op if the sync
            // onAfterRender above already removed it, so this is safe to
            // call unconditionally on the root path.
            if (tmpIsRootRenderable && pRenderable && pRenderable.TransactionHash) {
              this.pict.TransactionTracking.unregisterTransaction(pRenderable.TransactionHash);
            }
            return fCallback(pError);
          });
        }

        /**
         * Lifecycle hook that triggers after the view is projected into the DOM.
         *
         * @param {Renderable} pRenderable - The renderable that was projected.
         */
        onAfterProject(pRenderable) {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onAfterProject:`);
          }
          return true;
        }

        /**
         * Lifecycle hook that triggers after the view is projected into the DOM (async flow).
         *
         * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
         * @param {Renderable} pRenderable - The renderable that was projected.
         */
        onAfterProjectAsync(fCallback, pRenderable) {
          return fCallback();
        }

        /* -------------------------------------------------------------------------- */
        /*                            Code Section: Solver                            */
        /* -------------------------------------------------------------------------- */
        /**
         * Lifecycle hook that triggers before the view is solved.
         */
        onBeforeSolve() {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onBeforeSolve:`);
          }
          return true;
        }

        /**
         * Lifecycle hook that triggers before the view is solved (async flow).
         *
         * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
         */
        onBeforeSolveAsync(fCallback) {
          this.onBeforeSolve();
          return fCallback();
        }

        /**
         * Lifecycle hook that triggers when the view is solved.
         */
        onSolve() {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onSolve:`);
          }
          return true;
        }

        /**
         * Lifecycle hook that triggers when the view is solved (async flow).
         *
         * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
         */
        onSolveAsync(fCallback) {
          this.onSolve();
          return fCallback();
        }

        /**
         * Performs view solving and triggers lifecycle hooks.
         *
         * @return {boolean} - True if the view was solved successfully, false otherwise.
         */
        solve() {
          if (this.pict.LogNoisiness > 2) {
            this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} executing solve() function...`);
          }
          this.onBeforeSolve();
          this.onSolve();
          this.onAfterSolve();
          this.lastSolvedTimestamp = this.pict.log.getTimeStamp();
          return true;
        }

        /**
         * Performs view solving and triggers lifecycle hooks (async flow).
         *
         * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
         */
        solveAsync(fCallback) {
          let tmpAnticipate = this.pict.instantiateServiceProviderWithoutRegistration('Anticipate');

          /** @type {ErrorCallback} */
          let tmpCallback = typeof fCallback === 'function' ? fCallback : null;
          if (!tmpCallback) {
            this.log.warn(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.Name} solveAsync was called without a valid callback.  A callback will be generated but this could lead to race conditions.`);
            tmpCallback = pError => {
              if (pError) {
                this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.Name} solveAsync Auto Callback Error: ${pError}`, pError);
              }
            };
          }
          tmpAnticipate.anticipate(this.onBeforeSolveAsync.bind(this));
          tmpAnticipate.anticipate(this.onSolveAsync.bind(this));
          tmpAnticipate.anticipate(this.onAfterSolveAsync.bind(this));
          tmpAnticipate.wait(pError => {
            if (this.pict.LogNoisiness > 2) {
              this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} solveAsync() complete.`);
            }
            this.lastSolvedTimestamp = this.pict.log.getTimeStamp();
            return tmpCallback(pError);
          });
        }

        /**
         * Lifecycle hook that triggers after the view is solved.
         */
        onAfterSolve() {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onAfterSolve:`);
          }
          return true;
        }

        /**
         * Lifecycle hook that triggers after the view is solved (async flow).
         *
         * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
         */
        onAfterSolveAsync(fCallback) {
          this.onAfterSolve();
          return fCallback();
        }

        /* -------------------------------------------------------------------------- */
        /*                     Code Section: Marshal From View                        */
        /* -------------------------------------------------------------------------- */
        /**
         * Lifecycle hook that triggers before data is marshaled from the view.
         *
         * @return {boolean} - True if the operation was successful, false otherwise.
         */
        onBeforeMarshalFromView() {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onBeforeMarshalFromView:`);
          }
          return true;
        }

        /**
         * Lifecycle hook that triggers before data is marshaled from the view (async flow).
         *
         * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
         */
        onBeforeMarshalFromViewAsync(fCallback) {
          this.onBeforeMarshalFromView();
          return fCallback();
        }

        /**
         * Lifecycle hook that triggers when data is marshaled from the view.
         */
        onMarshalFromView() {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onMarshalFromView:`);
          }
          return true;
        }

        /**
         * Lifecycle hook that triggers when data is marshaled from the view (async flow).
         *
         * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
         */
        onMarshalFromViewAsync(fCallback) {
          this.onMarshalFromView();
          return fCallback();
        }

        /**
         * Marshals data from the view.
         *
         * @return {boolean} - True if the operation was successful, false otherwise.
         */
        marshalFromView() {
          if (this.pict.LogNoisiness > 2) {
            this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} executing solve() function...`);
          }
          this.onBeforeMarshalFromView();
          this.onMarshalFromView();
          this.onAfterMarshalFromView();
          this.lastMarshalFromViewTimestamp = this.pict.log.getTimeStamp();
          return true;
        }

        /**
         * Marshals data from the view (async flow).
         *
         * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
         */
        marshalFromViewAsync(fCallback) {
          let tmpAnticipate = this.pict.instantiateServiceProviderWithoutRegistration('Anticipate');

          /** @type {ErrorCallback} */
          let tmpCallback = typeof fCallback === 'function' ? fCallback : null;
          if (!tmpCallback) {
            this.log.warn(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.Name} marshalFromViewAsync was called without a valid callback.  A callback will be generated but this could lead to race conditions.`);
            tmpCallback = pError => {
              if (pError) {
                this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.Name} marshalFromViewAsync Auto Callback Error: ${pError}`, pError);
              }
            };
          }
          tmpAnticipate.anticipate(this.onBeforeMarshalFromViewAsync.bind(this));
          tmpAnticipate.anticipate(this.onMarshalFromViewAsync.bind(this));
          tmpAnticipate.anticipate(this.onAfterMarshalFromViewAsync.bind(this));
          tmpAnticipate.wait(pError => {
            if (this.pict.LogNoisiness > 2) {
              this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} marshalFromViewAsync() complete.`);
            }
            this.lastMarshalFromViewTimestamp = this.pict.log.getTimeStamp();
            return tmpCallback(pError);
          });
        }

        /**
         * Lifecycle hook that triggers after data is marshaled from the view.
         */
        onAfterMarshalFromView() {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onAfterMarshalFromView:`);
          }
          return true;
        }

        /**
         * Lifecycle hook that triggers after data is marshaled from the view (async flow).
         *
         * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
         */
        onAfterMarshalFromViewAsync(fCallback) {
          this.onAfterMarshalFromView();
          return fCallback();
        }

        /* -------------------------------------------------------------------------- */
        /*                     Code Section: Marshal To View                          */
        /* -------------------------------------------------------------------------- */
        /**
         * Lifecycle hook that triggers before data is marshaled into the view.
         */
        onBeforeMarshalToView() {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onBeforeMarshalToView:`);
          }
          return true;
        }

        /**
         * Lifecycle hook that triggers before data is marshaled into the view (async flow).
         *
         * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
         */
        onBeforeMarshalToViewAsync(fCallback) {
          this.onBeforeMarshalToView();
          return fCallback();
        }

        /**
         * Lifecycle hook that triggers when data is marshaled into the view.
         */
        onMarshalToView() {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onMarshalToView:`);
          }
          return true;
        }

        /**
         * Lifecycle hook that triggers when data is marshaled into the view (async flow).
         *
         * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
         */
        onMarshalToViewAsync(fCallback) {
          this.onMarshalToView();
          return fCallback();
        }

        /**
         * Marshals data into the view.
         *
         * @return {boolean} - True if the operation was successful, false otherwise.
         */
        marshalToView() {
          if (this.pict.LogNoisiness > 2) {
            this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} executing solve() function...`);
          }
          this.onBeforeMarshalToView();
          this.onMarshalToView();
          this.onAfterMarshalToView();
          this.lastMarshalToViewTimestamp = this.pict.log.getTimeStamp();
          return true;
        }

        /**
         * Marshals data into the view (async flow).
         *
         * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
         */
        marshalToViewAsync(fCallback) {
          let tmpAnticipate = this.pict.instantiateServiceProviderWithoutRegistration('Anticipate');

          /** @type {ErrorCallback} */
          let tmpCallback = typeof fCallback === 'function' ? fCallback : null;
          if (!tmpCallback) {
            this.log.warn(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.Name} marshalToViewAsync was called without a valid callback.  A callback will be generated but this could lead to race conditions.`);
            tmpCallback = pError => {
              if (pError) {
                this.log.error(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.Name} marshalToViewAsync Auto Callback Error: ${pError}`, pError);
              }
            };
          }
          tmpAnticipate.anticipate(this.onBeforeMarshalToViewAsync.bind(this));
          tmpAnticipate.anticipate(this.onMarshalToViewAsync.bind(this));
          tmpAnticipate.anticipate(this.onAfterMarshalToViewAsync.bind(this));
          tmpAnticipate.wait(pError => {
            if (this.pict.LogNoisiness > 2) {
              this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} marshalToViewAsync() complete.`);
            }
            this.lastMarshalToViewTimestamp = this.pict.log.getTimeStamp();
            return tmpCallback(pError);
          });
        }

        /**
         * Lifecycle hook that triggers after data is marshaled into the view.
         */
        onAfterMarshalToView() {
          if (this.pict.LogNoisiness > 3) {
            this.log.trace(`PictView [${this.UUID}]::[${this.Hash}] ${this.options.ViewIdentifier} onAfterMarshalToView:`);
          }
          return true;
        }

        /**
         * Lifecycle hook that triggers after data is marshaled into the view (async flow).
         *
         * @param {ErrorCallback} fCallback - The callback to call when the async operation is complete.
         */
        onAfterMarshalToViewAsync(fCallback) {
          this.onAfterMarshalToView();
          return fCallback();
        }

        /** @return {boolean} - True if the object is a PictView. */
        get isPictView() {
          return true;
        }
      }
      module.exports = PictView;
    }, {
      "../package.json": 5,
      "fable-serviceproviderbase": 2
    }],
    7: [function (require, module, exports) {
      /**
       * Retold DataMapper — Pict Application
       *
       * Shell for the visual mapping editor. Registers the MapperAPI provider
       * and all views, seeds AppData, and renders the Layout view.
       */
      const libPictApplication = require('pict-application');
      const libMapperAPIProvider = require('./providers/Pict-Provider-MapperAPI.js');
      const libViewLayout = require('./views/PictView-Mapper-Layout.js');
      const libViewBeaconBrowser = require('./views/PictView-Mapper-BeaconBrowser.js');
      const libViewFieldMapper = require('./views/PictView-Mapper-FieldMapper.js');
      const libViewMappingList = require('./views/PictView-Mapper-MappingList.js');
      const libViewJSONEditor = require('./views/PictView-Mapper-JSONEditor.js');
      class DataMapperApplication extends libPictApplication {
        constructor(pFable, pOptions, pServiceHash) {
          super(pFable, pOptions, pServiceHash);
          this.serviceType = 'DataMapperApplication';
          this.pict.addProvider('MapperAPI', libMapperAPIProvider.default_configuration, libMapperAPIProvider);
          this.pict.addView('Mapper-Layout', libViewLayout.default_configuration, libViewLayout);
          this.pict.addView('Mapper-BeaconBrowser', libViewBeaconBrowser.default_configuration, libViewBeaconBrowser);
          this.pict.addView('Mapper-FieldMapper', libViewFieldMapper.default_configuration, libViewFieldMapper);
          this.pict.addView('Mapper-MappingList', libViewMappingList.default_configuration, libViewMappingList);
          this.pict.addView('Mapper-JSONEditor', libViewJSONEditor.default_configuration, libViewJSONEditor);
        }
        onAfterInitializeAsync(fCallback) {
          if (!this.pict.AppData) this.pict.AppData = {};
          this.pict.AppData.Mapper = {
            UltravisorURL: '',
            UltravisorStatus: 'Disconnected',
            UltravisorStatusLabel: 'Disconnected',
            UltravisorBadgeClass: 'badge-neutral',
            Beacons: [],
            SourceBeacons: [],
            TargetBeacons: [],
            SourceBeaconName: '',
            SourceConnections: [],
            SourceConnectionID: null,
            SourceConnectionHash: '',
            SourceEntities: [],
            SourceEntity: '',
            SourceFields: [],
            TargetBeaconName: '',
            TargetConnections: [],
            TargetConnectionID: null,
            TargetConnectionHash: '',
            TargetEntities: [],
            TargetEntity: '',
            TargetFields: [],
            SelectedSourceField: '',
            Mappings: [],
            SavedMappings: [],
            ActivePanel: 'mapper',
            // mapper | mappings | json

            StatusMessage: 'Ready',
            JSONText: ''
          };
          if (typeof window !== 'undefined') window.DataMapperApp = this;
          this.pict.views['Mapper-Layout'].render();
          let tmpProvider = this.pict.providers.MapperAPI;
          if (tmpProvider) {
            tmpProvider.loadUltravisorStatus(() => {
              tmpProvider.loadBeacons();
              tmpProvider.loadSavedMappings();
            });
          }
          return super.onAfterInitializeAsync(fCallback);
        }
        setActivePanel(pPanelName) {
          if (this.pict.views['Mapper-Layout'] && typeof this.pict.views['Mapper-Layout'].setActivePanel === 'function') {
            this.pict.views['Mapper-Layout'].setActivePanel(pPanelName);
          }
        }
      }
      module.exports = DataMapperApplication;
      module.exports.default_configuration = {};
    }, {
      "./providers/Pict-Provider-MapperAPI.js": 9,
      "./views/PictView-Mapper-BeaconBrowser.js": 10,
      "./views/PictView-Mapper-FieldMapper.js": 11,
      "./views/PictView-Mapper-JSONEditor.js": 12,
      "./views/PictView-Mapper-Layout.js": 13,
      "./views/PictView-Mapper-MappingList.js": 14,
      "pict-application": 4
    }],
    8: [function (require, module, exports) {
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
    }, {
      "./Pict-Application-DataMapper.js": 7,
      "./providers/Pict-Provider-MapperAPI.js": 9,
      "./views/PictView-Mapper-BeaconBrowser.js": 10,
      "./views/PictView-Mapper-FieldMapper.js": 11,
      "./views/PictView-Mapper-JSONEditor.js": 12,
      "./views/PictView-Mapper-Layout.js": 13,
      "./views/PictView-Mapper-MappingList.js": 14,
      "pict-application": 4,
      "pict-view": 6
    }],
    9: [function (require, module, exports) {
      /**
       * Retold DataMapper — API Provider
       *
       * Calls the DataMapper's own REST API at /mapper/* and stores results in
       * AppData. The server-side dispatches foreign-beacon calls through the
       * Ultravisor mesh, so this provider never has to know about mesh routing.
       */
      const libPictProvider = require('pict-view');
      class MapperAPIProvider extends libPictProvider {
        constructor(pFable, pOptions, pServiceHash) {
          super(pFable, pOptions, pServiceHash);
          this.serviceType = 'MapperAPIProvider';
        }
        _apiCall(pMethod, pPath, pBody, fCallback) {
          let tmpOptions = {
            method: pMethod,
            headers: {
              'Content-Type': 'application/json'
            }
          };
          if (pBody && pMethod !== 'GET') {
            tmpOptions.body = JSON.stringify(pBody);
          }
          fetch(pPath, tmpOptions).then(pResponse => pResponse.json()).then(pData => {
            if (fCallback) fCallback(null, pData);
          }).catch(pError => {
            if (fCallback) fCallback(pError);
          });
        }

        // ── Ultravisor ──────────────────────────────────────────

        loadUltravisorStatus(fCallback) {
          this._apiCall('GET', '/mapper/ultravisor/status', null, (pError, pData) => {
            if (!pError && pData) {
              this._applyUltravisorStatus(pData);
            }
            this._renderLayout();
            if (fCallback) fCallback(pError, pData);
          });
        }
        connectUltravisor(pURL, pBeaconName, fCallback) {
          this._apiCall('POST', '/mapper/ultravisor/connect', {
            URL: pURL,
            BeaconName: pBeaconName || 'retold-data-mapper'
          }, (pError, pData) => {
            if (!pError && pData) {
              this._applyUltravisorStatus(pData);
            }
            this._renderLayout();
            if (!pError && pData && pData.Success) {
              this.loadBeacons();
            }
            if (fCallback) fCallback(pError, pData);
          });
        }
        disconnectUltravisor(fCallback) {
          this._apiCall('POST', '/mapper/ultravisor/disconnect', null, (pError, pData) => {
            this.pict.AppData.Mapper.UltravisorStatus = 'Disconnected';
            this.pict.AppData.Mapper.UltravisorStatusLabel = 'Disconnected';
            this.pict.AppData.Mapper.UltravisorBadgeClass = 'badge-neutral';
            this.pict.AppData.Mapper.Beacons = [];
            this.pict.AppData.Mapper.SourceBeacons = [];
            this.pict.AppData.Mapper.TargetBeacons = [];
            this._renderLayout();
            this._renderBeaconBrowser();
            if (fCallback) fCallback(pError, pData);
          });
        }
        _applyUltravisorStatus(pData) {
          let tmpStatus = pData.Status || (pData.Connected ? 'Connected' : 'Disconnected');
          let tmpLabel = tmpStatus;
          let tmpBadge = 'badge-neutral';
          if (pData.Connected) {
            tmpBadge = 'badge-success';
          } else if (tmpStatus === 'Failed') {
            tmpBadge = 'badge-error';
          }
          this.pict.AppData.Mapper.UltravisorStatus = tmpStatus;
          this.pict.AppData.Mapper.UltravisorStatusLabel = tmpLabel;
          this.pict.AppData.Mapper.UltravisorBadgeClass = tmpBadge;
          this.pict.AppData.Mapper.UltravisorURL = pData.URL || this.pict.AppData.Mapper.UltravisorURL;
        }

        // ── Beacons ─────────────────────────────────────────────

        loadBeacons(fCallback) {
          this._apiCall('GET', '/mapper/beacons', null, (pError, pData) => {
            if (!pError && pData) {
              this.pict.AppData.Mapper.Beacons = pData.Beacons || [];
              this._recomputeBeaconOptions();
            }
            this._renderBeaconBrowser();
            if (fCallback) fCallback(pError, pData);
          });
        }
        loadSourceConnections(pBeaconName, fCallback) {
          this.pict.AppData.Mapper.SourceBeaconName = pBeaconName;
          this.pict.AppData.Mapper.SourceConnections = [];
          this.pict.AppData.Mapper.SourceConnectionID = null;
          this.pict.AppData.Mapper.SourceConnectionHash = '';
          this.pict.AppData.Mapper.SourceEntities = [];
          this.pict.AppData.Mapper.SourceEntity = '';
          this.pict.AppData.Mapper.SourceFields = [];
          if (!pBeaconName) {
            this._recomputeBeaconOptions();
            this._renderBeaconBrowser();
            this._renderFieldMapper();
            if (fCallback) fCallback();
            return;
          }
          this._apiCall('GET', `/mapper/beacon/${encodeURIComponent(pBeaconName)}/connections`, null, (pError, pData) => {
            if (!pError && pData) {
              this.pict.AppData.Mapper.SourceConnections = pData.Connections || [];
            }
            this._recomputeBeaconOptions();
            this._renderBeaconBrowser();
            this._renderFieldMapper();
            if (fCallback) fCallback(pError, pData);
          });
        }
        loadTargetConnections(pBeaconName, fCallback) {
          this.pict.AppData.Mapper.TargetBeaconName = pBeaconName;
          this.pict.AppData.Mapper.TargetConnections = [];
          this.pict.AppData.Mapper.TargetConnectionID = null;
          this.pict.AppData.Mapper.TargetConnectionHash = '';
          this.pict.AppData.Mapper.TargetEntities = [];
          this.pict.AppData.Mapper.TargetEntity = '';
          this.pict.AppData.Mapper.TargetFields = [];
          if (!pBeaconName) {
            this._recomputeBeaconOptions();
            this._renderBeaconBrowser();
            this._renderFieldMapper();
            if (fCallback) fCallback();
            return;
          }
          this._apiCall('GET', `/mapper/beacon/${encodeURIComponent(pBeaconName)}/connections`, null, (pError, pData) => {
            if (!pError && pData) {
              this.pict.AppData.Mapper.TargetConnections = pData.Connections || [];
            }
            this._recomputeBeaconOptions();
            this._renderBeaconBrowser();
            this._renderFieldMapper();
            if (fCallback) fCallback(pError, pData);
          });
        }
        introspectSource(pIDBeaconConnection, fCallback) {
          let tmpBeaconName = this.pict.AppData.Mapper.SourceBeaconName;
          if (!tmpBeaconName || !pIDBeaconConnection) {
            if (fCallback) fCallback(new Error('beacon + id required'));
            return;
          }
          this.pict.AppData.Mapper.SourceConnectionID = pIDBeaconConnection;
          let tmpConn = this._findConnection(this.pict.AppData.Mapper.SourceConnections, pIDBeaconConnection);
          this.pict.AppData.Mapper.SourceConnectionHash = this._slugify(tmpConn ? tmpConn.Name : '');
          this._apiCall('POST', `/mapper/beacon/${encodeURIComponent(tmpBeaconName)}/introspect`, {
            IDBeaconConnection: pIDBeaconConnection
          }, (pError, pData) => {
            if (!pError && pData) {
              this.pict.AppData.Mapper.SourceEntities = pData.Tables || [];
              if (pData.ConnectionHash) {
                this.pict.AppData.Mapper.SourceConnectionHash = pData.ConnectionHash;
              }
            }
            this._recomputeBeaconOptions();
            this._renderBeaconBrowser();
            if (fCallback) fCallback(pError, pData);
          });
        }
        introspectTarget(pIDBeaconConnection, fCallback) {
          let tmpBeaconName = this.pict.AppData.Mapper.TargetBeaconName;
          if (!tmpBeaconName || !pIDBeaconConnection) {
            if (fCallback) fCallback(new Error('beacon + id required'));
            return;
          }
          this.pict.AppData.Mapper.TargetConnectionID = pIDBeaconConnection;
          let tmpConn = this._findConnection(this.pict.AppData.Mapper.TargetConnections, pIDBeaconConnection);
          this.pict.AppData.Mapper.TargetConnectionHash = this._slugify(tmpConn ? tmpConn.Name : '');
          this._apiCall('POST', `/mapper/beacon/${encodeURIComponent(tmpBeaconName)}/introspect`, {
            IDBeaconConnection: pIDBeaconConnection
          }, (pError, pData) => {
            if (!pError && pData) {
              this.pict.AppData.Mapper.TargetEntities = pData.Tables || [];
              if (pData.ConnectionHash) {
                this.pict.AppData.Mapper.TargetConnectionHash = pData.ConnectionHash;
              }
            }
            this._recomputeBeaconOptions();
            this._renderBeaconBrowser();
            if (fCallback) fCallback(pError, pData);
          });
        }
        setSourceEntity(pEntityName) {
          this.pict.AppData.Mapper.SourceEntity = pEntityName;
          let tmpEntity = this._findEntity(this.pict.AppData.Mapper.SourceEntities, pEntityName);
          this.pict.AppData.Mapper.SourceFields = this._extractFields(tmpEntity);
          this._recomputeBeaconOptions();
          this._renderBeaconBrowser();
          this._renderFieldMapper();
        }
        setTargetEntity(pEntityName) {
          this.pict.AppData.Mapper.TargetEntity = pEntityName;
          let tmpEntity = this._findEntity(this.pict.AppData.Mapper.TargetEntities, pEntityName);
          this.pict.AppData.Mapper.TargetFields = this._extractFields(tmpEntity);
          this._recomputeBeaconOptions();
          this._renderBeaconBrowser();
          this._renderFieldMapper();
        }

        // ── Mappings ────────────────────────────────────────────

        selectSourceField(pFieldName) {
          let tmpCurrent = this.pict.AppData.Mapper.SelectedSourceField;
          this.pict.AppData.Mapper.SelectedSourceField = tmpCurrent === pFieldName ? '' : pFieldName;
          this._renderFieldMapper();
        }
        addMapping(pSource, pTarget) {
          if (!pSource || !pTarget) {
            return;
          }
          let tmpMappings = this.pict.AppData.Mapper.Mappings || [];
          tmpMappings = tmpMappings.filter(pM => pM.Target !== pTarget);
          tmpMappings.push({
            Source: pSource,
            Target: pTarget
          });
          this.pict.AppData.Mapper.Mappings = tmpMappings;
          this.pict.AppData.Mapper.SelectedSourceField = '';
          this._regenerateJSON();
          this._renderFieldMapper();
        }
        removeMapping(pIndex) {
          let tmpMappings = this.pict.AppData.Mapper.Mappings || [];
          tmpMappings.splice(pIndex, 1);
          this.pict.AppData.Mapper.Mappings = tmpMappings;
          this._regenerateJSON();
          this._renderFieldMapper();
        }
        clearMappings() {
          this.pict.AppData.Mapper.Mappings = [];
          this.pict.AppData.Mapper.SelectedSourceField = '';
          this._regenerateJSON();
          this._renderFieldMapper();
        }

        // ── Saved MappingConfigs (CRUD against our own SQLite) ──

        loadSavedMappings(fCallback) {
          this._apiCall('GET', '/mapper/mappings', null, (pError, pData) => {
            if (!pError && pData) {
              this.pict.AppData.Mapper.SavedMappings = pData.Mappings || [];
            }
            this._renderMappingList();
            if (fCallback) fCallback(pError, pData);
          });
        }
        saveMapping(fCallback) {
          let tmpState = this.pict.AppData.Mapper;
          let tmpConfig = this._buildMappingConfiguration();
          let tmpBody = {
            Name: tmpState.TargetEntity ? `${tmpState.SourceEntity || 'source'} → ${tmpState.TargetEntity}` : 'Untitled Mapping',
            Description: '',
            SourceBeaconName: tmpState.SourceBeaconName,
            SourceConnectionHash: tmpState.SourceConnectionHash,
            SourceEntity: tmpState.SourceEntity,
            TargetBeaconName: tmpState.TargetBeaconName,
            TargetConnectionHash: tmpState.TargetConnectionHash,
            TargetEntity: tmpState.TargetEntity,
            MappingConfiguration: tmpConfig,
            FlowDiagramState: {}
          };
          this._apiCall('POST', '/mapper/mappings', tmpBody, (pError, pData) => {
            if (!pError && pData && pData.Success) {
              this.pict.AppData.Mapper.StatusMessage = 'Mapping saved.';
              this.loadSavedMappings();
            } else {
              this.pict.AppData.Mapper.StatusMessage = 'Save failed.';
            }
            this._renderLayout();
            if (fCallback) fCallback(pError, pData);
          });
        }
        deleteSavedMapping(pID, fCallback) {
          this._apiCall('DELETE', `/mapper/mapping/${pID}`, null, (pError, pData) => {
            if (!pError) {
              this.loadSavedMappings();
            }
            if (fCallback) fCallback(pError, pData);
          });
        }
        loadSavedMapping(pID, fCallback) {
          this._apiCall('GET', `/mapper/mapping/${pID}`, null, (pError, pData) => {
            if (!pError && pData && pData.Mapping) {
              this._applySavedMapping(pData.Mapping);
            }
            if (fCallback) fCallback(pError, pData);
          });
        }
        _applySavedMapping(pRecord) {
          let tmpState = this.pict.AppData.Mapper;
          tmpState.SourceBeaconName = pRecord.SourceBeaconName || '';
          tmpState.SourceConnectionHash = pRecord.SourceConnectionHash || '';
          tmpState.SourceEntity = pRecord.SourceEntity || '';
          tmpState.TargetBeaconName = pRecord.TargetBeaconName || '';
          tmpState.TargetConnectionHash = pRecord.TargetConnectionHash || '';
          tmpState.TargetEntity = pRecord.TargetEntity || '';
          let tmpConfig = {};
          try {
            tmpConfig = JSON.parse(pRecord.MappingConfiguration || '{}');
          } catch (e) {/* ignore */}
          tmpState.Mappings = this._mappingsFromConfig(tmpConfig);
          tmpState.JSONText = JSON.stringify(tmpConfig, null, '\t');
          tmpState.StatusMessage = `Loaded "${pRecord.Name}".`;
          tmpState.ActivePanel = 'mapper';

          // If source/target fields aren't loaded, derive placeholders from mappings
          if (tmpState.SourceFields.length === 0) {
            let tmpSet = {};
            tmpState.Mappings.forEach(pM => {
              if (pM.Source) tmpSet[pM.Source] = true;
            });
            tmpState.SourceFields = Object.keys(tmpSet).map(pN => ({
              Name: pN,
              Type: ''
            }));
          }
          if (tmpState.TargetFields.length === 0) {
            let tmpSet = {};
            tmpState.Mappings.forEach(pM => {
              if (pM.Target) tmpSet[pM.Target] = true;
            });
            tmpState.TargetFields = Object.keys(tmpSet).map(pN => ({
              Name: pN,
              Type: ''
            }));
          }
          this._recomputeBeaconOptions();
          this._renderLayout();
          this._renderBeaconBrowser();
          this._renderFieldMapper();
          this._renderJSONEditor();
        }

        // ── JSON editor sync ────────────────────────────────────

        applyJSONText(pText) {
          let tmpParsed;
          try {
            tmpParsed = JSON.parse(pText);
          } catch (e) {
            this.pict.AppData.Mapper.StatusMessage = `Invalid JSON: ${e.message}`;
            this._renderLayout();
            return false;
          }
          if (!tmpParsed || !tmpParsed.Mappings) {
            this.pict.AppData.Mapper.StatusMessage = 'JSON must contain a "Mappings" object.';
            this._renderLayout();
            return false;
          }
          this.pict.AppData.Mapper.JSONText = JSON.stringify(tmpParsed, null, '\t');
          this.pict.AppData.Mapper.Mappings = this._mappingsFromConfig(tmpParsed);
          if (tmpParsed.Entity) {
            this.pict.AppData.Mapper.TargetEntity = tmpParsed.Entity;
          }
          if (tmpParsed._meta) {
            if (tmpParsed._meta.SourceBeacon) this.pict.AppData.Mapper.SourceBeaconName = tmpParsed._meta.SourceBeacon;
            if (tmpParsed._meta.SourceConnectionHash) this.pict.AppData.Mapper.SourceConnectionHash = tmpParsed._meta.SourceConnectionHash;
            if (tmpParsed._meta.TargetBeacon) this.pict.AppData.Mapper.TargetBeaconName = tmpParsed._meta.TargetBeacon;
            if (tmpParsed._meta.TargetConnectionHash) this.pict.AppData.Mapper.TargetConnectionHash = tmpParsed._meta.TargetConnectionHash;
          }
          this.pict.AppData.Mapper.StatusMessage = `Imported ${this.pict.AppData.Mapper.Mappings.length} mappings.`;
          this._renderLayout();
          this._renderBeaconBrowser();
          this._renderFieldMapper();
          return true;
        }

        // ── Helpers ─────────────────────────────────────────────

        _buildMappingConfiguration() {
          let tmpState = this.pict.AppData.Mapper;
          let tmpMappings = {};
          (tmpState.Mappings || []).forEach(pM => {
            tmpMappings[pM.Target] = '{~D:Record.' + pM.Source + '~}';
          });
          let tmpEntity = tmpState.TargetEntity || 'TargetEntity';
          return {
            Entity: tmpEntity,
            GUIDTemplate: '',
            GUIDName: 'GUID' + tmpEntity,
            Mappings: tmpMappings,
            Solvers: [],
            _meta: {
              SourceBeacon: tmpState.SourceBeaconName,
              SourceConnectionHash: tmpState.SourceConnectionHash,
              SourceEntity: tmpState.SourceEntity,
              TargetBeacon: tmpState.TargetBeaconName,
              TargetConnectionHash: tmpState.TargetConnectionHash
            }
          };
        }
        _mappingsFromConfig(pConfig) {
          let tmpMappings = [];
          let tmpSource = pConfig && pConfig.Mappings ? pConfig.Mappings : {};
          let tmpKeys = Object.keys(tmpSource);
          for (let i = 0; i < tmpKeys.length; i++) {
            let tmpTarget = tmpKeys[i];
            let tmpExpr = tmpSource[tmpTarget];
            let tmpMatch = typeof tmpExpr === 'string' ? tmpExpr.match(/^\{~D:Record\.(\w+)~\}$/) : null;
            tmpMappings.push({
              Source: tmpMatch ? tmpMatch[1] : String(tmpExpr),
              Target: tmpTarget
            });
          }
          return tmpMappings;
        }
        _regenerateJSON() {
          this.pict.AppData.Mapper.JSONText = JSON.stringify(this._buildMappingConfiguration(), null, '\t');
        }
        _slugify(pValue) {
          return String(pValue || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        }
        _findConnection(pConnections, pID) {
          let tmpList = pConnections || [];
          for (let i = 0; i < tmpList.length; i++) {
            if (String(tmpList[i].IDBeaconConnection) === String(pID)) return tmpList[i];
          }
          return null;
        }
        _findEntity(pEntities, pName) {
          let tmpList = pEntities || [];
          for (let i = 0; i < tmpList.length; i++) {
            if (tmpList[i].TableName === pName) return tmpList[i];
          }
          return null;
        }
        _extractFields(pEntity) {
          if (!pEntity) return [];
          let tmpCols = pEntity.Columns || [];
          let tmpFields = [];
          for (let i = 0; i < tmpCols.length; i++) {
            tmpFields.push({
              Name: tmpCols[i].Name || tmpCols[i].Column,
              Type: tmpCols[i].NativeType || tmpCols[i].MeadowType || ''
            });
          }
          return tmpFields;
        }
        _recomputeBeaconOptions() {
          let tmpState = this.pict.AppData.Mapper;
          let tmpBeacons = tmpState.Beacons || [];
          tmpState.SourceBeacons = tmpBeacons.map(pB => ({
            Name: pB.Name,
            BeaconID: pB.BeaconID,
            SelectedAttr: pB.Name === tmpState.SourceBeaconName ? 'selected' : ''
          }));
          tmpState.TargetBeacons = tmpBeacons.map(pB => ({
            Name: pB.Name,
            BeaconID: pB.BeaconID,
            SelectedAttr: pB.Name === tmpState.TargetBeaconName ? 'selected' : ''
          }));
          tmpState.SourceConnectionsForTemplate = (tmpState.SourceConnections || []).map(pC => ({
            IDBeaconConnection: pC.IDBeaconConnection,
            Name: pC.Name,
            Type: pC.Type,
            SelectedAttr: String(pC.IDBeaconConnection) === String(tmpState.SourceConnectionID) ? 'selected' : ''
          }));
          tmpState.TargetConnectionsForTemplate = (tmpState.TargetConnections || []).map(pC => ({
            IDBeaconConnection: pC.IDBeaconConnection,
            Name: pC.Name,
            Type: pC.Type,
            SelectedAttr: String(pC.IDBeaconConnection) === String(tmpState.TargetConnectionID) ? 'selected' : ''
          }));
          tmpState.SourceEntitiesForTemplate = (tmpState.SourceEntities || []).map(pE => ({
            TableName: pE.TableName,
            ColumnCount: (pE.Columns || []).length,
            SelectedAttr: pE.TableName === tmpState.SourceEntity ? 'selected' : ''
          }));
          tmpState.TargetEntitiesForTemplate = (tmpState.TargetEntities || []).map(pE => ({
            TableName: pE.TableName,
            ColumnCount: (pE.Columns || []).length,
            SelectedAttr: pE.TableName === tmpState.TargetEntity ? 'selected' : ''
          }));
        }
        _renderLayout() {
          if (this.pict.views['Mapper-Layout']) this.pict.views['Mapper-Layout'].render();
        }
        _renderBeaconBrowser() {
          if (this.pict.views['Mapper-BeaconBrowser']) this.pict.views['Mapper-BeaconBrowser'].render();
        }
        _renderFieldMapper() {
          if (this.pict.views['Mapper-FieldMapper']) this.pict.views['Mapper-FieldMapper'].render();
        }
        _renderMappingList() {
          if (this.pict.views['Mapper-MappingList']) this.pict.views['Mapper-MappingList'].render();
        }
        _renderJSONEditor() {
          if (this.pict.views['Mapper-JSONEditor']) this.pict.views['Mapper-JSONEditor'].render();
        }
      }
      module.exports = MapperAPIProvider;
      module.exports.default_configuration = {
        ProviderIdentifier: 'MapperAPI',
        AutoInitialize: true,
        AutoRender: false
      };
    }, {
      "pict-view": 6
    }],
    10: [function (require, module, exports) {
      /**
       * DataMapper BeaconBrowser View
       *
       * Two side-by-side selector rows (source + target): beacon → connection →
       * entity dropdowns. Dispatches happen via the MapperAPI provider; this view
       * just reads state and emits click/change events.
       */
      const libPictView = require('pict-view');
      const _ViewConfiguration = {
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
        Templates: [{
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
        }, {
          Hash: 'Mapper-BeaconBrowser-BeaconOpt',
          Template: /*html*/`<option value="{~D:Record.Name~}" {~D:Record.SelectedAttr~}>{~D:Record.Name~}</option>`
        }, {
          Hash: 'Mapper-BeaconBrowser-ConnOpt',
          Template: /*html*/`<option value="{~D:Record.IDBeaconConnection~}" {~D:Record.SelectedAttr~}>#{~D:Record.IDBeaconConnection~} {~D:Record.Name~} ({~D:Record.Type~})</option>`
        }, {
          Hash: 'Mapper-BeaconBrowser-EntityOpt',
          Template: /*html*/`<option value="{~D:Record.TableName~}" {~D:Record.SelectedAttr~}>{~D:Record.TableName~} ({~D:Record.ColumnCount~} cols)</option>`
        }],
        Renderables: [{
          RenderableHash: 'Mapper-BeaconBrowser-Content',
          TemplateHash: 'Mapper-BeaconBrowser-Template',
          ContentDestinationAddress: '#DataMapper-BeaconBrowser-Slot',
          RenderMethod: 'replace'
        }]
      };
      class PictViewMapperBeaconBrowser extends libPictView {
        constructor(pFable, pOptions, pServiceHash) {
          super(pFable, pOptions, pServiceHash);
        }
        onAfterRender(pRenderable, pRenderDestinationAddress, pRecord, pContent) {
          let tmpProvider = this.pict.providers.MapperAPI;
          let fBindChange = (pSelector, fHandler) => {
            let tmpEl = this.pict.ContentAssignment.getElement(pSelector);
            if (tmpEl && tmpEl.length) tmpEl[0].addEventListener('change', fHandler);
          };
          fBindChange('#DataMapper-Source-Beacon', pEvent => {
            tmpProvider.loadSourceConnections(pEvent.target.value);
          });
          fBindChange('#DataMapper-Source-Connection', pEvent => {
            let tmpID = parseInt(pEvent.target.value, 10);
            if (tmpID) {
              tmpProvider.introspectSource(tmpID);
            }
          });
          fBindChange('#DataMapper-Source-Entity', pEvent => {
            tmpProvider.setSourceEntity(pEvent.target.value);
          });
          fBindChange('#DataMapper-Target-Beacon', pEvent => {
            tmpProvider.loadTargetConnections(pEvent.target.value);
          });
          fBindChange('#DataMapper-Target-Connection', pEvent => {
            let tmpID = parseInt(pEvent.target.value, 10);
            if (tmpID) {
              tmpProvider.introspectTarget(tmpID);
            }
          });
          fBindChange('#DataMapper-Target-Entity', pEvent => {
            tmpProvider.setTargetEntity(pEvent.target.value);
          });
          return super.onAfterRender(pRenderable, pRenderDestinationAddress, pRecord, pContent);
        }
      }
      module.exports = PictViewMapperBeaconBrowser;
      module.exports.default_configuration = _ViewConfiguration;
    }, {
      "pict-view": 6
    }],
    11: [function (require, module, exports) {
      /**
       * DataMapper FieldMapper View
       *
       * Three-column layout: source fields | mappings | target fields. Click a
       * source field, then click a target field, to create a mapping. Drag+drop
       * from source to target works too.
       */
      const libPictView = require('pict-view');
      const _ViewConfiguration = {
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
        Templates: [{
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
        }, {
          Hash: 'Mapper-FieldMapper-SourceField',
          Template: /*html*/`<div class="fm-field {~D:Record.SelectedClass~}" data-source-field="{~D:Record.Name~}" draggable="true"><span>{~D:Record.Name~}</span><span class="fm-type">{~D:Record.Type~}</span></div>`
        }, {
          Hash: 'Mapper-FieldMapper-TargetField',
          Template: /*html*/`<div class="fm-field {~D:Record.MappedClass~}" data-target-field="{~D:Record.Name~}"><span>{~D:Record.Name~}</span><span class="fm-type">{~D:Record.Type~}</span></div>`
        }, {
          Hash: 'Mapper-FieldMapper-MappingRow',
          Template: /*html*/`<div class="fm-mapping-row"><span>{~D:Record.Source~}</span><span class="fm-arrow">&rarr;</span><span>{~D:Record.Target~}</span><button class="fm-remove" data-remove-mapping="{~D:Record.Index~}">&times;</button></div>`
        }],
        Renderables: [{
          RenderableHash: 'Mapper-FieldMapper-Content',
          TemplateHash: 'Mapper-FieldMapper-Template',
          ContentDestinationAddress: '#DataMapper-FieldMapper-Slot',
          RenderMethod: 'replace'
        }]
      };
      class PictViewMapperFieldMapper extends libPictView {
        constructor(pFable, pOptions, pServiceHash) {
          super(pFable, pOptions, pServiceHash);
        }
        onBeforeRender(pRenderable) {
          let tmpState = this.pict.AppData.Mapper;
          let tmpSelected = tmpState.SelectedSourceField || '';
          let tmpSources = tmpState.SourceFields || [];
          tmpState.SourceFieldCount = `${tmpSources.length} field${tmpSources.length === 1 ? '' : 's'}`;
          tmpState.SourceFieldsForTemplate = tmpSources.map(pF => ({
            Name: pF.Name,
            Type: pF.Type || '',
            SelectedClass: pF.Name === tmpSelected ? 'selected' : ''
          }));
          tmpState.SourceEmptyHTML = tmpSources.length === 0 ? '<div class="fm-empty">Pick a source beacon, connection, and entity above.</div>' : '';
          let tmpMappings = tmpState.Mappings || [];
          let tmpMappedTargets = {};
          for (let i = 0; i < tmpMappings.length; i++) {
            tmpMappedTargets[tmpMappings[i].Target] = true;
          }
          let tmpTargets = tmpState.TargetFields || [];
          tmpState.TargetFieldCount = `${tmpTargets.length} field${tmpTargets.length === 1 ? '' : 's'}`;
          tmpState.TargetFieldsForTemplate = tmpTargets.map(pF => ({
            Name: pF.Name,
            Type: pF.Type || '',
            MappedClass: tmpMappedTargets[pF.Name] ? 'mapped' : ''
          }));
          tmpState.TargetEmptyHTML = tmpTargets.length === 0 ? '<div class="fm-empty">Pick a target beacon, connection, and entity above.</div>' : '';
          tmpState.MappingCount = `${tmpMappings.length} mapping${tmpMappings.length === 1 ? '' : 's'}`;
          tmpState.MappingsForTemplate = tmpMappings.map((pM, pIdx) => ({
            Source: pM.Source,
            Target: pM.Target,
            Index: pIdx
          }));
          if (tmpSelected) {
            tmpState.DropZoneClass = 'active';
            tmpState.DropZoneText = `Source "${tmpSelected}" selected — click a target field to map it`;
          } else {
            tmpState.DropZoneClass = '';
            tmpState.DropZoneText = 'Click a source field, then click a target field';
          }
          return super.onBeforeRender(pRenderable);
        }
        onAfterRender(pRenderable, pRenderDestinationAddress, pRecord, pContent) {
          let tmpProvider = this.pict.providers.MapperAPI;
          let tmpSelf = this;
          let tmpSourceFields = this.pict.ContentAssignment.getElement('[data-source-field]');
          if (tmpSourceFields && tmpSourceFields.length) {
            for (let i = 0; i < tmpSourceFields.length; i++) {
              let tmpEl = tmpSourceFields[i];
              tmpEl.addEventListener('click', pEvent => {
                tmpProvider.selectSourceField(pEvent.currentTarget.getAttribute('data-source-field'));
              });
              tmpEl.addEventListener('dragstart', pEvent => {
                let tmpName = pEvent.currentTarget.getAttribute('data-source-field');
                pEvent.dataTransfer.setData('text/plain', tmpName);
                tmpProvider.pict.AppData.Mapper.SelectedSourceField = tmpName;
              });
            }
          }
          let tmpTargetFields = this.pict.ContentAssignment.getElement('[data-target-field]');
          if (tmpTargetFields && tmpTargetFields.length) {
            for (let i = 0; i < tmpTargetFields.length; i++) {
              let tmpEl = tmpTargetFields[i];
              tmpEl.addEventListener('click', pEvent => {
                let tmpTarget = pEvent.currentTarget.getAttribute('data-target-field');
                let tmpSource = tmpSelf.pict.AppData.Mapper.SelectedSourceField;
                if (tmpSource && tmpTarget) {
                  tmpProvider.addMapping(tmpSource, tmpTarget);
                }
              });
              tmpEl.addEventListener('dragover', pEvent => pEvent.preventDefault());
              tmpEl.addEventListener('drop', pEvent => {
                pEvent.preventDefault();
                let tmpSource = pEvent.dataTransfer.getData('text/plain');
                let tmpTarget = pEvent.currentTarget.getAttribute('data-target-field');
                if (tmpSource && tmpTarget) {
                  tmpProvider.addMapping(tmpSource, tmpTarget);
                }
              });
            }
          }
          let tmpRemoveBtns = this.pict.ContentAssignment.getElement('[data-remove-mapping]');
          if (tmpRemoveBtns && tmpRemoveBtns.length) {
            for (let i = 0; i < tmpRemoveBtns.length; i++) {
              tmpRemoveBtns[i].addEventListener('click', pEvent => {
                let tmpIndex = parseInt(pEvent.currentTarget.getAttribute('data-remove-mapping'), 10);
                tmpProvider.removeMapping(tmpIndex);
              });
            }
          }
          let tmpSaveBtn = this.pict.ContentAssignment.getElement('#DataMapper-Save-Mapping');
          if (tmpSaveBtn && tmpSaveBtn.length) {
            tmpSaveBtn[0].addEventListener('click', () => tmpProvider.saveMapping());
          }
          let tmpClearBtn = this.pict.ContentAssignment.getElement('#DataMapper-Clear-Mappings');
          if (tmpClearBtn && tmpClearBtn.length) {
            tmpClearBtn[0].addEventListener('click', () => tmpProvider.clearMappings());
          }
          return super.onAfterRender(pRenderable, pRenderDestinationAddress, pRecord, pContent);
        }
      }
      module.exports = PictViewMapperFieldMapper;
      module.exports.default_configuration = _ViewConfiguration;
    }, {
      "pict-view": 6
    }],
    12: [function (require, module, exports) {
      /**
       * DataMapper JSONEditor View
       *
       * Dual-mode config editor: shows the generated MappingConfiguration JSON
       * and supports import via paste, file picker, or drag-drop onto the textarea.
       */
      const libPictView = require('pict-view');
      const _ViewConfiguration = {
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
        Templates: [{
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
        }],
        Renderables: [{
          RenderableHash: 'Mapper-JSONEditor-Content',
          TemplateHash: 'Mapper-JSONEditor-Template',
          ContentDestinationAddress: '#DataMapper-JSONEditor-Slot',
          RenderMethod: 'replace'
        }]
      };
      class PictViewMapperJSONEditor extends libPictView {
        constructor(pFable, pOptions, pServiceHash) {
          super(pFable, pOptions, pServiceHash);
        }
        onAfterRender(pRenderable, pRenderDestinationAddress, pRecord, pContent) {
          let tmpProvider = this.pict.providers.MapperAPI;
          let tmpSelf = this;
          let tmpTextareaEl = this.pict.ContentAssignment.getElement('#DataMapper-JSON-Text');
          let tmpTextarea = tmpTextareaEl && tmpTextareaEl.length ? tmpTextareaEl[0] : null;
          let tmpRegenBtn = this.pict.ContentAssignment.getElement('#DataMapper-JSON-Regenerate');
          if (tmpRegenBtn && tmpRegenBtn.length) {
            tmpRegenBtn[0].addEventListener('click', () => {
              tmpProvider._regenerateJSON();
              if (tmpTextarea) tmpTextarea.value = tmpSelf.pict.AppData.Mapper.JSONText;
            });
          }
          let tmpApplyBtn = this.pict.ContentAssignment.getElement('#DataMapper-JSON-Apply');
          if (tmpApplyBtn && tmpApplyBtn.length) {
            tmpApplyBtn[0].addEventListener('click', () => {
              if (tmpTextarea) tmpProvider.applyJSONText(tmpTextarea.value);
            });
          }
          let tmpCopyBtn = this.pict.ContentAssignment.getElement('#DataMapper-JSON-Copy');
          if (tmpCopyBtn && tmpCopyBtn.length) {
            tmpCopyBtn[0].addEventListener('click', () => {
              if (!tmpTextarea) return;
              try {
                navigator.clipboard.writeText(tmpTextarea.value);
                tmpSelf.pict.AppData.Mapper.StatusMessage = 'JSON copied.';
              } catch (e) {
                tmpTextarea.select();
                document.execCommand('copy');
                tmpSelf.pict.AppData.Mapper.StatusMessage = 'JSON copied.';
              }
              if (tmpSelf.pict.views['Mapper-Layout']) tmpSelf.pict.views['Mapper-Layout'].render();
            });
          }
          let tmpUploadBtn = this.pict.ContentAssignment.getElement('#DataMapper-JSON-Upload');
          let tmpFileInputEl = this.pict.ContentAssignment.getElement('#DataMapper-JSON-File');
          let tmpFileInput = tmpFileInputEl && tmpFileInputEl.length ? tmpFileInputEl[0] : null;
          if (tmpUploadBtn && tmpUploadBtn.length && tmpFileInput) {
            tmpUploadBtn[0].addEventListener('click', () => tmpFileInput.click());
            tmpFileInput.addEventListener('change', pEvent => {
              let tmpFile = pEvent.target.files[0];
              if (!tmpFile) return;
              let tmpReader = new FileReader();
              tmpReader.onload = pLoadEvent => {
                if (tmpTextarea) tmpTextarea.value = pLoadEvent.target.result;
                tmpProvider.applyJSONText(pLoadEvent.target.result);
              };
              tmpReader.readAsText(tmpFile);
              pEvent.target.value = '';
            });
          }
          if (tmpTextarea) {
            tmpTextarea.addEventListener('dragover', pEvent => {
              pEvent.preventDefault();
              tmpTextarea.classList.add('drop-active');
            });
            tmpTextarea.addEventListener('dragleave', () => tmpTextarea.classList.remove('drop-active'));
            tmpTextarea.addEventListener('drop', pEvent => {
              pEvent.preventDefault();
              tmpTextarea.classList.remove('drop-active');
              let tmpFiles = pEvent.dataTransfer.files;
              if (tmpFiles && tmpFiles.length > 0) {
                let tmpReader = new FileReader();
                tmpReader.onload = pLoadEvent => {
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
    }, {
      "pict-view": 6
    }],
    13: [function (require, module, exports) {
      /**
       * DataMapper Layout View
       *
       * Shell: header with Ultravisor controls + status, tab bar that switches
       * between mapper / saved-mappings / JSON panels, and mount-point divs
       * for the sub-views.
       */
      const libPictView = require('pict-view');
      const _PanelDefs = [{
        Key: 'mapper',
        Label: 'Visual Mapper'
      }, {
        Key: 'mappings',
        Label: 'Saved Mappings'
      }, {
        Key: 'json',
        Label: 'JSON Config'
      }];
      const _ViewConfiguration = {
        ViewIdentifier: 'Mapper-Layout',
        DefaultRenderable: 'Mapper-Layout-Shell',
        DefaultDestinationAddress: '#DataMapper-App',
        AutoRender: false,
        CSS: /*css*/`
			body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: #0d1117; color: #e6edf3; font-size: 14px; }
			.mapper-app { display: flex; flex-direction: column; height: 100vh; }
			.mapper-header { background: #161b22; border-bottom: 1px solid #30363d; padding: 10px 20px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
			.mapper-header h1 { margin: 0; font-size: 16px; font-weight: 600; color: #ff9800; }
			.mapper-uv-controls { display: flex; gap: 6px; align-items: center; flex: 1; }
			.mapper-uv-controls input { background: #0d1117; border: 1px solid #30363d; color: #e6edf3; padding: 4px 8px; border-radius: 4px; font-size: 13px; min-width: 220px; }
			.mapper-uv-controls button { background: #238636; color: #fff; border: 0; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-size: 13px; }
			.mapper-uv-controls button.secondary { background: #30363d; }
			.mapper-uv-controls button:hover { filter: brightness(1.15); }
			.mapper-badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
			.badge-neutral { background: #30363d; color: #8b949e; }
			.badge-success { background: #238636; color: #fff; }
			.badge-error { background: #da3633; color: #fff; }
			.badge-info { background: #1f6feb; color: #fff; }
			.mapper-status { color: #8b949e; font-size: 12px; }
			.mapper-tabs { background: #161b22; border-bottom: 1px solid #30363d; padding: 0 20px; display: flex; gap: 2px; }
			.mapper-tab { background: transparent; border: 0; color: #8b949e; padding: 10px 16px; cursor: pointer; font-size: 13px; border-bottom: 2px solid transparent; }
			.mapper-tab.active { color: #ff9800; border-bottom-color: #ff9800; }
			.mapper-tab:hover { color: #e6edf3; }
			.mapper-main { flex: 1; overflow: auto; padding: 16px 20px; }
			.mapper-panel { display: none; }
			.mapper-panel.active { display: block; }
			.mapper-section-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #8b949e; margin: 0 0 8px 0; }
			select, input[type="text"], textarea { background: #0d1117; border: 1px solid #30363d; color: #e6edf3; padding: 4px 8px; border-radius: 4px; font-size: 13px; }
			select { min-width: 160px; }
			button.btn { background: #30363d; color: #e6edf3; border: 0; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-size: 13px; }
			button.btn.primary { background: #ff9800; color: #0d1117; }
			button.btn.danger { background: #da3633; color: #fff; }
			button.btn:hover { filter: brightness(1.15); }
			button.btn:disabled { opacity: 0.5; cursor: not-allowed; }
		`,
        Templates: [{
          Hash: 'Mapper-Layout-Shell',
          Template: /*html*/`
<div class="mapper-app">
	<header class="mapper-header">
		<h1>Retold Data Mapper</h1>
		<div class="mapper-uv-controls">
			<label style="color:#8b949e; font-size:12px;">Ultravisor</label>
			<input type="text" id="DataMapper-UV-URL" placeholder="http://localhost:8422" value="{~D:AppData.Mapper.UltravisorURL~}">
			<button id="DataMapper-UV-Connect">Connect</button>
			<button id="DataMapper-UV-Disconnect" class="secondary">Disconnect</button>
			<span class="mapper-badge {~D:AppData.Mapper.UltravisorBadgeClass~}">{~D:AppData.Mapper.UltravisorStatusLabel~}</span>
		</div>
		<div class="mapper-status">{~D:AppData.Mapper.StatusMessage~}</div>
	</header>
	<nav class="mapper-tabs">{~TS:Mapper-Layout-Tab:AppData.Mapper.Tabs~}</nav>
	<main class="mapper-main">
		<div id="DataMapper-Panel-mapper" class="mapper-panel">
			<div id="DataMapper-BeaconBrowser-Slot"></div>
			<div id="DataMapper-FieldMapper-Slot"></div>
		</div>
		<div id="DataMapper-Panel-mappings" class="mapper-panel">
			<div id="DataMapper-MappingList-Slot"></div>
		</div>
		<div id="DataMapper-Panel-json" class="mapper-panel">
			<div id="DataMapper-JSONEditor-Slot"></div>
		</div>
	</main>
</div>`
        }, {
          Hash: 'Mapper-Layout-Tab',
          Template: /*html*/`<button class="mapper-tab {~D:Record.ActiveClass~}" data-mapper-panel="{~D:Record.Key~}">{~D:Record.Label~}</button>`
        }],
        Renderables: [{
          RenderableHash: 'Mapper-Layout-Shell',
          TemplateHash: 'Mapper-Layout-Shell',
          ContentDestinationAddress: '#DataMapper-App',
          RenderMethod: 'replace'
        }]
      };
      class PictViewMapperLayout extends libPictView {
        constructor(pFable, pOptions, pServiceHash) {
          super(pFable, pOptions, pServiceHash);
        }
        onBeforeRender(pRenderable) {
          let tmpActive = this.pict.AppData.Mapper && this.pict.AppData.Mapper.ActivePanel || 'mapper';
          this.pict.AppData.Mapper.Tabs = _PanelDefs.map(pP => ({
            Key: pP.Key,
            Label: pP.Label,
            ActiveClass: pP.Key === tmpActive ? 'active' : ''
          }));
          return super.onBeforeRender(pRenderable);
        }
        onAfterRender(pRenderable, pRenderDestinationAddress, pRecord, pContent) {
          let tmpSelf = this;
          let tmpConnectBtn = this.pict.ContentAssignment.getElement('#DataMapper-UV-Connect');
          if (tmpConnectBtn && tmpConnectBtn.length) {
            tmpConnectBtn[0].addEventListener('click', () => {
              let tmpURLInput = tmpSelf.pict.ContentAssignment.getElement('#DataMapper-UV-URL');
              let tmpURL = tmpURLInput && tmpURLInput.length ? tmpURLInput[0].value : '';
              if (!tmpURL) {
                return;
              }
              tmpSelf.pict.providers.MapperAPI.connectUltravisor(tmpURL);
            });
          }
          let tmpDisconnectBtn = this.pict.ContentAssignment.getElement('#DataMapper-UV-Disconnect');
          if (tmpDisconnectBtn && tmpDisconnectBtn.length) {
            tmpDisconnectBtn[0].addEventListener('click', () => {
              tmpSelf.pict.providers.MapperAPI.disconnectUltravisor();
            });
          }
          let tmpTabButtons = this.pict.ContentAssignment.getElement('[data-mapper-panel]');
          if (tmpTabButtons && tmpTabButtons.length) {
            for (let i = 0; i < tmpTabButtons.length; i++) {
              tmpTabButtons[i].addEventListener('click', pEvent => {
                let tmpKey = pEvent.currentTarget.getAttribute('data-mapper-panel');
                if (tmpKey) tmpSelf.setActivePanel(tmpKey);
              });
            }
          }

          // Render sub-views into their mount slots.
          if (this.pict.views['Mapper-BeaconBrowser']) this.pict.views['Mapper-BeaconBrowser'].render();
          if (this.pict.views['Mapper-FieldMapper']) this.pict.views['Mapper-FieldMapper'].render();
          if (this.pict.views['Mapper-MappingList']) this.pict.views['Mapper-MappingList'].render();
          if (this.pict.views['Mapper-JSONEditor']) this.pict.views['Mapper-JSONEditor'].render();
          this._applyActivePanelVisibility();
          if (this.pict.CSSMap && typeof this.pict.CSSMap.injectCSS === 'function') {
            this.pict.CSSMap.injectCSS();
          }
          return super.onAfterRender(pRenderable, pRenderDestinationAddress, pRecord, pContent);
        }
        setActivePanel(pKey) {
          this.pict.AppData.Mapper.ActivePanel = pKey;
          this._applyActivePanelVisibility();
          let tmpTabButtons = this.pict.ContentAssignment.getElement('[data-mapper-panel]');
          if (tmpTabButtons && tmpTabButtons.length) {
            for (let i = 0; i < tmpTabButtons.length; i++) {
              let tmpName = tmpTabButtons[i].getAttribute('data-mapper-panel');
              if (tmpName === pKey) tmpTabButtons[i].classList.add('active');else tmpTabButtons[i].classList.remove('active');
            }
          }
        }
        _applyActivePanelVisibility() {
          let tmpActive = this.pict.AppData.Mapper.ActivePanel || 'mapper';
          for (let i = 0; i < _PanelDefs.length; i++) {
            let tmpKey = _PanelDefs[i].Key;
            let tmpPanelEl = this.pict.ContentAssignment.getElement(`#DataMapper-Panel-${tmpKey}`);
            if (tmpPanelEl && tmpPanelEl.length) {
              tmpPanelEl[0].classList.toggle('active', tmpKey === tmpActive);
            }
          }
        }
      }
      module.exports = PictViewMapperLayout;
      module.exports.default_configuration = _ViewConfiguration;
    }, {
      "pict-view": 6
    }],
    14: [function (require, module, exports) {
      /**
       * DataMapper MappingList View
       *
       * Lists MappingConfig rows persisted in the mapper's internal SQLite. Click
       * to load into the editor; × to delete.
       */
      const libPictView = require('pict-view');
      const _ViewConfiguration = {
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
        Templates: [{
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
        }, {
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
        }],
        Renderables: [{
          RenderableHash: 'Mapper-MappingList-Content',
          TemplateHash: 'Mapper-MappingList-Template',
          ContentDestinationAddress: '#DataMapper-MappingList-Slot',
          RenderMethod: 'replace'
        }]
      };
      class PictViewMapperMappingList extends libPictView {
        constructor(pFable, pOptions, pServiceHash) {
          super(pFable, pOptions, pServiceHash);
        }
        onBeforeRender(pRenderable) {
          let tmpState = this.pict.AppData.Mapper;
          let tmpSaved = tmpState.SavedMappings || [];
          tmpState.SavedMappingsForTemplate = tmpSaved.map(pM => {
            let tmpParts = [];
            if (pM.SourceBeaconName) tmpParts.push(`${pM.SourceBeaconName}${pM.SourceEntity ? '/' + pM.SourceEntity : ''}`);
            if (pM.TargetBeaconName) tmpParts.push(`${pM.TargetBeaconName}${pM.TargetEntity ? '/' + pM.TargetEntity : ''}`);
            return {
              IDMappingConfig: pM.IDMappingConfig,
              Name: pM.Name || '(unnamed)',
              Subline: tmpParts.join(' → ')
            };
          });
          tmpState.SavedMappingsEmptyHTML = tmpSaved.length === 0 ? '<div class="ml-empty">No saved mappings yet. Save one from the Visual Mapper tab.</div>' : '';
          return super.onBeforeRender(pRenderable);
        }
        onAfterRender(pRenderable, pRenderDestinationAddress, pRecord, pContent) {
          let tmpProvider = this.pict.providers.MapperAPI;
          let tmpRefreshBtn = this.pict.ContentAssignment.getElement('#DataMapper-Refresh-Mappings');
          if (tmpRefreshBtn && tmpRefreshBtn.length) {
            tmpRefreshBtn[0].addEventListener('click', () => tmpProvider.loadSavedMappings());
          }
          let tmpLoadBtns = this.pict.ContentAssignment.getElement('[data-load-mapping]');
          if (tmpLoadBtns && tmpLoadBtns.length) {
            for (let i = 0; i < tmpLoadBtns.length; i++) {
              tmpLoadBtns[i].addEventListener('click', pEvent => {
                let tmpID = parseInt(pEvent.currentTarget.getAttribute('data-load-mapping'), 10);
                if (tmpID) tmpProvider.loadSavedMapping(tmpID);
              });
            }
          }
          let tmpDeleteBtns = this.pict.ContentAssignment.getElement('[data-delete-mapping]');
          if (tmpDeleteBtns && tmpDeleteBtns.length) {
            for (let i = 0; i < tmpDeleteBtns.length; i++) {
              tmpDeleteBtns[i].addEventListener('click', pEvent => {
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
    }, {
      "pict-view": 6
    }]
  }, {}, [8])(8);
});
//# sourceMappingURL=retold-data-mapper.js.map
