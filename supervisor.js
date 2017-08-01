const NO_OP = new Promise((resolve, reject) => resolve());
const escape_errors = function(promise) {
  return promise.then((x)=>({type:'success',result:x}), (e)=>({type:'failure',error:e}));
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
    // Set up the UI
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    const model = doc.getModel();
    const root = model.getRoot();

    root.addEventListener('value_changed', function(ev) {
      // Ideally this shouldn't ever happen, but presumably race conditions make it possible.
      gapi.drive.realtime.databinding.bindString(root.get('string'), textarea);
      console.log('value changed');
    });

    // Ideally, root.isEmpty() should never be true, but presumably race conditions make it possible.
    if(!root.isEmpty())
      gapi.drive.realtime.databinding.bindString(root.get('string'), textarea);
  });
};
