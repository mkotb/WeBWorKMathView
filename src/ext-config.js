var ExtConfig = new function () {

    /**
     * @typedef {Object} ExtConfig.Storage.Data
     * @property {boolean} autoDetectWW
     * @property {string[]} wwDomains
     * @property {boolean} enableWolfram
     */

    this.Storage = new function () {

        /**
         * Constructor for an object to represent our stored data
         * 
         * @param {boolean} autoDetectWW if true, the scripts will automatically run on WeBWorK sites
         * @param {string[]} wwDomains a list of domains (e.g. "webwork.university.ca") on which to run the scripts,
         *                             ignored if autoDetectWW is true
         * @param {boolean} enableWolfram if true, the scripts will run on WolframAlpha
         * 
         * @constructor
         */
        this.Data = function (autoDetectWW, wwDomains, enableWolfram) {
            this.autoDetectWW = autoDetectWW;
            this.wwDomains = wwDomains;
            this.enableWolfram = enableWolfram;
        }

        /**
         * Persists data in this extension's local storage
         * 
         * @param {ExtConfig.Storage.Data} data the data to persist
         * @param {setCallback} callback a function to call after the data is persisted
         */
        this.setData = function (data, callback) {
            chrome.storage.sync.set(data, callback);
        };

        /**
         * Retrieves data from this extension's local storage
         * @param {Function} callback a function to call with the retrieved data
         */
        this.getData = function (callback) {
            chrome.storage.sync.get(new this.Data(false, [], false), callback);
        };
    };

    this.Permissions = new function () {

        /**
         * Requests extension permissions necessary for the provided configuration data
         * @param {ExtConfig.Storage.Data} data configuration data
         */
        this.requestPermissions = function (data) {
            if (data.autoDetectWW) {
                // TODO Request all content permission
            }
            else {
                // TODO Request for all wwDomains
            }

            if(data.enableWolfram) {
                // TODO Request for wolfram
            }
        };

    };

    /**
     * Core CSS files that are not specific to the extension's operation an any particular domain
     */
    var coreCSS = [
        "katex/katex.css",
        "math-view.css"
    ];

    /**
     * Core JS files that are not specific to the extension's operation an any particular domain
     */
    var coreJS = [
        "asciimath-based/ASCIIMathTeXImg.js",
        "katex/katex.min.js",
        "math-view.js",
        "extUtils.js",
    ];

    /**
     * Creates a RequestContentScript object containing the CSS and JS files for operation on WeBWorK sites
     */
    var createWWRequestContentScript = function () {
        var allJS = coreJS.slice();
        allJS.push("content.js");

        return new chrome.declarativeContent.RequestContentScript({
            "css": coreCSS,
            "js": allJS
        });
    };

    /**
     * Generates a set of rules describing when to run our scripts based on the provided conditions
     * @param {boolean} autoDetectWW if true, the scripts will automatically run on WeBWorK sites
     * @param {string[]} wwDomains a list of domains (e.g. "webwork.university.ca") on which to run the scripts,
     *                             ignored if autoDetectWW is true
     * @param {boolean} enableWolfram if true, the scripts will run on WolframAlpha
     * @returns an array of JSON objects representing the onPageChanged rules to register based on
     * the provided arguments
     */
    this.generateRules = function (autoDetectWW, wwDomains, enableWolfram) {

        var rules = [];

        if (autoDetectWW) {
            rules.push({
                id: "wwAutoDetect",
                conditions: [new chrome.declarativeContent.PageStateMatcher({
                    pageUrl: { schemes: ["https", "http"] },
                    css: ["input.codeshard"]
                })],
                actions: [
                    createWWRequestContentScript()
                ]
            });
        }
        else {
            for (let i = 0; i < wwDomains.length; i++) {
                rules.push({
                    id: "wwDomain" + i,
                    conditions: [new chrome.declarativeContent.PageStateMatcher({
                        pageUrl: { hostEquals: wwDomains[i], schemes: ["https", "http"] },
                    })],
                    actions: [
                        createWWRequestContentScript()
                    ]
                });
            }
        }

        if (enableWolfram) {
            rules.push({
                id: "wolfram",
                conditions: [new chrome.declarativeContent.PageStateMatcher({
                    pageUrl: { hostEquals: "www.wolframalpha.com", schemes: ["https", "http"] },
                })],
                actions: [
                    createWWRequestContentScript() // TODO different content script
                ]
            });
        }

        return rules;
    };



};