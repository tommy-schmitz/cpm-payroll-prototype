const NO_OP = new Promise((resolve, reject) => resolve());

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
  NO_OP.then(() => {
    const action = gapi.client.load('https://sheets.googleapis.com/$discovery/rest?version=v4');
  return action; }).then( () => {
    const action = gapi.client.load('https://www.googleapis.com/discovery/v1/apis/drive/v3/rest');
  return action; }).then( () => {
    const action = gapi.load('drive-realtime');
  return action; }).then( () => {
    // Get the file ID of the realtime file containing the employee's timesheet.
    const action = jsonp( 'https://script.google.com/macros/s/AKfycbws6DYq0TnAzeuUApe' +
                          'v1ugEhhz2FZoi1bZ_kbb08DQTutkv67k/exec'                        );
  return action; }).then((file_id) => {
    const action = realtime.load(file_id);
  return action; }).then( (doc) => {

    // Set up the UI
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    const model = doc.getModel();
    const root = model.getRoot();
    root.addEventListener('value_changed', function(ev) {
      // Ideally this shouldn't happen often ... Just once when the file is initialized ...
      gapi.drive.realtime.databinding.bindString(root.get('string'), textarea);
      console.log('value changed');
    });

    if(root.isEmpty()) {  // This doesn't guarantee single-initialization, but who cares.
      // We should initialize the file contents.
      const string = model.createString();
      string.setText('initial contents');
      root.set('string', string);  // Triggers the event listener above ...
    } else {
      gapi.drive.realtime.databinding.bindString(root.get('string'), textarea);
    }
  });
};
