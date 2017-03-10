// Written by Ron Tiong, ISOM Department, University of Auckland Business School 2016.

/* globals
    alert
*/

function Util () {}

Util.getTimestamp = () => {
  const d = new Date()
  return d.getFullYear() + '-' + zeroPad((d.getMonth() + 1).toString()) + '-' + zeroPad(d.getDate().toString()) + '-' + zeroPad(d.getHours().toString()) + zeroPad(d.getMinutes().toString()) + zeroPad(d.getSeconds().toString())
}

function zeroPad (x) {
  return (x[1] ? x : '0' + x[0])
}

Util.utcToExcel = (timestamp) => {
  if (!timestamp) {
    return ''
  }

  timestamp = timestamp.replace('Z', '.000Z')

  // original timestamp is in GMT, but it looks like JavaScript
  // converts it to local time (based on Chrome, presumably)
  const dt = new Date(timestamp)

  if (typeof dt !== 'object') {
    return ''
  }

  const d = dt.getFullYear() + '-' +
  pad(1 + dt.getMonth()) + '-' +
  pad(dt.getDate()) + ' ' +
  pad(dt.getHours()) + ':' +
  pad(dt.getMinutes()) + ':' +
  pad(dt.getSeconds())

  return d
}

function pad (n) {
  return n < 10 ? '0' + n : n
}

Util.hasTeacherEnrolment = (json) => {
  let teacher = false

  // Check if any roles have the type "TeacherEnrollment"
  json.forEach(function (enrolment) {
    if (enrolment.type === 'TeacherEnrollment') {
      teacher = true
      return // i.e. break out of loop
    }
  })

  return teacher
}

Util.nextURL = (linkText) => {
  let url = null
  if (linkText) {
    const links = linkText.split(',')
    const nextRegEx = new RegExp('^<(.*)>; rel="next"$')
    for (let i = 0; i < links.length; i++) {
      const matches = nextRegEx.exec(links[i])
      if (matches) {
        url = matches[1]
      }
    }
  }
  return url
}

Util.errorHandler = (e) => {
  console.log(e)
  alert(e.message)
}

// from https://github.com/SheetJS/js-xlsx/blob/master/README.md
Util.s2ab = (s) => {
  const buf = new ArrayBuffer(s.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i !== s.length; ++i) view[i] = s.charCodeAt(i) & 0xFF
  return buf
}
