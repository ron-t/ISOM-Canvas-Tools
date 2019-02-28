// Written by Ron Tiong, ISOM Department, University of Auckland Business School 2016.
// Only the first 100 group categories (aka group sets) will be displayed.

/* globals
    chrome, ExcelBuilder, Util, XMLHttpRequest, Blob, URL
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

function getCurrentTabUrl (callback) {
  const queryInfo = {
    active: true,
    windowId: chrome.windows.WINDOW_ID_CURRENT
  }

  chrome.tabs.query(queryInfo, function (tabs) {
    const tab = tabs[0]
    const url = tab.url

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
  const enrolmentsList = []

  // show 'Processing...' label
  const label = document.getElementById('enrolmentReportProcessingLabel')
  label.hidden = null

  pending['enrolment'] = 0

  // get active enrolments first
  const state = 'active'
  const url = HOST + '/api/v1/courses/' + COURSE_ID + '/enrollments?type[]=StudentEnrollment&state[]=' + state + '&per_page=100'
  getEnrolments(url, state, enrolmentsList)
}

function getEnrolments (url, state, enrolmentsList) {
  try {
    pending['enrolment'] += 1

    let enrolmentXhr = new XMLHttpRequest()
    enrolmentXhr.onreadystatechange = function processGroupResponse () {
      // 'this' is enrolmentXhr
      if (this.readyState === 4 && this.status === 200) {
        const enrolmentJson = /(?:while\(1\);)?(.+)/.exec(this.responseText)
        const enrolments = JSON.parse(enrolmentJson[1])

        if (enrolments.length > 0) {
          Array.prototype.push.apply(enrolmentsList, enrolments)
        }

        const next = Util.nextURL(this.getResponseHeader('Link'))
        if (next) {
          getEnrolments(next, state, enrolmentsList)
        }

        pending['enrolment'] -= 1

        if (pending['enrolment'] <= 0) {
          if (state === 'active') {
            // after active enrolments are complete, get deleted enrolments
            const stateToGet = 'deleted'
            url = HOST + '/api/v1/courses/' + COURSE_ID + '/enrollments?type[]=StudentEnrollment&state[]=' + stateToGet + '&per_page=100'
            getEnrolments(url, stateToGet, enrolmentsList)
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
  const sectionsLookup = {}

  // get section names synchronously
  const sectionXhr = new XMLHttpRequest()
  sectionXhr.open('GET', HOST + '/api/v1/courses/' + COURSE_ID + '/sections?per_page=100', false)
  sectionXhr.send()

  const json = /(?:while\(1\);)?(.+)/.exec(sectionXhr.responseText)
  const sections = JSON.parse(json[1])

  sections.forEach(function (s) {
    sectionsLookup[s.id] = s
  })

  let dataRows
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

  const label = document.getElementById('enrolmentReportProcessingLabel')
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
  const sectionListHeading = document.getElementById('sectionListHeading')

  // sort alphabetically ascending by name
  sections.sort(function (a, b) {
    return (a.name > b.name) - (a.name < b.name)
  })

  let allSectionsData
  if (EXPORT_FORMAT === 'tsv') {
    allSectionsData = [['section name', 'student name', 'student sortable name', 'student id', 'student username', 'student e-mail'].join('\t')]
  } else if (EXPORT_FORMAT === 'xlsx') {
    allSectionsData = [['section name', 'student name', 'student sortable name', 'student id', 'student username', 'student e-mail']]
  }

  sections.forEach(function (section) {
    if (section.students && section.students.length > 0) {
      const newButton = document.createElement('button')
      newButton.textContent = section.name
      newButton.addEventListener('click', function () {
        const dataRows = createSectionData(section)
        exportData(dataRows, section.name)
      })

      sectionListHeading.appendChild(newButton)

      // accumulate array for allSectionsData
      allSectionsData = allSectionsData.concat(createSectionDataSpecifyHeader(section, false))
    }
  })

  // add button for all sections
  const allButton = document.createElement('button')
  allButton.textContent = 'ALL-SECTIONS'
  allButton.addEventListener('click', function () {
    exportData(allSectionsData, 'ALL-SECTIONS')
  })
  sectionListHeading.appendChild(allButton)

  renderStatus('sectionListStatus', 'Sections loaded')
}

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
      dataRows.push([[section.name, student.name, student.sortable_name, student.sis_user_id, student.login_id, student.email].join('\t')])
    } else if (EXPORT_FORMAT === 'xlsx') {
      dataRows.push([section.name, student.name, student.sortable_name, student.sis_user_id, student.login_id, student.email])
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

      const newButton = document.createElement('button')
      newButton.textContent = groupCat.name
      newButton.addEventListener('click', function () {
        generateGroupList(groupCat)
      })

      const div = document.createElement('div')

      div.appendChild(newButton)
      div.appendChild(label)

      const groupCatListHeading = document.getElementById('groupCatListHeading')
      groupCatListHeading.appendChild(div)
    })

    renderStatus('groupCatListStatus', 'Group Categories loaded')
  }
}

function generateGroupList (groupCat) {
  // get all groups
  const label = document.getElementById(pending['label' + groupCat.id])
  label.style.display = 'inline'

  const url = HOST + '/api/v1/group_categories/' + groupCat.id + '/groups?per_page=100'
  pending['group' + groupCat.id] = 0
  pending['name' + groupCat.id] = groupCat.name

  getGroups(url, groupCat, [])
}

function getGroups (url, groupCat, groupsList) {
  try {
    pending['group' + groupCat.id] += 1

    const groupXhr = new XMLHttpRequest()
    groupXhr.onreadystatechange = function processGroupResponse () {
      // 'this' is groupXhr
      if (this.readyState === 4 && this.status === 200) {
        const groupsJson = /(?:while\(1\);)?(.+)/.exec(this.responseText)
        const groups = JSON.parse(groupsJson[1])

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

  let dataRows
  if (groupsList.length > 0) {
    if (EXPORT_FORMAT === 'tsv') {
      dataRows = [['group name', 'student name', 'student sortable name', 'student id', 'student username', 'student e-mail'].join('\t')]
    } else if (EXPORT_FORMAT === 'xlsx') {
      dataRows = [['group name', 'student name', 'student sortable name', 'student id', 'student username', 'student e-mail']]
    }

    pending['member' + groupCat.id] = 0

    groupsList.forEach(function (group) {
      const url = HOST + '/api/v1/groups/' + group.id + '/users?include[]=email&per_page=100'

      getMembers(url, group, dataRows)
    })
  } else {
    const label = document.getElementById(pending['label' + groupCat.id])
    label.textContent = '(Contains no groups)'
  }
}

function getMembers (url, group, dataRows) {
  try {
    pending['member' + group.group_category_id] += 1

    const memberXhr = new XMLHttpRequest()
    memberXhr.onreadystatechange = function processGroupResponse () {
      // 'this' is memberXhr
      if (this.readyState === 4 && this.status === 200) {
        const membersJson = /(?:while\(1\);)?(.+)/.exec(this.responseText)
        const members = JSON.parse(membersJson[1])

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
          const label = document.getElementById(pending['label' + group.group_category_id])
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
    const tsvString = dataRows.join('\r\n')

    const blob = new Blob([tsvString], {
      type: 'text/plain'
    })

    const href = URL.createObjectURL(blob)

    downloadReport(href, filename)
  } else if (EXPORT_FORMAT === 'xlsx') {
    const workbook = ExcelBuilder.Builder.createWorkbook()
    const list = workbook.createWorksheet({
      name: 'list'
    })

    list.setData(dataRows)
    workbook.addWorksheet(list)

    ExcelBuilder.Builder.createFile(workbook, { type: 'blob' }).then(function (data) {
      const href = URL.createObjectURL(data)

      downloadReport(href, filename)
    })
  }
}

function downloadReport (href, filename) {
  const a = document.createElement('a')
  a.href = href
  a.target = '_blank'
  a.download = filename + '.' + EXPORT_FORMAT

  document.body.appendChild(a)
  a.click()
}
