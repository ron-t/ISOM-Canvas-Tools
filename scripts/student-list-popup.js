// Written by Ron Tiong, ISOM Department, University of Auckland Business School 2016.
// Only the first 100 group categories (aka group sets) will be displayed.

/* globals
    chrome, ExcelBuilder, ga, Util, XMLHttpRequest, Blob, URL
*/

let EXPORT_FORMAT
let COURSE_ID = -1
let HOST = ''
let pending = {} // key-value store for recursive calls and per-category global variables

chrome.storage.sync.get({
  exportFormat: 'xlsx' // default to xlsx format
}, setExportFormatFromSettings)

function setExportFormatFromSettings (items) {
  EXPORT_FORMAT = items.exportFormat
}

document.addEventListener('DOMContentLoaded', function () {
  getCurrentTabUrl(populateCourseLists)
})

// function from https://developer.chrome.com/extensions/getstarted
function getCurrentTabUrl (callback) {
  let queryInfo = {
    active: true,
    windowId: chrome.windows.WINDOW_ID_CURRENT
  }

  chrome.tabs.query(queryInfo, function (tabs) {
    let tab = tabs[0]
    let url = tab.url

    callback(url)
  })
}

function populateCourseLists (url) {
  // find course number and host from current url

  let roleXhr
  let RegExResults

  RegExResults = /(https:\/\/.+)\/courses\/(\d+)(\/.+)?/.exec(url)

  try {
    HOST = RegExResults[1]
    COURSE_ID = RegExResults[2]
  } catch (ex) {
    console.log(ex.message)
    return
  }

  if (COURSE_ID > 0) {
    renderStatus('status', 'Course found on current page. Id: ' + COURSE_ID)

    // check user role for course
    roleXhr = new XMLHttpRequest()
    roleXhr.onreadystatechange = proceedIfStaff

    roleXhr.open('GET', HOST + '/api/v1/courses/' + COURSE_ID + '/enrollments?state[]=active&user_id=self', true) // async
    roleXhr.send()
  }
}

function proceedIfStaff () {
  // 'this' is the roleXhr
  if (this.readyState === 4 && this.status === 200) {
    let json = /(?:while\(1\);)?(.+)/.exec(this.responseText)
    json = JSON.parse(json[1])

    if (Util.hasTeacherEnrolment(json)) {
      let enrolmentHeading
      let enrolmentReportButton
      let sectionListHeading
      let sectionsXhr
      let groupCatXhr
      let groupCatListHeading

      // unhide enrolment report heading
      enrolmentHeading = document.getElementById('enrolmentHeading')
      enrolmentHeading.hidden = null

      enrolmentReportButton = document.getElementById('enrolmentReport')
      enrolmentReportButton.addEventListener('click', trackButtonClick)
      enrolmentReportButton.addEventListener('click', enrolmentReportButtonClick)

      // unhide section list heading
      sectionListHeading = document.getElementById('sectionListHeading')
      sectionListHeading.hidden = null

      // unhide group category list heading
      groupCatListHeading = document.getElementById('groupCatListHeading')
      groupCatListHeading.hidden = null

      // Get sections (only up to 100?)
      sectionsXhr = new XMLHttpRequest()
      sectionsXhr.onreadystatechange = appendSections

      sectionsXhr.open('GET', HOST + '/api/v1/courses/' + COURSE_ID + '/sections?include[]=students&include[]=email&per_page=100', true) // async
      sectionsXhr.send()

      // Get group categories (only up to 100?)
      groupCatXhr = new XMLHttpRequest()
      groupCatXhr.onreadystatechange = appendGroupCategories

      groupCatXhr.open('GET', HOST + '/api/v1/courses/' + COURSE_ID + '/group_categories?per_page=100', true) // async
      groupCatXhr.send()
    } // else if not teaching staff do nothing
  }
}

function enrolmentReportButtonClick () {
  let label
  let url
  let state
  let enrolmentsList = []

  // show 'Processing...' label
  label = document.getElementById('enrolmentReportProcessingLabel')
  label.hidden = null

  pending['enrolment'] = 0

  // get active enrolments first
  state = 'active'
  url = HOST + '/api/v1/courses/' + COURSE_ID + '/enrollments?type[]=StudentEnrollment&state[]=' + state + '&per_page=100'
  getEnrolments(url, state, enrolmentsList)
}

function getEnrolments (url, state, enrolmentsList) {
  try {
    pending['enrolment'] += 1

    let enrolmentXhr = new XMLHttpRequest()
    enrolmentXhr.onreadystatechange = function processGroupResponse () {
      // 'this' is enrolmentXhr
      if (this.readyState === 4 && this.status === 200) {
        let enrolmentJson = /(?:while\(1\);)?(.+)/.exec(this.responseText)
        let enrolments = JSON.parse(enrolmentJson[1])

        if (enrolments.length > 0) {
          Array.prototype.push.apply(enrolmentsList, enrolments)
        }

        let next = Util.nextURL(this.getResponseHeader('Link'))
        if (next) {
          getEnrolments(next, state, enrolmentsList)
        }

        pending['enrolment'] -= 1

        if (pending['enrolment'] <= 0) {
          if (state === 'active') {
            // after active enrolments are complete, get deleted enrolments
            state = 'deleted'
            url = HOST + '/api/v1/courses/' + COURSE_ID + '/enrollments?type[]=StudentEnrollment&state[]=' + state + '&per_page=100'
            getEnrolments(url, state, enrolmentsList)
          } else { // state is deleted (and active enrolments have already been retrieved)
            processEnrolments(enrolmentsList)
          }
        }
      }
    }

    enrolmentXhr.open('GET', url, true) // async call
    enrolmentXhr.send()
  } catch (e) {
    Util.errorHandler(e)
  }
}

function processEnrolments (enrolmentsList) {
  let dataRows
  let sectionXhr
  let json
  let sections
  let sectionsLookup = {}

  // get section names synchronously
  sectionXhr = new XMLHttpRequest()
  sectionXhr.open('GET', HOST + '/api/v1/courses/' + COURSE_ID + '/sections?per_page=100', false)
  sectionXhr.send()

  json = /(?:while\(1\);)?(.+)/.exec(sectionXhr.responseText)
  sections = JSON.parse(json[1])

  sections.forEach(function (s) {
    sectionsLookup[s.id] = s
  })

  if (EXPORT_FORMAT === 'tsv') {
    dataRows = [['state', 'created_at', 'updated_at', 'canvas user id', 'student id', 'student name', 'student sortable name', 'student username', 'student e-mail', 'section id', 'section name'].join('\t')]
  } else if (EXPORT_FORMAT === 'xlsx') {
    dataRows = [['state', 'created_at', 'updated_at', 'canvas user id', 'student id', 'student name', 'student sortable name', 'student username', 'student e-mail', 'section id', 'section name']]
  }

  enrolmentsList.forEach(function (enrolment) {
    if (EXPORT_FORMAT === 'tsv') {
      dataRows.push([[
        enrolment.enrollment_state,
        Util.utcToExcel(enrolment.created_at),
        Util.utcToExcel(enrolment.updated_at),
        enrolment.user.id,
        enrolment.user.sis_user_id,
        enrolment.user.name,
        enrolment.user.sortable_name,
        enrolment.user.login_id,
        enrolment.user.email,
        enrolment.course_section_id,
        sectionsLookup[enrolment.course_section_id].name
      ].join('\t')])
    } else if (EXPORT_FORMAT === 'xlsx') {
      dataRows.push([
        enrolment.enrollment_state,
        Util.utcToExcel(enrolment.created_at),
        Util.utcToExcel(enrolment.updated_at),
        enrolment.user.id,
        enrolment.user.sis_user_id,
        enrolment.user.name,
        enrolment.user.sortable_name,
        enrolment.user.login_id,
        enrolment.user.email,
        enrolment.course_section_id,
        sectionsLookup[enrolment.course_section_id].name
      ])
    }
  })

  exportData(dataRows, Util.getTimestamp() + '-enrolment-report')

  let label = document.getElementById('enrolmentReportProcessingLabel')
  label.hidden = 'hidden'
}

function appendSections () {
  // 'this' is the sectionsXhr

  if (this.readyState === 4 && this.status === 200) {
    let json = /(?:while\(1\);)?(.+)/.exec(this.responseText)
    json = JSON.parse(json[1])

    generateSectionList(json)
  }
}

function generateSectionList (sections) {
  let allSectionsData
  let allButton
  let sectionListHeading = document.getElementById('sectionListHeading')

  // sort alphabetically ascending by name
  sections.sort(function (a, b) {
    return (a.name > b.name) - (a.name < b.name)
  })

  if (EXPORT_FORMAT === 'tsv') {
    allSectionsData = [['section name', 'student name', 'student sortable name', 'student id', 'student username', 'student e-mail'].join('\t')]
  } else if (EXPORT_FORMAT === 'xlsx') {
    allSectionsData = [['section name', 'student name', 'student sortable name', 'student id', 'student username', 'student e-mail']]
  }

  sections.forEach(function (section) {
    if (section.students.length > 0) {
      let newbutton = document.createElement('button')
      newbutton.textContent = section.name
      newbutton.addEventListener('click', trackButtonClick)
      newbutton.addEventListener('click', function () {
        let dataRows = createSectionData(section)
        exportData(dataRows, section.name)
      })

      sectionListHeading.appendChild(newbutton)

      // accumulate array for allSectionsData
      allSectionsData = allSectionsData.concat(createSectionDataSpecifyHeader(section, false))
    }
  })

  // add button for all sections
  allButton = document.createElement('button')
  allButton.textContent = 'ALL-SECTIONS'
  allButton.addEventListener('click', trackButtonClick)
  allButton.addEventListener('click', function () {
    exportData(allSectionsData, 'ALL-SECTIONS')
  })
  sectionListHeading.appendChild(allButton)

  renderStatus('sectionListStatus', 'Sections loaded')
}

// function from https://developer.chrome.com/extensions/getstarted
function renderStatus (id, statusText) {
  document.getElementById(id).textContent = statusText
}

function createSectionDataSpecifyHeader (section, withHeader) {
  let dataRows = []

  if (withHeader) {
    if (EXPORT_FORMAT === 'tsv') {
      dataRows = [['section name', 'student name', 'student sortable name', 'student id', 'student username', 'student e-mail'].join('\t')]
    } else if (EXPORT_FORMAT === 'xlsx') {
      dataRows = [['section name', 'student name', 'student sortable name', 'student id', 'student username', 'student e-mail']]
    }
  }

  section.students.forEach(function (student) {
    if (EXPORT_FORMAT === 'tsv') {
      dataRows.push([[section.name, student.name, student.sortable_name, student.sis_user_id, student.sis_login_id, student.email].join('\t')])
    } else if (EXPORT_FORMAT === 'xlsx') {
      dataRows.push([section.name, student.name, student.sortable_name, student.sis_user_id, student.sis_login_id, student.email])
    }
  })

  return dataRows
}

function createSectionData (section) {
  return createSectionDataSpecifyHeader(section, true)
}

function appendGroupCategories () {
  // 'this' is the groupCatXhr
  if (this.readyState === 4 && this.status === 200) {
    let json = /(?:while\(1\);)?(.+)/.exec(this.responseText)

    json = JSON.parse(json[1])

    json.sort(function (a, b) {
      return (a.name > b.name) - (a.name < b.name)
    })

    json.forEach(function (groupCat) {
      let label = document.createElement('span')
      label.className = 'label'
      label.appendChild(document.createTextNode('Processing ' + groupCat.name + ' ...'))
      label.style.display = 'none'
      label.id = groupCat.id + '_' + groupCat.name

      pending['label' + groupCat.id] = label.id

      let newbutton = document.createElement('button')
      newbutton.textContent = groupCat.name
      newbutton.addEventListener('click', trackButtonClick)
      newbutton.addEventListener('click', function () {
        generateGroupList(groupCat)
      })

      let div = document.createElement('div')

      div.appendChild(newbutton)
      div.appendChild(label)

      let groupCatListHeading = document.getElementById('groupCatListHeading')
      groupCatListHeading.appendChild(div)
    })

    renderStatus('groupCatListStatus', 'Group Categories loaded')
  }
}

function generateGroupList (groupCat) {
  // get all groups
  let label = document.getElementById(pending['label' + groupCat.id])
  label.style.display = 'inline'

  let url = HOST + '/api/v1/group_categories/' + groupCat.id + '/groups?per_page=100'
  pending['group' + groupCat.id] = 0
  pending['name' + groupCat.id] = groupCat.name

  getGroups(url, groupCat, [])
}

function getGroups (url, groupCat, groupsList) {
  try {
    pending['group' + groupCat.id] += 1

    let groupXhr = new XMLHttpRequest()
    groupXhr.onreadystatechange = function processGroupResponse () {
      // 'this' is groupXhr
      if (this.readyState === 4 && this.status === 200) {
        let groupsJson = /(?:while\(1\);)?(.+)/.exec(this.responseText)
        let groups = JSON.parse(groupsJson[1])

        if (groups.length > 0) {
          Array.prototype.push.apply(groupsList, groups)
        }

        let next = Util.nextURL(this.getResponseHeader('Link'))
        if (next) {
          getGroups(next, groupCat, groupsList)
        }

        pending['group' + groupCat.id] -= 1
        if (pending['group' + groupCat.id] <= 0) {
          processGroups(groupCat, groupsList)
        }
      }
    }

    groupXhr.open('GET', url, true) // async call
    groupXhr.send()
  } catch (e) {
    Util.errorHandler(e)
  }
}

function processGroups (groupCat, groupsList) {
  // go through each group in groupsList and get members

  let label
  let dataRows
  let url

  if (groupsList.length > 0) {
    if (EXPORT_FORMAT === 'tsv') {
      dataRows = [['group name', 'student name', 'student sortable name', 'student id', 'student username', 'student e-mail'].join('\t')]
    } else if (EXPORT_FORMAT === 'xlsx') {
      dataRows = [['group name', 'student name', 'student sortable name', 'student id', 'student username', 'student e-mail']]
    }

    pending['member' + groupCat.id] = 0

    groupsList.forEach(function (group) {
      url = HOST + '/api/v1/groups/' + group.id + '/users?include[]=email&per_page=100'

      getMembers(url, group, dataRows)
    })
  } else {
    label = document.getElementById(pending['label' + groupCat.id])
    label.textContent = '(Contains no groups)'
  }
}

function getMembers (url, group, dataRows) {
  try {
    pending['member' + group.group_category_id] += 1

    let memberXhr = new XMLHttpRequest()
    memberXhr.onreadystatechange = function processGroupResponse () {
      // 'this' is memberXhr
      if (this.readyState === 4 && this.status === 200) {
        let membersJson = /(?:while\(1\);)?(.+)/.exec(this.responseText)
        let members = JSON.parse(membersJson[1])

        if (members.length > 0) {
          members.forEach(function (member) {
            if (EXPORT_FORMAT === 'tsv') {
              // dataRows.push([[group.name, member.name, member.sortable_name, member.sis_user_id, member.login_id, member.login_id + '@aucklanduni.ac.nz'].join('\t')])
              dataRows.push([[group.name, member.name, member.sortable_name, member.sis_user_id, member.login_id, member.email].join('\t')])
            // logid_id previously called sis_logid_id
            } else if (EXPORT_FORMAT === 'xlsx') {
              // dataRows.push([group.name, member.name, member.sortable_name, member.sis_user_id, member.login_id, member.login_id + '@aucklanduni.ac.nz'])
              dataRows.push([group.name, member.name, member.sortable_name, member.sis_user_id, member.login_id, member.email])
            // logid_id previously called sis_logid_id
            }
          })
        }

        let next = Util.nextURL(this.getResponseHeader('Link'))
        if (next) {
          getMembers(next, group, dataRows)
        }

        pending['member' + group.group_category_id] -= 1
        if (pending['member' + group.group_category_id] <= 0) {
          exportData(dataRows, pending['name' + group.group_category_id])

          // remove 'processing...' label
          let label = document.getElementById(pending['label' + group.group_category_id])
          label.style.display = 'none'
        }
      }
    }

    memberXhr.open('GET', url, true) // async call
    memberXhr.send()
  } catch (e) {
    Util.errorHandler(e)
  }
}

function exportData (dataRows, filename) {
  if (EXPORT_FORMAT === 'tsv') {
    let tsvString = dataRows.join('\r\n')

    let blob = new Blob([tsvString], {
      type: 'text/plain'
    })

    let href = URL.createObjectURL(blob)

    downloadReport(href, filename)
  } else if (EXPORT_FORMAT === 'xlsx') {
    let workbook = ExcelBuilder.Builder.createWorkbook()
    let list = workbook.createWorksheet({
      name: 'list'
    })

    list.setData(dataRows)
    workbook.addWorksheet(list)

    ExcelBuilder.Builder.createFile(workbook, { type: 'blob' }).then(function (data) {
      let href = URL.createObjectURL(data)

      downloadReport(href, filename)
    })
  }
}

function downloadReport (href, filename) {
  let a = document.createElement('a')
  a.href = href
  a.target = '_blank'
  a.download = filename + '.' + EXPORT_FORMAT

  document.body.appendChild(a)
  a.click()
}

/** Google analytics code start **/
/* eslint-disable */
(function (i, s, o, g, r, a, m) {
  'use strict'
  i['GoogleAnalyticsObject'] = r
  i[r] = i[r] || function () {
    (i[r].q = i[r].q || []).push(arguments)
  }, i[r].l = 1 * new Date()
  a = s.createElement(o),
  m = s.getElementsByTagName(o)[0]
  a.async = 1
  a.src = g
  m.parentNode.insertBefore(a, m)
})(window, document, 'script', 'https://www.google-analytics.com/analytics.js', 'ga')
/* eslint-enable */

ga('create', 'UA-72936301-1', 'auto')
ga('set', 'checkProtocolTask', null) // Disable file protocol checking.
ga('send', 'pageview', '/studentListPopup.html')

function trackButtonClick (e) {
  ga('send', 'event', 'StudentList', 'Download', e.target.innerText)
}
/** Google analytics code end **/
