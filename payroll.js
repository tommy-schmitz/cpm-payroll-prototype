const NO_OP = new Promise((resolve, reject) => resolve());
const escape_errors = function(promise) {
  return promise.then((x)=>({type:'success',result:x}), (e)=>({type:'failure',error:e}));
};
const stacktrace = function() {
  try {throw new Error();} catch(e) {return e.stack;}
};
const warn = function() {console.log('weird ... ' + stacktrace());};
const assert = function(b) {if(!b) throw new Error('assert fail, ' + stacktrace());};

// Positions element e1 at the place where element e2 is.
const put_element_over = function(e1, e2) {
  const {left, top, width, height} = e2.getBoundingClientRect();
  const s = e1.style;
  s.left     = (left - window.pageXOffset) + 'px';
  s.top      = (top - window.pageYOffset) + 'px';
  s.width    = (width - 3) + 'px';   //-3 because e2 will be a 'td' element, I think?
  s.height   = (height - 3) + 'px';  //ditto
  s.position = 'absolute';
};

// A simple web request protocol similar to XMLHttpRequest:
const jsonp = function(url) {
  return new Promise((resolve, reject) => {
    var s = document.createElement('script');
    global_callback = function(response) {  // Doesn't support multiple concurrent usage of jsonp!
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

/*global*/ arghablargha = function() {
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
      model.beginCompoundOperation('migrate 0 to 1', false);
      root.set('contents', contents);
      root.delete('string');
      model.endCompoundOperation();
    }

    // Load the model into a nice ordinary 2D array.
    const array = [];
    for(let i=0; i<5; ++i) {
      const a = [];
      array.push(a);
      for(let j=0; j<5; ++j)
        a.push({  // This object will get extended later.
          x: j,
          y: i,
          collab: contents.get('array,'+j+','+i),
        });
    }

    // Next, set up the UI ...

    document.body.innerHTML = '';  // Clear everything ...

    document.body.style.fontFamily = 'sans-serif';
    document.body.style.fontSize = '0.83333em';

    // Create table
    const table = document.createElement('table');
    table.style.borderCollapse = 'collapse';
    // Create header row
    const thead = document.createElement('thead');
    const headings = [
      'Date',
      'Duties - Describe Briefly',
      'Daily Hours Worked',
      'Regular Hours',
      'Overtime Hours',
    ];
    for(let j=0; j<headings.length; ++j) {
      const th = document.createElement('th');
      th.innerText = headings[j];
      thead.appendChild(th);
    }
    table.appendChild(thead);
    // Create other rows
    const tbody = document.createElement('tbody');
    for(let i=0; i<5; ++i) {
      const tr = document.createElement('tr');
      // Create row "header" cell
      const th = document.createElement('th');
      th.innerText = '(date goes here)';
      th.setAttribute('scope', 'row');
      tr.appendChild(th);
      // Create cells
      for(let j=0; j<4; ++j) {
        const span = document.createElement('span');
        array[i][j].span = span;
        const div = document.createElement('div');
        array[i][j].div = div;
        div.style.height = '25px';
        div.style.overflow = 'hidden';
        div.appendChild(span);
        const td = document.createElement('td');
        array[i][j].td = td;
        td.style.border = '1px solid black';
        td.style.height = '25px';
        td.appendChild(div);
        tr.appendChild(td);
      }
      // Set column widths
      array[i][0].div.style.width = array[i][0].td.style.width = '150px';
      array[i][1].div.style.width = array[i][1].td.style.width = '50px';
      array[i][2].div.style.width = array[i][2].td.style.width = '50px';
      array[i][3].div.style.width = array[i][3].td.style.width = '50px';
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    document.body.appendChild(table);

    // Done making the UI.

    const update_ui = function() {
      for(let i=0; i<5; ++i) {
        // Update the employee-editable cells
        for(let j=0; j<2; ++j) {
          array[i][j].span.innerText = array[i][j].collab.text;
        }

        // Update regular hours cell
        array[i][2].span.innerText = (function() {try {
          const worked = + array[i][1].collab.text;
          if(worked < 8)
            return worked;
          else
            return 8;
        } catch(e) {
          return 'Error.';
        }}());

        // Update overtime hours cell
        array[i][3].span.innerText = (function() {try {
          const worked = + array[i][1].collab.text;
          if(worked > 8)
            return worked - 8;
          else
            return 0;
        } catch(e) {
          return 'Error.';
        }}());

      }
    };

    // Now initialize the UI properly.
    update_ui();

    root.addEventListener('object_changed', function(ev) {
      update_ui();
    });
  });
};
