function registerRules() {
    chrome.storage.sync.get(
        {
            webworkHostname: ""
        },
        function (items) {
            if (items.webworkHostname.length > 0) {
                var webworkRule = {
                    id: "webworkRule",
                    conditions: [new chrome.declarativeContent.PageStateMatcher({
                        pageUrl: { hostEquals: items.webworkHostname, schemes: ["https", "http"] },
                    })],
                    actions: [
                        new chrome.declarativeContent.RequestContentScript({
                            "css": [
                                "katex/katex.css",
                                "math-view.css"
                            ],
                            "js": [
                                "asciimath-based/ASCIIMathTeXImg.js",
                                "katex/katex.min.js",
                                "math-view.js",
                                "extUtils.js",
                                "content.js",
                            ]
                        })
                    ]
                };

                chrome.declarativeContent.onPageChanged.removeRules(undefined, function () {
                    chrome.declarativeContent.onPageChanged.addRules([webworkRule]);
                });
            }
        });
}