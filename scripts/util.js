//Written by Ron Tiong, ISOM Department, University of Auckland Business School 2016.

/*jshint
    browser: true, devel: true
*/


function Util() {}


Util.getTimestamp = function getTimestamp() {
    var d = new Date();
    return d.getFullYear() + '-' + zeroPad((d.getMonth() + 1).toString()) + '-' + zeroPad(d.getDate().toString()) + '-' + zeroPad(d.getHours().toString()) + zeroPad(d.getMinutes().toString()) + zeroPad(d.getSeconds().toString());
};


function zeroPad(x) {
    return (x[1] ? x : '0' + x[0]);
}


Util.utcToExcel = function utcToExcel(timestamp) {
    var d;

    if (!timestamp) {
        return '';
    }

    timestamp = timestamp.replace('Z', '.000Z');

    //original timestamp is in GMT, but it looks like JavaScript
    //converts it to local time (based on Chrome, presumably)
    var dt = new Date(timestamp);

    if (typeof dt !== 'object') {
        return '';
    }

    d = dt.getFullYear() + '-' +
        pad(1 + dt.getMonth()) + '-' +
        pad(dt.getDate()) + ' ' +
        pad(dt.getHours()) + ':' +
        pad(dt.getMinutes()) + ':' +
        pad(dt.getSeconds());

    return d;
};

function pad(n) {
    return n < 10 ? '0' + n : n;
}

Util.hasTeacherEnrolment = function hasTeacherEnrolment(json) {
    var teacher = false;

    //Check if role is "TeacherEnrollment" or "TaEnrollment" or "DesignerEnrollment"
    json.forEach(function (enrolment) {
        if (enrolment.role == "TeacherEnrollment" || enrolment.role == "TaEnrollment" || enrolment.role == "DesignerEnrollment") {
            teacher = true;
            return; //i.e. break out of loop
        }
    });

    return teacher;
};

Util.nextURL = function nextURL(linkText) {
    var url = null;
    if (linkText) {
        var links = linkText.split(',');
        var nextRegEx = new RegExp('^<(.*)>; rel="next"$');
        for (var i = 0; i < links.length; i++) {
            var matches = nextRegEx.exec(links[i]);
            if (matches) {
                url = matches[1];
            }
        }
    }
    return url;
};

Util.errorHandler = function errorHandler(e) {
    console.log(e);
    alert(e.message);
};

//from https://github.com/SheetJS/js-xlsx/blob/master/README.md
Util.s2ab = function s2ab(s) {
    var buf = new ArrayBuffer(s.length);
    var view = new Uint8Array(buf);
    for (var i = 0; i != s.length; ++i) view[i] = s.charCodeAt(i) & 0xFF;
    return buf;
};
