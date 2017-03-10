// Written by Ron Tiong, ISOM Department, University of Auckland Business School 2016.

/* globals
    MutationObserver
*/

const targets = document.getElementsByClassName('due_date_display')
const DoW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const observer = new MutationObserver(function (mutations) {
  mutations.forEach(function (mutation) {
    observer.disconnect()

    const date = new Date(Date.parse(mutation.target.textContent + ' ' + (new Date()).getFullYear()))
    const dayOfWeek = DoW[date.getDay()]

    mutation.target.textContent = dayOfWeek + ' ' + mutation.target.textContent
  })
})

for (let i = 0; i < targets.length; i++) {
  observer.observe(targets[i], {
    attributes: false,
    childList: true,
    characterData: false
  })
}
