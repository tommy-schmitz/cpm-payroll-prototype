"use strict";

const assert = (b) => {if(!b) throw new Error('assertion failed');};

const sleep = (millis) => new Promise((resolve, reject) => {
  setTimeout(resolve, millis);
});

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
const pp_length = function(pp) {
  return Math.round((pp2date(pp+1) - pp2date(pp)) / 86400000);
};

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
    return await jsonp("http://localhost:3001/", request_object);  //50.1.98.138:3001
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

const columns = [
  {
    type: 'approval',
    id: 'supervisor_approval',
    approver: 'supervisor',
    title: 'Supervisor Daily Approval',
  },
  {
    type: 'computed_date',
    title: 'Date',
  },
  {
    type: 'input_text',
    id: 'description',
    title: 'Duties - Describe Briefly',
  },
  {
    type: 'input_hours',
    id: 'worked_hours',
    title: 'Daily Hours Worked',
  },
  {
    type: 'input_hours',
    id: 'holiday_hours',
    title: 'Holiday Hours',
  },
  {
    type: 'input_hours',
    id: 'vacation_hours',
    title: 'Vacation Hours',
  },
  {
    type: 'input_hours',
    id: 'flex_hours',
    title: 'Makeup (Flex) Hours',
  },
  {
    type: 'input_hours',
    id: 'sick_hours',
    title: 'Sick Hours',
  },
  {
    type: 'input_hours',
    id: 'jury_hours',
    title: 'Jury Hours',
  },
  {
    type: 'input_hours',
    id: 'bereavement_hours',
    title: 'Bereavement Hours',
  },
  {
    type: 'computed_weekly_hours',
    title: 'Weekly Hours',
  },
  {
    type: 'computed_approval_required',
    title: 'Pre-Approval REQUIRED for Overtime?',
  },
  {
    type: 'approval',
    id: 'director_approval',
    approver: 'director',
    title: 'OT Approval - Initialed by Director'
  },
  {type: 'blank'},
  {
    type: 'input_time',
    id: 'start_lunch',
    title: 'Start Lunch',
  },
  {
    type: 'input_time',
    id: 'end_lunch',
    title: 'End Lunch',
  },
  {
    type: 'computed_lunch_period',
    title: 'Lunch Period',
  },
  {
    type: 'input_yes_no',
    id: 'rest_period_observed',
    title: 'Rest period(s) observed',
  },
];

const make_grid_cell_id = function(pp, row_number, column_id) {
  return {
    type: 'grid_data',
    pp,
    row_number,
    column_id,
  };
};

// get_grid_widget is a memoized function
// update_ui takes a message from the server
const {get_grid_widget, collect_ui_diffs, update_ui} = (function() {
  // Various parts of the UI will volunteer to provide data to the server when the master thread dictates
  const subscriptions_1 = [];
  const subscribe_1 = function(func) {  // `func` takes a message from the server
    subscriptions_1.push(func);
  };

  // Various parts of the UI will subscribe to hear the message from the server
  const subscriptions_2 = {};
  const subscribe_2 = function(cell_id, func) {  // `cell_id` defines which diff structures to listen for
                                               // `func` takes a diff structure from the server
    const list = subscriptions_2[JSON.stringify(cell_id)] = (subscriptions_2[cell_id] || []);
    list.push(func);
  };

  // Constructs a widget and returns the root div
  const make_a_new_one = function(pp) {
    const result = document.createElement('div');

    for(let j=0; j<columns.length; ++j) {
      const div = document.createElement('div');
      div.innerText = columns[j].title;
      div.style.position = 'absolute';
      div.style.left     = `${j * 60}px`;
      div.style.top      = '0px';
      div.style.width    = '60px';
      div.style.height   = '30px';
      div.style.overflow = 'hidden';
      result.appendChild(div);
    }

    const len = pp_length(pp);
    for(let i=0; i<len; ++i) {
      for(let j=0; j<columns.length; ++j) {
        if(columns[j].type === 'approval') {
          continue;
        } else if(columns[j].id === undefined) {
          continue;
        } else {
          const column_id = columns[j].id;
          const input = document.createElement('input')
          input.style.position = 'absolute';
          input.style.left     = `${j * 60}px`;
          input.style.top      = `${(i+1) * 30}px`;
          input.style.width    = '60px';
          input.style.height   = '30px';
          let dirty = false;
          input.addEventListener('input', function(_) {
            dirty = true;
          });
          subscribe_1((diffs) => {
            if(dirty)
              diffs.push({
                cell_id: make_grid_cell_id(pp, i, column_id),
                value: input.value,
              });
            dirty = false;
          });
          subscribe_2(make_grid_cell_id(pp, i, column_id), (diff) => {
            if(!dirty)
              input.value = diff.value;
          });
          result.appendChild(input);
        }
      }
    }
    return result;
  };

  const cache = {};  // This maps pay period numbers to root div of widget

  return {
    get_grid_widget(pp) {
      if(cache[pp] === undefined)
        cache[pp] = make_a_new_one(pp);
      return cache[pp];
    },
    collect_ui_diffs() {
      const result = [];
      for(let i=0; i<subscriptions_1.length; ++i)
        subscriptions_1[i](result);
      return result;
    },
    update_ui(diff_list) {
      for(let i=0; i<diff_list.length; ++i) {
        const diff = diff_list[i];
        console.log('got: ' + JSON.stringify(diff));
        const func_list = subscriptions_2[JSON.stringify(diff.cell_id)];
        if(func_list === undefined)
          continue;
        for(let j=0; j<func_list.length; ++j)
          func_list[j](diff);
      }
    },
  };
}());

// Pick a current-ish pay period.
const date = new Date();
let visible_pp = Math.round(24*(date.getFullYear()-1970) + 2*date.getMonth() + date.getDate()/16) - 1;

window.onload = async() => {
  const sign_in_div = document.createElement('div');
  document.body.innerText = 'Please sign in to view your timesheet.';
  document.body.appendChild(document.createElement('br'));
  document.body.appendChild(sign_in_div);

  const google_user = await sign_in(sign_in_div);
  login_token = google_user.getAuthResponse().id_token;

  const container = document.createElement('div');
  container.style.position = 'relative';
  container.style.font = '10px sans-serif';
  const update_container = function() {
    container.innerHTML = '';   container.appendChild(get_grid_widget(visible_pp));
  };
  update_container();

  const which_pp_div = document.createElement('div');
  const update_whichppdiv = () => {which_pp_div.innerText = make_pp_name(visible_pp);};
  update_whichppdiv();

  const prev_pp_button = document.createElement('button');
  prev_pp_button.innerText = 'Previous pay period';
  prev_pp_button.onclick = () => {
    --visible_pp;
    update_container();
    update_whichppdiv();
  };
  document.body.appendChild(prev_pp_button);

  const next_pp_button = document.createElement('button');
  next_pp_button.innerText = 'Next pay period';
  next_pp_button.onclick = () => {
    ++visible_pp;
    update_container();
    update_whichppdiv();
  };
  document.body.appendChild(next_pp_button);

  document.body.appendChild(which_pp_div);

  document.body.appendChild(container);

  let doc_version_number = -1;
  for(;;) {
    try {
      const msg = {
        type: 'sync',
        doc_version_number,
        diffs: collect_ui_diffs(),
      };
      const reply = await to_server(msg);
      doc_version_number = reply.doc_version_number;
      update_ui(reply.diffs);
    } catch(e) {
      console.error(e);
    }
    await sleep(Math.floor(Math.random() * 2000) + 2000);  // Sleep for a few seconds
  }
};
