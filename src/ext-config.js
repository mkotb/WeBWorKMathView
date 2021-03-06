console.log("[WeBWorK MathView] ext-config.js");

var ExtConfig = new function () {

    var HOSTNAME_WOLFRAM_ALPHA = "www.wolframalpha.com";

    /**
     * @typedef {Object} ExtConfig.Storage.Data
     * @property {boolean} autoDetectWW
     * @property {string[]} wwHosts
     * @property {boolean} enableWolfram
     */

    this.Storage = new function () {
        /**
         * Constructor for an object to represent our stored data
         * @param {boolean} autoDetectWW if true, the scripts will automatically run on WeBWorK sites
         * @param {string[]} wwHosts a list of hosts (e.g. "webwork.university.ca") on which to run the scripts,
         *                             ignored if autoDetectWW is true
         * @param {boolean} enableWolfram if true, the scripts will run on WolframAlpha
         * 
         * @constructor
         */
        this.Data = function (autoDetectWW, wwHosts, enableWolfram) {
            this.autoDetectWW = autoDetectWW;
            this.wwHosts = wwHosts;
            this.enableWolfram = enableWolfram;
        }

        /**
         * Persists data in this extension's local storage
         * @param {Object} data the data to persist
         * @param {setCallback} callback a function to call after the data is persisted
         */
        this.setData = function (data, callback) {
            this.cachedData = data;
            chrome.storage.sync.set(data, callback);
        };

        /**
         * Retrieves data from this extension's local storage
         * @param {Function} callback a function to call with the retrieved data
         * @param {boolean} cached Whether a cached version is preferable
         */
        this.getData = function (callback, cached) {
            if (cached && this.cachedData) {
                callback(this.cachedData);
                return;
            }

            chrome.storage.sync.get(new this.Data(false, [], false), callback);
        };

        /**
         * Deletes the provided keys from this extension's local storage
         * @param {string[]} keys keys to be deleted
         * @param {Function} callback a function to call after the data is deleted
         */
        this.delete = function (keys, callback) {
            chrome.storage.sync.remove(keys, callback);
        }
    };

    // retrieve the original data to be cached
    this.Storage.getData((data) => {
        this.Storage.cachedData = data;
    });

    this.Permissions = new function () {

        var PERMISSION_ALL_URLS = "<all_urls>";

        /**
         * Converts a hostname string into a URL pattern string representing all URLs with that hostname
         * @param {string} hostname the hostname
         */
        var getUrlPattern = function (hostname) {
            return "*://" + hostname + "/*";
        }

        var generatePermissions = function (data) {
            if (data.autoDetectWW) {
                return { origins: [PERMISSION_ALL_URLS] };
            }
            else {
                var urlPatterns = data.wwHosts.map(getUrlPattern);

                if (data.enableWolfram) {
                    urlPatterns.push(getUrlPattern(HOSTNAME_WOLFRAM_ALPHA));
                }

                return { origins: urlPatterns };
            }
        }
        
        this.updateCachedPermissions = async function() {
            browser.permissions.getAll().then((permissions) => {
                this.cachedPermissions = permissions;
            });
        }

        /**
         * Requests extension permissions necessary for the provided configuration data
         * @param {ExtConfig.Storage.Data} data the configuration data
         * @param {Function} callback a function to call after the permission has been denied or granted.
         *                            Argument to the function indicates if the permissions were successfully updated
         */
        this.updatePermissions = async function (data) {
            // Generate new origins
            var newPermissions = generatePermissions(data);
            var newOrigins = newPermissions.origins;
            let oldPermissions = this.cachedPermissions;

            // Retrieve old origins
            var oldOrigins = oldPermissions.origins;

            // Compare new and old origins
            var originsToRemove = [];
            var originsToRequest = [];
            
            for(var i = 0; i < oldOrigins.length; i++) {
                var origin = oldOrigins[i];
                if(!newOrigins.includes(origin)) {
                    originsToRemove.push(origin);
                }
            }

            for(var i = 0; i < newOrigins.length; i++) {
                var origin = newOrigins[i];
                if(!oldOrigins.includes(origin)) {
                    originsToRequest.push(origin);
                }
            }

            var success = false;

            if (originsToRequest.length > 0) {
                success = await browser.permissions.request({
                    origins: originsToRequest
                });
            }

            if (originsToRemove.length > 0) {
                success &= await browser.permissions.remove({
                    origins: originsToRemove
                });
            }

            await this.updateCachedPermissions();
            return success;
        };
    };

    this.Permissions.updateCachedPermissions();

    this.Events = new function () {

        var CONTENT_WEBWORK_JS = "content-webwork.js";
        var CONTENT_WOLFRAM_JS = "content-wolfram.js";

        /**
         * Core CSS files that are not specific to the extension's operation on any particular domain
         */
        var CORE_CSS = [
        ];

        /**
         * Core JS files that are not specific to the extension's operation on any particular domain
         */
        var CORE_JS = [
            "math-view-utils.js",
            "math-view-ext.js"
        ];

        var createJSArray = function (contentJSFile) {
            var allJS = CORE_JS.slice();
            allJS.push(contentJSFile);
            return allJS;
        };

        var createBrowserJSArray = function (contentJSFile) {
            return createJSArray(contentJSFile).map(function (file) {
                return {file};
            });
        };

        var createBrowserCSSArray = function() {
            return CORE_CSS.map(function(file) {
                return {file};
            });
        }

        /**
         * Creates a RequestContentScript object containing the CSS and JS files required for operation
         * @param {string} contentJSFile the filename of the content script to use
         */
        var createRequestContentScript = function (contentJSFile) {
            return new chrome.declarativeContent.RequestContentScript({
                "css": CORE_CSS,
                "js": createJSArray(contentJSFile)
            });
        };

        /**
         * Generates a set of rules describing when to run our scripts based on the provided configuration data
         * @param {ExtConfig.Storage.Data} data the configuration data
         * @returns an array of JSON objects representing the onPageChanged rules to register based on
         * the provided arguments
         */
        var generateOnPageChangedRules = function (data) {
            var rules = [];

            if (data.autoDetectWW) {
                rules.push({
                    id: "wwAutoDetect",
                    conditions: [new chrome.declarativeContent.PageStateMatcher({
                        pageUrl: { schemes: ["https", "http"] },
                        css: ["input.codeshard"]
                    })],
                    actions: [
                        createRequestContentScript(CONTENT_WEBWORK_JS)
                    ]
                });
            }
            else {
                for (let i = 0; i < data.wwHosts.length; i++) {
                    rules.push({
                        id: "wwDomain" + i,
                        conditions: [new chrome.declarativeContent.PageStateMatcher({
                            pageUrl: { hostEquals: data.wwHosts[i], schemes: ["https", "http"] },
                        })],
                        actions: [
                            createRequestContentScript(CONTENT_WEBWORK_JS)
                        ]
                    });
                }
            }

            if (data.enableWolfram) {
                rules.push({
                    id: "wolfram",
                    conditions: [new chrome.declarativeContent.PageStateMatcher({
                        pageUrl: { hostEquals: HOSTNAME_WOLFRAM_ALPHA, schemes: ["https", "http"] },
                    })],
                    actions: [
                        createRequestContentScript(CONTENT_WOLFRAM_JS)
                    ]
                });
            }

            return rules;
        };

        this.contentScripts = [];

        this.clearOldScripts = function() {
            for (const script of this.contentScripts) {
                script.unregister()
            }
        }

        this.registerContentScripts = function (data) {
            const contentScriptOpts = [];
            const css = createBrowserCSSArray();
            this.clearOldScripts()

            if (data.autoDetectWW) {
                contentScriptOpts.push({
                    matches: ['<all_urls>'],
                    js: createBrowserJSArray(CONTENT_WEBWORK_JS),
                    css
                })
            } else {
                contentScriptOpts.push({
                    matches: data.wwHosts.map((host) => `*://${host}/*`),
                    js: createBrowserJSArray(CONTENT_WEBWORK_JS),
                    css
                })
            }

            if (data.enableWolfram) {
                contentScriptOpts.push({
                    matches: [`*://${HOSTNAME_WOLFRAM_ALPHA}/*`],
                    js: createBrowserJSArray(CONTENT_WOLFRAM_JS),
                    css
                })
            }

            for (const scriptOpts of contentScriptOpts) {
                if (scriptOpts.matches.length == 0) {
                    continue
                }

                browser.contentScripts.register(scriptOpts)
                    .then((fulfilledContentScript) => this.contentScripts.push(fulfilledContentScript))
                    .catch((err) => {
                        console.error("Error registering content script with opts %o with error %o", scriptOpts, err)
                    })
            }
        }

        /**
         * Registers rules for the onPageChanged event to trigger our scripts according to the provided configuration data
         * @param {ExtConfig.Storage.Data} data the configuration data
         */
        this.registerOnPageChangedRules = function (data, remote) {
            if (!chrome.declarativeContent) {
                if (remote) {
                    browser.runtime.sendMessage({
                        type: 'cs-update',
                        data
                    });
                    return;
                }

                this.registerContentScripts(data);
                return;
            }

            var newRules = generateOnPageChangedRules(data);

            chrome.declarativeContent.onPageChanged.removeRules(undefined, function () {
                chrome.declarativeContent.onPageChanged.addRules(newRules);
            })
        };

    };

};