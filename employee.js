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

    // Set up the UI
    const textarea = document.createElement('textarea');
    document.body.innerHTML = '';
    const changes_saved_div = document.createElement('div');
    document.body.appendChild(changes_saved_div);
    document.body.appendChild(document.createElement('br'));
    document.body.appendChild(textarea);

    // Set up the thing that lets you know if your changes have been saved.
    root.addEventListener('object_changed', function(ev) {
      if(ev.isLocal  &&  changes_saved_div.innerText === 'All changes saved in Drive.')
        changes_saved_div.innerText = '...';
    });
    setTimeout(function recurse() {
      setTimeout(recurse, 1000);

      if(doc.saveDelay === 0)
        changes_saved_div.innerText = 'All changes saved in Drive.';
      else if(doc.saveDelay > 10000)
        changes_saved_div.innerText = 'Your recent changes have not yet been saved ...';
    }, 0);

    root.addEventListener('value_changed', function(ev) {
      // Ideally this shouldn't happen often ... Just once when the file is initialized ...
      gapi.drive.realtime.databinding.bindString(root.get('string'), textarea);
      console.log('value changed');
    });

    if(root.isEmpty()) {  // This doesn't guarantee single-initialization, but who cares.
      // We should initialize the file contents.
      const string = model.createString();
      string.setText('This is your "timesheet" initial contents.');
      root.set('string', string);  // Triggers the event listener above ...
    } else {
      gapi.drive.realtime.databinding.bindString(root.get('string'), textarea);
    }
  });
};
