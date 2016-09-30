//Written by Ron Tiong, ISOM Department, University of Auckland Business School 2016.

/*jshint
    browser: true, devel: true
*/

/*globals
    chrome
*/

document.addEventListener('DOMContentLoaded', restore_options);

document.getElementById('save').addEventListener('click', save_options);


function save_options() {
    var exportFormat;

    exportFormat = document.querySelector('input[name="exportFormat"]:checked').value;
    //console.log('export format: ' + exportFormat);
    
    chrome.storage.sync.set({
        "exportFormat": exportFormat
    }, function () {
        // Update status to let user know options were saved.
        var status = document.getElementById('status');
        status.textContent = 'Options saved.';
        setTimeout(function () {
            status.textContent = '';
        }, 750);
    });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
    chrome.storage.sync.get({
        "exportFormat": "xlsx"
    }, function (items) {
        document.getElementById('format-' + items.exportFormat).checked = 'checked';
    });
}