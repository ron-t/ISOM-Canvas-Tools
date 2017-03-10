// Written by Ron Tiong, ISOM Department, University of Auckland Business School 2016.

/* globals
    chrome
*/

document.addEventListener('DOMContentLoaded', restoreOptions)

document.getElementById('save').addEventListener('click', saveOptions)

function saveOptions () {
  var exportFormat

  exportFormat = document.querySelector('input[name="exportFormat"]:checked').value
  // console.log('export format: ' + exportFormat)

  chrome.storage.sync.set({
    'exportFormat': exportFormat
  }, function () {
    // Update status to let user know options were saved.
    var status = document.getElementById('status')
    status.textContent = 'Options saved.'
    setTimeout(function () {
      status.textContent = ''
    }, 750)
  })
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restoreOptions () {
  chrome.storage.sync.get({
    'exportFormat': 'xlsx'
  }, function (items) {
    document.getElementById('format-' + items.exportFormat).checked = 'checked'
  })
}
