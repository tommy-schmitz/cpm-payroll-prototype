const NO_OP = new Promise((resolve, reject) => resolve());
const escape_errors = function(promise) {
  return promise.then((x)=>({type:'success',result:x}), (e)=>({type:'failure',error:e}));
};
const stacktrace = function() {
  try {throw new Error();} catch(e) {return e.stack;}
};
const warn = function() {console.log('weird ... ' + stacktrace());};
const assert = function(b) {if(!b) throw new Error('assert fail, ' + stacktrace());};

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

    // Now give write-access to cpmpayroll@cpm.org. Again, ignore error if it doesn't work.
    const action = escape_errors(
      gapi.client.drive.permissions.create({
        fileId: file_id,
        sendNotificationEmail: false,
        role: 'writer',
        type: 'user',
        emailAddress: 'cpmpayroll@cpm.org',
      })
    );
  return action; }).then( (r) => {
    // If we get an error saying that we don't own the file, then that's no problem. Otherise, re-throw.
    if(r.type === 'failure')
      throw r.error;

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

    // Set up the UI
    document.body.innerHTML = '';  // Clear everything ...
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

      const {td, span, collab} = array[editing_y][editing_x];
      td.removeChild(input);
      td.appendChild(span);
      assert(binding.collaborativeObject === collab);
      assert(binding.domElement === input);
      binding.unbind();

      editing_x = editing_y = binding = null;
    });
    const changes_saved_div = document.createElement('div');
    document.body.appendChild(changes_saved_div);
    const table = document.createElement('table');
    for(let i=0; i<5; ++i) {
      const tr = document.createElement('tr');
      for(let j=0; j<5; ++j) {
        const span = document.createElement('span');
        array[i][j].span = span;
        const td = document.createElement('td');
        array[i][j].td = td;
        td.style.border = '1px solid black';
        td.style.width  = '100px';
        td.style.height = '20px';
        const {collab, x, y} = array[i][j];  // Captured by the closure below
        td.addEventListener('dblclick', function(ev) {
          td.removeChild(span);
          td.appendChild(input);
          input.focus();
          editing_x = x;
          editing_y = y;
          binding = gapi.drive.realtime.databinding.bindString(collab, input);
        });
        td.appendChild(span);
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
    document.body.appendChild(table);

    const update_ui = function() {
      for(let i=0; i<5; ++i) {
        for(let j=0; j<5; ++j) {
          array[i][j].span.innerText = array[i][j].collab.text;
        }
      }
    };

    update_ui();  // Initialize the UI properly.

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
