"use strict";

const sleep = (millis) => new Promise((resolve, reject) => {
  setTimeout(resolve, millis);
});

// A simple web request protocol similar to XMLHttpRequest:
const jsonp = (url, request_object) => new Promise((resolve, reject) => {
  // Prepare a script tag appropriately
  var s = document.createElement('script');
  window.global_callback = function(response) {  // Doesn't support multiple concurrent usage of jsonp!
    if(response.type === 'success')
      resolve(response.result);
    else if(response.type === 'failure')
      reject(response.error);
    else
      reject('jsonp format error ....');
  };
  s.onerror = reject;

  // Encode request_object as GET parameter, and do the request.
  s.src = url + '?request=' + window.encodeURIComponent(JSON.stringify(request_object));
  document.head.appendChild(s);
  s.remove();
});

// This convenient function is an abstraction over the more general jsonp(...) function above.
// It uses the login token from this nice convenenient global variable and uses a fixed URL.
let login_token = null;
const to_server = async(request_object) => {
  if(login_token === null)
    throw new Error("Tried to send stuff to the server without logging in ..!");
  if(request_object.login_token !== undefined)
    throw new Error("Don't put a login_token into the argument of to_server() ..!");
  request_object.login_token = login_token;  try {
    return await jsonp("http://50.1.98.138:3001/", request_object);
  } finally {request_object.login_token = undefined;}
};

const sign_in = (sign_in_div) => new Promise((resolve, reject) => {
  // Prepare the callback.
  // It's in a global, so multiple concurrent sign-ins are not supported. Not surprising.
  sign_in_div.setAttribute('data-onsuccess', 'on_sign_in');
  window.on_sign_in = resolve;

  sign_in_div.classList.add('g-signin2');

  // Load the Google API, thus rendering the sign-in button and installing that callback.
  const script = document.createElement('script');
  script.src = 'https://apis.google.com/js/platform.js';
  document.head.appendChild(script);
});

/*
// This function is memoized
const get_grid_widget = (function() {
  // Constructs a widget and returns the root div
  const make_a_new_one = function(pp) {
    const len = pp_length(pp);

    const result = document.createElement('div');
    for(let i=0; i<len; ++i) {
      for(let j=0; j<columns.length; ++j) {
        const cell = document.createElement('input')
        cell.style.position = 'absolute';
        cell.style.left     = `${j * 100} px`;
        cell.style.top      = `${i * 30} px`;
        grid_div.appendChild(cell);
      }
    }

          timesheet.rows.push({
            
          });
      }
    });

    return result;
  };

  const cache = {};  // This maps pay period numbers to root div of widget

  // Here's the memoized function
  return function(pp) {
    if(cache[pp] === undefined)
      cache[pp] = make_a_new_one(pp);
    return cache[pp];
  };
}());
*/

window.onload = async() => {
  const sign_in_div = document.createElement('div');
  document.body.innerText = 'Please sign in to view your timesheet.';
  document.body.appendChild(document.createElement('br'));
  document.body.appendChild(sign_in_div);

  const google_user = await sign_in(sign_in_div);
  login_token = google_user.getAuthResponse().id_token;

  const input = document.createElement('input');
  let dirty = false;
  input.addEventListener('input', function() {
    dirty = true;
  });
  document.body.appendChild(input);
  for(;;) {
    try {
      const msg = {
        type: 'hello',
      };
      if(dirty)
        msg.value = input.value;
      dirty = false;
      const reply = await to_server(msg);  // Some time passes here. `dirty` might change.
      if(!dirty)
        input.value = reply;
    } catch(e) {
      console.error(e);
    }
    await sleep(Math.floor(Math.random() * 2000) + 2000);  // Sleep for a few seconds
  }

/*
  const net_write = function(pp, row_index, column, data) {net_buf.push({pp, row_index, column, data});};
  const net_sync = async() => {
    const old_net_buf = net_buf
    net_buf = [];
    let timesheet = null;
    try {
      timesheet = await to_server({
        type: 'write',
        messages: net_buf,
      });
      // net_buf can be modified during the above network request
    } catch(e) {
      console.error(e);
      net_buf = [].concat(old_net_buf, net_buf);
      return;
    }

    document.body.innerText = JSON.stringify(timesheet);
  };

  // Continually talk to the server to synchronize state
  for(;;) {
    try {
      await net_sync();
    } catch(e) {
      console.error(e);
    }
    await sleep(Math.floor(Math.random() * 2000) + 2000);  // Sleep for a few seconds
  }
*/
};
