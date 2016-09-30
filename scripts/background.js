//Written by Ron Tiong, ISOM Department, University of Auckland Business School 2016.

/* jshint
    browser: true, devel: true
*/

/* globals
    chrome
*/

var ruleUoaCanvas = {
    conditions: [
        new chrome.declarativeContent.PageStateMatcher({
            pageUrl: {
                hostEquals: 'canvas.auckland.ac.nz',
                schemes: ['https']
            }
        }),
        new chrome.declarativeContent.PageStateMatcher({
            pageUrl: {
                hostEquals: 'auckland.instructure.com',
                schemes: ['https']
            }
        }),
        new chrome.declarativeContent.PageStateMatcher({
            pageUrl: {
                hostEquals: 'auckland.test.instructure.com',
                schemes: ['https']
            }
        }),
        new chrome.declarativeContent.PageStateMatcher({
            pageUrl: {
                hostEquals: 'auckland.beta.instructure.com',
                schemes: ['https']
            }
        })
    ],
    actions: [new chrome.declarativeContent.ShowPageAction()]
};

chrome.runtime.onInstalled.addListener(function () {
    chrome.declarativeContent.onPageChanged.removeRules(undefined, function () {
        chrome.declarativeContent.onPageChanged.addRules([ruleUoaCanvas]);
    });
});

