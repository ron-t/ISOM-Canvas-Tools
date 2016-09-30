//Written by Ron Tiong, ISOM Department, University of Auckland Business School 2016.

/*jslint
    browser: true, devel: true
*/

var targets = document.getElementsByClassName('due_date_display');
var DoW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {

        observer.disconnect();
        
        var date = new Date(Date.parse(mutation.target.textContent + ' ' + (new Date()).getFullYear()));
        var dayOfWeek = DoW[date.getDay()];
        
        mutation.target.textContent = dayOfWeek + ' ' + mutation.target.textContent;
    });
});

for (var i = 0; i < targets.length; i++) {
    observer.observe(targets[i], {
        attributes: false,
        childList: true,
        characterData: false
    });
}
