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

var when_done_with_auth_stuff = function() {
  let file_id = null;

  NO_OP.then(() => {
    const action = gapi.client.load('https://sheets.googleapis.com/$discovery/rest?version=v4');
  return action; }).then( () => {
    const action = gapi.client.load('https://www.googleapis.com/discovery/v1/apis/drive/v3/rest');
  return action; }).then( () => {
    const action = gapi.load('drive-realtime');
  return action; }).then( () => {
    // Generate a file ID that could be used as the ID for the timesheet, in case the timesheet don't exist.
    const action = gapi.client.drive.files.generateIds({
      count: 1,
      space: 'drive',
    });
  return action; }).then( (response) => {
    const potential_id = response.result.ids[0];

    // Consult the server to get the definitive ID of the timesheet. See Apps Script code for details.
    const action = jsonp( 'https://script.google.com/macros/s/AKfycbws6DYq0TnAzeuUApe' +
                          'v1ugEhhz2FZoi1bZ_kbb08DQTutkv67k/exec?potential_id=' + potential_id );
  return action; }).then((r) => {
    file_id = r;

    // Try to create the file. If it already exists, no problem: just ignore the resulting error.
    const action = escape_errors(
      gapi.client.drive.files.create({
        name: 'Realtime timesheet',
        mimeType: 'application/vnd.google-apps.drive-sdk',
        id: file_id,
      })
    );
  return action; }).then( (r) => {
    // If we get an error saying the file already exists, then that's no problem. Otherwise, re-throw.
    if(r.type === 'failure' && r.error.result.error.errors[0].reason !== 'fileIdInUse')
      throw r.error;

    // Now give write-access to cpmpayroll@cpm.org. This operation should be idempotent ... I think.
    const action =
      gapi.client.drive.permissions.create({
        fileId: file_id,
        sendNotificationEmail: false,
        role: 'writer',
        type: 'user',
        emailAddress: 'cpmpayroll@cpm.org',
      });
  return action; }).then( () => {
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

    const input = document.createElement('input');
    input.type = 'text';
    input.style.width  = '100%';
    input.style.height = '100%';
    let editing_x = null;
    let editing_y = null;
    let binding = null;
    input.addEventListener('blur', function(ev) {
      if(editing_x === null  ||  editing_y === null  ||  binding === null)
        return warn();

      const {span, div, collab} = array[editing_y][editing_x];
      document.body.removeChild(input);
      div.appendChild(span);
      assert(binding.collaborativeObject === collab);
      assert(binding.domElement === input);
      binding.unbind();

      editing_x = editing_y = binding = null;
    });
    input.addEventListener('keydown', function(ev) {
      if(ev.key === 'Enter')
        input.blur();
    });

    const changes_saved_div = document.createElement('div');
    document.body.appendChild(changes_saved_div);

    // Create table
    const table = document.createElement('table');
    table.style.borderCollapse = 'collapse';
    // Create header row
    const thead = document.createElement('thead');
    const headings = [
      'Date',
      'Duties - Describe Briefly',
      'Daily Hours Worked',
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
      // Create editable cells
      for(let j=0; j<2; ++j) {
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
        const {collab, x, y} = array[i][j];  // Captured by the closure below
        td.addEventListener('dblclick', function(ev) {
          div.removeChild(span);
          document.body.appendChild(input);
          put_element_over(input, td);
          input.focus();
          editing_x = x;
          editing_y = y;
          binding = gapi.drive.realtime.databinding.bindString(collab, input);
        });
        td.appendChild(div);
        tr.appendChild(td);
      }
      array[i][0].div.style.width = array[i][0].td.style.width = '150px';
      array[i][1].div.style.width = array[i][1].td.style.width = '50px';
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    document.body.appendChild(table);

    // Done making the UI.

    const update_ui = function() {
      for(let i=0; i<5; ++i) {
        for(let j=0; j<2; ++j) {
          array[i][j].span.innerText = array[i][j].collab.text;
        }
      }
    };

    // Now initialize the UI properly.
    update_ui();

    root.addEventListener('object_changed', function(ev) {
      update_ui();

      // Update the thing that lets you know if your changes have been saved (if necessary).
      if(ev.isLocal) {
        if(changes_saved_div.innerText === 'All changes saved in Drive.')
          changes_saved_div.innerText = '...';
      }
    });

    // Finish setting up the thing that lets you know if your changes have been saved.
    setTimeout(function recurse() {
      setTimeout(recurse, 1000);

      if(doc.saveDelay === 0)
        changes_saved_div.innerText = 'All changes saved in Drive.';
      else if(doc.saveDelay > 10000)
        changes_saved_div.innerText = 'Your recent changes have not yet been saved ...';
    }, 0);
  });
};
