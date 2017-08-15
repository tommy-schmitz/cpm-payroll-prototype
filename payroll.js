'use strict';

const NO_OP = new Promise((resolve, reject) => resolve());
const escape_errors = function(promise) {
  return promise.then((x)=>({type:'success',result:x}), (e)=>({type:'failure',error:e}));
};
const stacktrace = function() {
  try {throw new Error();} catch(e) {return e.stack;}
};
const warn = function() {console.log('weird ... ' + stacktrace());};
const assert = function(b) {if(!b) throw new Error('assert fail, ' + stacktrace());};

const pp2date = function(pp) {  // Returns the beginning of the day at the beginning of the pay period, UTC
  const year_code = Math.floor(pp / 24);
  const year = year_code + 1970;
  const pp_code = pp - 24 * year_code;
  const month = Math.floor(pp_code / 2);
  const which_half = pp_code % 2;
  const day = (which_half === 0  ?  1  :  16);
  return new Date(Date.UTC(year, month, day));
};
const make_pp_name = function(pp) {
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const date = pp2date(pp);
  assert(date.getUTCDate() === 1  ||  date.getUTCDate() === 16);
  const date_range = (date.getUTCDate() === 1  ?  ' 1-15 '  :  ' 16-END ');
  return MONTHS[date.getUTCMonth()] + date_range + date.getUTCFullYear();
};

// Positions element e1 at the place where element e2 is.
const put_element_over = function(e1, e2) {
  const {left, top, width, height} = e2.getBoundingClientRect();
  const s = e1.style;
  s.left     = (left + window.pageXOffset) + 'px';
  s.top      = (top + window.pageYOffset) + 'px';
  s.width    = (width - 3) + 'px';   //-3 because e2 will be a 'td' element, I think?
  s.height   = (height - 3) + 'px';  //ditto
  s.position = 'absolute';
};

// A simple web request protocol similar to XMLHttpRequest:
const jsonp = function(url) {
  return new Promise((resolve, reject) => {
    var s = document.createElement('script');
    window.global_callback = function(response) {  // Doesn't support multiple concurrent usage of jsonp!
      if(response.type === 'success')
        resolve(response.result);
      else
        reject(response.error);
    };
    s.src = url;
    document.head.appendChild(s);
    s.remove();
  });
};

const CLIENT_ID = '663604848714-cdppq8r1sc2sqdt7lu3nc05r4utjr0vf.apps.googleusercontent.com';
  //'835615821089-0mmun003p819e379vpurms6f1joj33qk.apps.googleusercontent.com';
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

const realtime = {
  load(file_id) {
    return new Promise((resolve, reject) => {
      gapi.drive.realtime.load(file_id, resolve, ()=>{}, reject);
    });
  },
};

window.arghablargha = function() {
  gapi.auth.authorize({
    client_id: CLIENT_ID,
    scope: SCOPES.join(' '),
    immediate: true
  }, handle_auth_result);
};

const handle_auth_result = function(auth_result) {
  const authorize_div = document.getElementById('authorize-div');
  if(auth_result && !auth_result.error) {
    authorize_div.style.display = 'none';

// This code doesn't seem to work.
/*
    // Set a timeout to refresh the oauth thing every 45 minutes.
    setTimeout(function recurse() {
      console.log("I'm going to try to refresh the OAuth thing now ...");
      gapi.auth.authorize({
        client_id: CLIENT_ID,
        scope: SCOPES.join(' '),
        immediate: true
      }, function(auth_result) {
        if(auth_result && !auth_result.error) {
          console.log('Successfully refreshed the OAuth thing');
          setTimeout(recurse, 2700000);
        } else {
          console.log('I was not able to refresh the OAuth thing!!');
        }
      });
    }, 10000);
*/

    when_done_with_auth_stuff();
  } else {
    authorize_div.style.display = 'inline';
    const authorize_button = document.getElementById('authorize-button');
    authorize_button.onclick = function(_) {
      gapi.auth.authorize({
        client_id: CLIENT_ID,
        scope: SCOPES.join(' '),
        immediate: false
      }, handle_auth_result);
      return false;
    };
  }
};

const user_selects_timesheet_to_view = function(db) {
  return new Promise((resolve, reject) => {
    document.body.innerHTML = '';

    const div = document.createElement('div');
    document.body.appendChild(div);
    div.appendChild(document.createTextNode('Whose timesheet would you like to view?'));
    div.appendChild(document.createElement('br'));
    const sel = document.createElement('select');
    div.appendChild(sel);
    div.appendChild(document.createElement('br'));
    const button = document.createElement('button');
    div.appendChild(button);

    sel.size = 10;
    const emails = [];
    for(let email in db.contents) {
      emails.push(email);
      const opt = document.createElement('option');
      opt.innerText = email;
      sel.appendChild(opt);
    }
    sel[0].selected = true;

    button.innerText = 'Open';
    button.onclick = function() {
      div.remove();
      resolve(emails[sel.selectedIndex]);
    };
  });
};

var when_done_with_auth_stuff = function() {
  let file_id = null;
  let db = null;

  NO_OP.then(() => {
    const action = gapi.client.load('https://sheets.googleapis.com/$discovery/rest?version=v4');
  return action; }).then( () => {
    const action = gapi.client.load('https://www.googleapis.com/discovery/v1/apis/drive/v3/rest');
  return action; }).then( () => {
    const action = gapi.load('drive-realtime');
  return action; }).then( () => {
    // Get a list of all timesheets from a Google spreadsheet (Database v4.x)
    const action = gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: '1sajRfA9hYZacI-a4UH0-cgfwf1hvzpVczUwRhn2kwGY',
      range: 'A1',
    });
  return action; }).then((r) => {
    db = JSON.parse(r.result.values[0][0]);
    const action = user_selects_timesheet_to_view(db);
  return action; }).then( (email) => {
    file_id = db.contents[email].timesheet;
    const action = realtime.load(file_id);
  return action; }).then( (doc) => {
    const model = doc.getModel();
    const root = model.getRoot();
    let contents = root.get('contents');

    // Migration from format 0 to format 1
    // Also works as an initializer for format 1
    if(contents === null) {
      const type = model.createString('1');
      contents = model.createMap();
      contents.set('type', type);
      for(let i=0; i<5; ++i)
        for(let j=0; j<5; ++j)
          contents.set('array,'+j+','+i, model.createString(''));
      model.beginCompoundOperation('migrate 0 to 1', false);  try {
        root.set('contents', contents);
        root.delete('string');  // Silent fail if it doesn't exist.
      } finally {model.endCompoundOperation();}
    }

    // Migration from format 1 to format 2
    // Empty documents will be initialized above and then migrated to format 2, below.
    if(contents.get('type').text === '1') {
      const new_contents = model.createMap();
      new_contents.set('type', model.createString('2'));
      new_contents.set('timesheets', model.createMap());

      root.set('contents', new_contents);
      contents = new_contents;
    }

    // Get the CollaborativeMap for the timesheet for the given pay period, or create if non-existent.
    const get_timesheet = function(pp) {
      assert(pp === (pp|0));  // pp should be an integer representing a pay period.
      let result = contents.get(pp + '');
      if(result !== null)
        return result;
      result = model.createMap();
      contents.set(pp + '', result);
      return result;
    };

    // Get the CollaborativeMap for the given day, or create if non-existent.
    const get_record = function(timesheet, i) {
      assert(i === (i|0));  // i should be an 0-based index indicating a day in the appropriate pay period.
      let result = timesheet.get(i + '');
      if(result !== null)
        return result;
      result = model.createMap();
      timesheet.set(i + '', result);
      return result;
    };

    // Get the CollaborativeString for the given field, or create if non-existent.
    const get_field = function(record, fieldname) {
      assert(typeof fieldname === 'string');
      let result = record.get(fieldname);
      if(result !== null)
        return result;
      result = model.createString();
      record.set(fieldname, result);
      return result;
    };

    let visible_pp = null;  // Initialized just below ...

    // Decide which pay period to show initially
    if(contents.get('last_submitted_pp') !== null) {
      visible_pp = (+ contents.get('last_submitted_pp').text) + 1;  //+1 to show the next, non-submitted one
    } else {
      // Pick a current-ish pay period.
      const date = new Date();
      visible_pp = Math.round(24*(date.getFullYear()-1970) + 2*date.getMonth() + date.getDate()/16) - 1;
    }

    const column_settings = [
      {
        type: 'input',
        field: 'description',
        title: 'Duties - Describe Briefly',
        input_type: 'text',
        width: '150px',
      },
      {
        type: 'input',
        field: 'hours',
        title: 'Daily Hours Worked',
        input_type: 'number',
        width: '50px',
      },
      {
        type: 'output',
        field: 'regular',
        title: 'Regular Hours',
        width: '50px',
      },
      {
        type: 'output',
        field: 'overtime',
        title: 'Overtime Hours',
        width: '50px',
      },
    ];

    // This array will keep handles on some stuff so we can reference them easily.
    const array = [];
    for(let i=0; i<16; ++i) {
      array.push({  // This object will get extended later.
        cells: [],
      });
      for(let j=0; j<column_settings.length; ++j)
        array[i].cells.push({  // This object will get extended later.
          x: j,
          y: i,
        });
    }

    // Next, set up the UI ...

    document.body.innerHTML = '';  // Clear everything ...

    document.body.style.fontFamily = 'sans-serif';
    document.body.style.fontSize = '0.83333em';

    const button_prev = document.createElement('button');
    const button_next = document.createElement('button');
    button_prev.innerText = 'Previous pay period';
    button_next.innerText = 'Next pay period';
    document.body.appendChild(button_prev);
    document.body.appendChild(button_next);
    document.body.appendChild(document.createElement('br'));

    const which_pp_div = document.createElement('div');
    document.body.appendChild(which_pp_div);

    // Create table
    const table = document.createElement('table');
    table.style.borderCollapse = 'collapse';
    // Create header row
    const thead = document.createElement('thead');
    const temp = document.createElement('th');  // The top left most cell. It says "Date" in it.
    temp.innerText = 'Date';
    thead.appendChild(temp);
    for(let j=0; j<column_settings.length; ++j) {
      const th = document.createElement('th');
      th.innerText = column_settings[j].title;
      thead.appendChild(th);
    }
    table.appendChild(thead);
    // Create other rows
    const tbody = document.createElement('tbody');
    for(let i=0; i<16; ++i) {
      const tr = document.createElement('tr');
      // Create row "header" cell
      const th = document.createElement('th');
      array[i].row_header = th;
      th.innerText = '(date goes here)';
      th.setAttribute('scope', 'row');
      tr.appendChild(th);
      // Create main cells
      for(let j=0; j<column_settings.length; ++j) {
        const span = document.createElement('span');
        array[i].cells[j].span = span;
        const div = document.createElement('div');
        array[i].cells[j].div = div;
        div.style.height = '25px';
        div.style.overflow = 'hidden';
        div.appendChild(span);
        const td = document.createElement('td');
        array[i].cells[j].td = td;
        td.style.border = '1px solid black';
        td.style.height = '25px';
        div.style.width = td.style.width = column_settings[j].width;
        td.appendChild(div);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    document.body.appendChild(table);

    // Done making the UI.

    const update_ui = function() {
      which_pp_div.innerText = make_pp_name(visible_pp);

      const pp_date = pp2date(visible_pp);
      const next_pp_date = pp2date(visible_pp + 1);
      const pp_length = Math.round((next_pp_date - pp_date) / 86400000);
      const timesheet = get_timesheet(visible_pp);
      for(let i=0; i<pp_length; ++i) {
        array[i].row_header.innerText
            = (pp_date.getUTCMonth()+1) + '/' + (pp_date.getUTCDate()+i);  //+1 because 0 is January; etc
        const record = get_record(timesheet, i);
        for(let j=0; j<column_settings.length; ++j) {
          array[i].cells[j].td.style.display = '';
          const span = array[i].cells[j].span;

          const get = function(fieldname) {return + get_field(record, fieldname).text;}
          const hours = get('hours');

          if(column_settings[j].type === 'input')
            span.innerText = get_field(get_record(timesheet, i), column_settings[j].field).text;
          else if(column_settings[j].field === 'regular')
            span.innerText = Math.min(hours, 8);
          else if(column_settings[j].field === 'overtime')
            span.innerText = Math.max(hours-8, 0);
        }
      }
      for(let i=pp_length; i<array.length; ++i) {
        array[i].row_header.innerText = '';
        for(let j=0; j<column_settings.length; ++j)
          array[i].cells[j].td.style.display = 'none';
      }
    };

    // Now initialize the UI properly.
    update_ui();

    root.addEventListener('object_changed', function(ev) {
      update_ui();
    });

    // Finish setting up the previous-pay-period and next-pay-period buttons
    button_prev.addEventListener('click', function(ev) {
      --visible_pp;
      update_ui();
    });
    button_next.addEventListener('click', function(ev) {
      ++visible_pp;
      update_ui();
    });
  });
};
