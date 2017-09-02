// A simple web request protocol similar to XMLHttpRequest:
const jsonp = function(url, params) {
  return new Promise((resolve, reject) => {
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

    // Encode the GET parameters
    let param_string = '';
    for(let key in params) {
      const pair_string = window.encodeURIComponent(key) + '=' + window.encodeURIComponent(params[key]);
      if(param_string === '')
        param_string = pair_string;
      else
        param_string = param_string + '&' + pair_string;
    }

    // Do the request
    s.src = url + '?' + param_string;
    document.head.appendChild(s);
    s.remove();
  });
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

window.onload = async() => {
  const sign_in_div = document.createElement('div');
  document.body.innerText = 'Please sign in to view your timesheet.';
  document.body.appendChild(document.createElement('br'));
  document.body.appendChild(sign_in_div);

  const google_user = await sign_in(sign_in_div);

  document.body.innerText = 'Logging in ...';

  const id_token = google_user.getAuthResponse().id_token;
  const username = await jsonp('http://localhost:3001/', {
    type: 'login',
    token: id_token,
  });

  document.body.innerText = 'Signed in as: ' + username;
};
