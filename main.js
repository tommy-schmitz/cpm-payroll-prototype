const NO_OP = new Promise((resolve, reject) => resolve());

const jsonp = function(url) {
  return new Promise((resolve, reject) => {
    var scr = document.createElement('script');
    global_callback = resolve;
    scr.src = url;
    document.head.appendChild(scr);
    scr.remove();
  });
};

const CLIENT_ID = '663604848714-cdppq8r1sc2sqdt7lu3nc05r4utjr0vf.apps.googleusercontent.com';
  //'835615821089-0mmun003p819e379vpurms6f1joj33qk.apps.googleusercontent.com';
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
];

const realtime = {
  load(file_id) {
    return new Promise((resolve, reject) => {
      gapi.client.drive.realtime.load(file_id, resolve, ()=>{}, reject);
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
  let email = null;
  let file_id = null;
  NO_OP.then(() => {
    const action = gapi.client.load('https://sheets.googleapis.com/$discovery/rest?version=v4');
  return action; }).then( () => {
    const action = gapi.client.load('https://www.googleapis.com/discovery/v1/apis/drive/v3/rest');
  return action; }).then( () => {
    const action = gapi.client.load('plus', 'v1');  // For getting the email address ...
  return action; }).then( () => {
    // Get my email address.
    const action = new Promise((resolve, reject) => {
      gapi.client.plus.people.get({userId: 'me'}).execute(resolve);
    });
  return action; }).then( (response) => {
    email = response.emails[0].value;

    // Look up my timesheet, in case it already exists.
    const action = gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: '1sajRfA9hYZacI-a4UH0-cgfwf1hvzpVczUwRhn2kwGY',  // A public list of all timesheets
      range: 'A1',
    });
  return action; }).then( (response) => {
    const bulletin = JSON.parse(response.result.values[0][0]);

    if(email === null)
      throw "The email shouldn't be null at this point";

    file_id = bulletin[email];

    // Create timesheet (and set file_id) if it doesn't exist yet.
    const action =
      /*if*/(file_id === undefined) ?
        NO_OP.then(() => {
          const action = gapi.client.drive.files.create({
            name: 'Timesheet ' + email,
            mimeType: 'application/vnd.google-apps.drive-sdk',
          });
        return action; }).then((r) => {
          file_id = r.result.id;

          // Notify cpmpayroll about the newly created timesheet:
          const action = jsonp('https://script.google.com/macros/s/AKfycbws6DYq0TnAzeuUApe'+
                               'v1ugEhhz2FZoi1bZ_kbb08DQTutkv67k/exec?file_id='+file_id);
        return action; }).then(() => {
        })
      /*else*/ :
        NO_OP;
    ;
  return action; }).then( () => {
    const action = realtime.load(file_id);
  return action; }).then( (doc) => {
    const model = doc.getModel();
  });
};
