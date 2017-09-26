"use strict";

const assert = (b) => {if(!b) throw new Error('assertion failed');};

const sleep = (millis) => new Promise((resolve, reject) => {
  setTimeout(resolve, millis);
});

const date2pp = function(utc_date) {
  const year = utc_date.getUTCFullYear();
  const year_code = year - 1970;
  const month = utc_date.getUTCMonth();
  const day = utc_date.getUTCDate();
  const which_half = (day > 15.5  ?  1  :  0);
  const pp = which_half + (2 * month) + (24 * year_code);
  return pp;
};
const pp2date = function(pp) {  // Returns the beginning of the day at the beginning of the pay period, UTC
  assert(pp === (pp | 0));  // Verify that `pp` is an integer.
  const year_code = Math.floor(pp / 24);
  const year = year_code + 1970;
  const pp_code = pp - 24 * year_code;
  const month = Math.floor(pp_code / 2);
  const which_half = pp_code % 2;
  const day = (which_half === 0  ?  1  :  16);
  return new Date(Date.UTC(year, month, day));
};
const date2code = (utc_date) => Math.floor(utc_date.getTime() / 86400000);
const code2date = (day_code) => new Date(day_code * 86400000);
const code2pp = (day_code) => date2pp(code2date(day_code));
const code2weeknumber = (day_code) => Math.floor((day_code + 3) / 7);
const pp2code = (pp) => date2code(pp2date(pp));
const make_pp_name = function(pp) {
  assert(pp === (pp | 0));  // Verify that `pp` is an integer.
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const date = pp2date(pp);
  assert(date.getUTCDate() === 1  ||  date.getUTCDate() === 16);
  const date_range = (date.getUTCDate() === 1  ?  ' 1-15 '  :  ' 16-END ');
  return MONTHS[date.getUTCMonth()] + date_range + date.getUTCFullYear();
};
const pp_length = function(pp) {
  assert(pp === (pp | 0));  // Verify that `pp` is an integer. This screwed me once before ...
  return Math.round((pp2date(pp+1) - pp2date(pp)) / 86400000);
};

// Helper functions for controlling the dialog box that appears when leaving the page
const {confirm_before_unload, dont_confirm_before_unload} = (function() {
  const f = function(e) {
    e.preventDefault();
    e.returnValue = 'blah';
    return e.returnValue;
  };
  let installed = false;
  return {
    confirm_before_unload() {
      if(!installed)
        window.addEventListener('beforeunload', f);
      installed = true;
    },
    dont_confirm_before_unload() {
      if(installed)
        window.removeEventListener('beforeunload', f);
      installed = false;
    },
  };
}());

// A simple web request protocol similar to XMLHttpRequest:
const jsonp = (url, request_object) => new Promise((resolve, reject) => {
  // Prepare a script tag appropriately
  var s = document.createElement('script');
  window.global_callback = function(response) {  // Doesn't support multiple concurrent usage of jsonp!
    if(response.type === 'success')
      resolve(response.result);
    else if(response.type === 'failure')
      reject(new Error(response.error.message + response.error.stack));
    else
      reject(new Error('jsonp format error ....'));
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
    try {
      return await jsonp("http://50.1.98.138:3001/", request_object);  //50.1.98.138:3001
    } catch(e) {
      if(typeof e.message === 'string'  &&  ''.indexOf.call(e.message, 'Token used too late, ') === 0) {
        dont_confirm_before_unload();
        window.location.reload();
      }
      throw e;
    }
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
    type: 'input',
    input_type: 'text',
    id: 'description',
    title: 'Duties - Describe Briefly',
  },
  {
    type: 'input',
    input_type: 'hours',
    id: 'worked_hours',
    title: 'Daily Hours Worked',
  },
  {
    type: 'input',
    input_type: 'hours',
    id: 'holiday_hours',
    title: 'Holiday Hours',
  },
  {
    type: 'input',
    input_type: 'hours',
    id: 'vacation_hours',
    title: 'Vacation Hours',
  },
  {
    type: 'input',
    input_type: 'hours',
    id: 'flex_hours',
    title: 'Makeup (Flex) Hours',
  },
  {
    type: 'input',
    input_type: 'hours',
    id: 'sick_hours',
    title: 'Sick Hours',
  },
  {
    type: 'input',
    input_type: 'hours',
    id: 'jury_hours',
    title: 'Jury Hours',
  },
  {
    type: 'input',
    input_type: 'hours',
    id: 'bereavement_hours',
    title: 'Bereavement Hours',
  },
  {
    type: 'computed',
    id: 'weekly_hours',
    title: 'Weekly Hours',
  },
  {
    type: 'computed',
    id: 'approval_required',
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
    type: 'input',
    input_type: 'time',
    id: 'start_lunch',
    title: 'Start Lunch',
  },
  {
    type: 'input',
    input_type: 'time',
    id: 'end_lunch',
    title: 'End Lunch',
  },
  {
    type: 'computed',
    id: 'lunch_period',
    title: 'Lunch Period',
  },
  {
    type: 'input',
    input_type: 'yes_no',
    id: 'rest_period_observed',
    title: 'Rest period(s) observed',
  },
];
const column_numbers = {};
for(let j=0; j<columns.length; ++j)
  if(columns[j].id !== undefined)
    column_numbers[columns[j].id] = j;

const make_grid_cell_id = function(pp, row_number, column_id) {
  return {
    type: 'grid_data',
    pp,
    row_number,
    column_id,
  };
};

const widget_cache = {};  // See `get_grid_widget` below.

const {EMPTY_FINGERPRINT, fingerprint} = (function() {
  const column_ids = [];
  for(let j=0; j<columns.length; ++j)
    if(columns[j].type === 'input')
      column_ids.push(columns[j].id);
  column_ids.sort();

  const a = ['version 1'];
  for(let k=0; k<column_ids.length; ++k)
    a.push([ column_ids[k], '' ]);
  const EMPTY_FINGERPRINT = JSON.stringify(a);

  return {
    EMPTY_FINGERPRINT,
    fingerprint(pp, row_number) {
      assert(widget_cache[pp] !== undefined);
      const a = ['version 1'];
      for(let k=0; k<column_ids.length; ++k) {
        a.push([ column_ids[k],
                 widget_cache[pp].columns[column_numbers[column_ids[k]]].rows[row_number].input.value ]);
      }
      return JSON.stringify(a);
    },
  };
}());

const update_approval_columns = function(pp, i) {
  const widget = widget_cache[pp];
  for(let j=0; j<columns.length; ++j) {
    if(columns[j].type !== 'approval')
      continue;

    const column_id = columns[j].id;
    const scope = widget.columns[j].rows[i];
    if(scope.current_div !== null)
      scope.current_div.remove();
    const row_fingerprint = fingerprint(pp, i);
    if(scope.data !== null  &&  scope.data.fingerprint === row_fingerprint) {
      scope.approver_div.innerText = scope.data.email;
      scope.current_div = scope.unapprove_button_div;
    } else {
      if(row_fingerprint === EMPTY_FINGERPRINT)
        scope.current_div = null;
      else if(scope.disabled)
        scope.current_div = scope.disabled_div;
      else
        scope.current_div = scope.approve_button_div;
    }
    if(scope.current_div !== null)
      widget.master.appendChild(scope.current_div);
  }
};

const disable_approval_cells = function(pp, row_number) {
  for(let j=0; j<columns.length; ++j) {
    if(columns[j].type !== 'approval')
      continue;

    const column_id = columns[j].id;
    const widget = widget_cache[pp];
    assert(widget !== undefined);
    const scope = widget.columns[j].rows[row_number];

    scope.disabled = true;
  }
};


// Pick the current pay period.
let visible_pp = date2pp(new Date(new Date() - 8*60*60*1000));  // That's 8 hrs, roughly the pacific time zone


window.onload = async() => {


const sign_in_div = document.createElement('div');
document.body.innerText = 'Please sign in to view your timesheet.';
document.body.appendChild(document.createElement('br'));
document.body.appendChild(sign_in_div);

const google_user = await sign_in(sign_in_div);
login_token = google_user.getAuthResponse().id_token;

let all_changes_saved = true;
  // Possible values:
  //   true:  There are no user-edits anywhere that need to be sent to the server. Everything is clean.
  //   false: There are user-edits in the document that we haven't yet tried to send to the server.
  //   null:  We've sent some user-edits to the server, but haven't yet received a reply confirming receipt.
  //          Furthermore, there are no OTHER user-edits in the document. When we receive confirmation, then
  //          everything will be clean.
const all_changes_saved_div = document.createElement('div');
const update_allchangessaveddiv = () => {
  if(all_changes_saved === true) {
    all_changes_saved_div.innerText = 'All changes saved in "the cloud"';
    dont_confirm_before_unload();
  } else {  // could be false, could be null
    all_changes_saved_div.innerText = '...';
    confirm_before_unload();
  }
};
update_allchangessaveddiv();

// Returns {type:'valid',result:(...)} or {type:'invalid'} or {type:'blank'}
const get_input_value = function(column_id, day_code) {
  const r       = function(value) {return {type: 'valid', value};};
  const invalid = function(error) {return {type: 'invalid', column_id, day_code, error};};
  const BLANK   = {type: 'blank'};

  const pp = code2pp(day_code);
  const i = day_code - pp2code(pp);
  const j = column_numbers[column_id];
  const widget = widget_cache[pp];
  const value = (widget===undefined  ?  undefined  :  widget.columns[j].rows[i].input.value);
  if(columns[j].input_type === 'hours') {
    if(widget === undefined  ||  value === '')
      return r(0);
    else if(/^[0-9]+(\.[0-9]+)?$/.test(value))
      return r(parseFloat(value));
    else
      return invalid(value);
  } else if(columns[j].input_type === 'yes_no') {
    if(widget === undefined  ||  value === '')
      return BLANK;
    else if(''.toUpperCase.call(value) === 'YES')
      return r(true);
    else if(''.toUpperCase.call(value) === 'NO')
      return r(false);
    else
      return invalid(value);
  } else if(columns[j].input_type === 'text') {
    return r(value);
  } else if(columns[j].input_type === 'time') {
    if(widget === undefined  ||  value === '')
      return BLANK;

    const matches = /^(1?[0-9]):([0-5][0-9]) ?([aApP])[mM]$/.exec(value);
    if(matches === null)
      return invalid('bad time format: ' + value);

    const hours = parseFloat(matches[1]);
    const minutes = parseFloat(matches[2]);
    const am_pm = ''.toUpperCase.call(matches[3]);
    if(hours < 1  ||  hours > 12)
      return invalid('nonsensical time: ' + value);

    return r(minutes + 60*hours + (am_pm==='P' ? 12*60 : 0) + (hours===12 ? -12*60 : 0));
  } else {
    throw new Error('unrecognized column input type: ' + columns[j].input_type);
  }
};

// Remember: 0 is Sunday, 1 is Monday, ..., 6 is Saturday.
const update_computed_columns = function() {
  const code2weekday = (day_code) => code2date(day_code).getUTCDay();
  const loaded = (day_code) => (widget_cache[code2pp(day_code)] !== undefined);

  // The following memoized function is kind of like a weird way of representing a spreadsheet with formulas.
  const cache = {};
  const stack = [];
  const get = function(column_id, day_code) {
    assert(column_id !== undefined  &&  day_code !== undefined);

    const key = JSON.stringify([column_id, day_code]);

    if(cache[key] !== undefined)
      return cache[key];

    return cache[key] = (function() {


    // Check for circular dependency
    for(let x of stack)
      if(x === key)
        throw new Error('circular dependency');

    stack.push(key);  try {
      const pp = code2pp(day_code);
      const i = day_code - pp2code(pp);
      const j = column_numbers[column_id];  // Might be undefined, if column_id is not a "real" column
      if(j !== undefined  &&  columns[j].type === 'approval') {
        if(widget_cache[pp] === undefined)
          return null;
        else
          return widget_cache[pp].columns[j].rows[i].data;
      } else if(j !== undefined  &&  columns[j].type === 'input') {
        return get_input_value(column_id, day_code);
      } else if(column_id === 'running_weekly_hours') {  // Not a real column
        const worked_hours_today = get('worked_hours', day_code);

        if(code2weekday(day_code) === 1) {
          return worked_hours_today;
        } else {
          const total_so_far = get('running_weekly_hours', day_code - 1);
          if(total_so_far.type !== 'valid'  ||  worked_hours_today.type !== 'valid')
            return {type: 'invalid', error: [total_so_far.error, worked_hours_today.error]};
          else
            return {type: 'valid', value: total_so_far.value + worked_hours_today.value};
        }
      } else if(column_id === 'running_days_worked') {  // Not a real column
        const worked_hours_today = get('worked_hours', day_code);
        const amount = (worked_hours_today.value > 0  ?  1  :  0)

        if(code2weekday(day_code) === 1) {
          if(worked_hours_today.type === 'valid')
            return {type: 'valid', value: amount};
          else
            return worked_hours_today;
        } else {
          const total_so_far = get('running_days_worked', day_code - 1);
          if(total_so_far.type !== 'valid'  ||  worked_hours_today.type !== 'valid')
            return {type: 'invalid', error: [total_so_far.error, worked_hours_today.error]};
          else
            return {type: 'valid', value: total_so_far.value + amount};
        }
      } else if(column_id === 'running_regular_hours') {  // Not a real column
        const hours_today = get('regular_hours', day_code);

        if(code2weekday(day_code) === 1) {
          if(hours_today === '')
            return {type: 'invalid', column_id: 'regular_hours', day_code, error: ''};
          else
            return {type: 'valid', value: hours_today};
        } else {
          const total_so_far = get('running_regular_hours', day_code - 1);
          if(total_so_far.type !== 'valid'  ||  hours_today === '')
            return {type: 'invalid', error: [total_so_far.error, hours_today]};
          else
            return {type: 'valid', value: total_so_far.value + hours_today};
        }
      } else if(column_id === 'weekly_hours') {
        if(code2weekday(day_code) === 0  ||  i === pp_length(pp)-1) {  // If Sunday or last day of pay period
          const v = get('running_weekly_hours', day_code);
          if(v.type === 'valid')
            return v.value;
          else
            return "can't compute";
        } else {
          return '';
        }
      } else if(column_id === 'regular_hours') {
        const worked = get('worked_hours', day_code);
        if(worked.type === 'valid') {
          if(code2weekday(day_code) === 1) {
            return Math.min(worked.value, 8);
          } else if(get('running_days_worked', day_code).value === 7) {
            return 0;
          } else {
            const running = get('running_regular_hours', day_code - 1);
            if(running.type === 'valid') {
              return Math.min(worked.value, 8, 40 - running.value);
            } else {
              return '';
            }
          }
        } else {
          return '';
        }
      } else if(column_id === 'overtime_hours') {
        const worked = get('worked_hours', day_code);
        const reg_h = get('regular_hours', day_code);
        const dt_h = get('doubletime_hours', day_code);
        if(worked.type !== 'valid'  ||  reg_h === ''  ||  dt_h === '')
          return '';
        else
          return worked.value - reg_h - dt_h;
      } else if(column_id === 'doubletime_hours') {
        const worked = get('worked_hours', day_code);
        if(worked.type === 'valid') {
          if(code2weekday(day_code) === 0)
            return Math.max(0, worked.value - 8);
          else
            return Math.max(0, worked.value - 12);
        } else {
          return '';
        }
      } else if(column_id === 'approval_required') {
        const ot_h = get('overtime_hours', day_code);
        const dt_h = get('doubletime_hours', day_code);
        if(ot_h !== ''  &&  dt_h !== ''  &&  (ot_h > 0  ||  dt_h > 0))
          return 'YES';
        else
          return '';
      } else if(column_id === 'lunch_period') {
        const start = get('start_lunch', day_code);
        const end = get('end_lunch', day_code);
        if(start.type === 'valid'  &&  end.type === 'valid')
          return end.value - start.value;
        else
          return '';
      } else {
        throw new Error('unrecognized column id: ' + column_id);
      }
    } finally {
      stack.pop();
    }


    }());
  };

  for(let pp in widget_cache) {
    pp = pp | 0;  // Without this line, `pp` will be a string instead of an integer.
    const len = pp_length(pp);
    for(let j=0; j<columns.length; ++j) {
      for(let i=0; i<len; ++i) {
        const scope = widget_cache[pp].columns[j].rows[i];
        const day_code = pp2code(pp) + i;
        if(columns[j].type === 'computed') {
          try {
            scope.div.innerText = get(columns[j].id, day_code);
          } catch(e) {
            console.error(e);
            scope.div.innerText = 'error';
          }

          if(columns[j].id === 'approval_required') {
            if(get('approval_required', day_code) === 'YES'  &&  get('director_approval', day_code) === null)
              scope.div.style.backgroundColor = 'pink';
            else
              scope.div.style.backgroundColor = '';
          }
        } else if(columns[j].id === 'start_lunch'  ||  columns[j].id === 'end_lunch') {
          const worked = get('worked_hours', day_code);
          const this_cell = get(columns[j].id, day_code);
          if(worked.type === 'valid'  &&  worked.value > 6  &&  this_cell.type !== 'valid')
            scope.input.style.backgroundColor = 'pink';
          else
            scope.input.style.backgroundColor = '';
        } else if(columns[j].id === 'rest_period_observed') {
          const worked = get('worked_hours', day_code);
          const observed = get('rest_period_observed', day_code);
          if(worked.type === 'valid'  &&  worked.value > 4  &&  observed.type !== 'valid')
            scope.input.style.backgroundColor = 'pink';
          else
            scope.input.style.backgroundColor = '';
        } else if(columns[j].type === 'input') {
          if(get(columns[j].id, day_code).type === 'invalid')
            scope.input.style.backgroundColor = 'pink';
          else
            scope.input.style.backgroundColor = '';
        }
      }
    }
  }
};

// This function bunches up a bunch of update tasks that often must happen together.
const update_row = function(pp, row_number) {
  update_approval_columns(pp, row_number);
  update_allchangessaveddiv();
  update_computed_columns();
};

// get_grid_widget is a memoized function.  It takes a pay-period-number and returns an info object.
// The memo is `widget_cache`, above. The cache is global because some other code wants to iterate over it.
const get_grid_widget = (function() {
  // Constructs a widget and returns a nice data structure describing lots of stuff about it.
  const make_a_new_one = function(pp) {
    const result = {};
    const master = result.master = document.createElement('div');

    result.columns = [];
    for(let j=0; j<columns.length; ++j) {
      const column_id = columns[j].id;

      // Create column heading
      if(columns[j].title !== undefined) {
        const div = document.createElement('div');
        div.innerText = columns[j].title;
        div.style.position = 'absolute';
        div.style.left     = `${j * 60}px`;
        div.style.top      = '0px';
        div.style.width    = '60px';
        div.style.height   = '30px';
        div.style.overflow = 'hidden';
        master.appendChild(div);
      }

      const pp_date = pp2date(pp);
      const month_number = pp_date.getUTCMonth() + 1;  //+1 because getUTCMonth returns 0-based month number
      const pp_first_day = pp_date.getUTCDate();

      result.columns.push({rows: []});
      const len = pp_length(pp);
      for(let i=0; i<len; ++i) {
        const scope = {};
        result.columns[j].rows.push(scope);

        if(columns[j].type === 'approval') {
          scope.data = null;  // Either null or {email: (string), fingerprint: (string)}
          scope.disabled = false;
          scope.current_div = null;

          const approve_button_div = document.createElement('div');
          scope.approve_button_div = approve_button_div;
          const s2 = approve_button_div.style;  // just for short-hand ...
          s2.position = 'absolute';
          s2.left     = `${j * 60}px`;
          s2.top      = `${(i+1) * 30}px`;
          s2.width    = '60px';
          s2.height   = '30px';
          const approve_button = document.createElement('button');
          approve_button.innerText = 'Approve';
          approve_button.style.width = '60px';
          approve_button.onclick = function() {
            scope.data = {email: 'loading', fingerprint: fingerprint(pp, i)};
            scope.dirty = true;
            all_changes_saved = false;
            update_row(pp, i);
          };
          approve_button_div.appendChild(approve_button);

          const unapprove_button_div = document.createElement('div');
          scope.unapprove_button_div = unapprove_button_div;
          const s3 = unapprove_button_div.style;  // just for short-hand ...
          s3.position = 'absolute';
          s3.left     = `${j * 60}px`;
          s3.top      = `${(i+1) * 30}px`;
          s3.width    = '60px';
          s3.height   = '30px';
          s3.overflow = 'hidden';
          const approver_div = document.createElement('div');
          scope.approver_div = approver_div;
          unapprove_button_div.appendChild(approver_div);
          const unapprove_button = document.createElement('button');
          unapprove_button.innerText = 'x';
          const s4 = unapprove_button.style;  // just for short-hand ...
          s4.position = 'absolute';
          s4.right    = '0';
          s4.top      = '0';
          s4.width    = '15px';
          s4.height   = '30px';
          unapprove_button.onclick = function() {
            scope.data = null;
            scope.dirty = true;
            all_changes_saved = false;
            update_row(pp, i);
          };
          unapprove_button_div.appendChild(unapprove_button);

          const disabled_div = document.createElement('div');
          scope.disabled_div = disabled_div;
          const s5 = disabled_div.style;  // just for short-hand ...
          s5.position = 'absolute';
          s5.left     = `${j * 60}px`;
          s5.top      = `${(i+1) * 30}px`;
          s5.width    = '60px';
          s5.height   = '30px';
          const disabled_button = document.createElement('button');
          disabled_button.innerText = 'Approve';
          disabled_button.style.width = '60px';
          disabled_button.setAttribute('disabled', 'disabled');
          disabled_button.setAttribute('title',
              'This row has changed recently. Please refresh the page before approving.' );
          disabled_div.appendChild(disabled_button);
        } else if(columns[j].type === 'computed') {
          const div = document.createElement('div');
          scope.div = div;
          div.style.position = 'absolute';
          div.style.left     = `${j * 60}px`;
          div.style.top      = `${(i+1) * 30}px`;
          div.style.width    = '60px';
          div.style.height   = '30px';
          div.style.overflow = 'hidden';
          master.appendChild(div);
        } else if(columns[j].type === 'computed_date') {
          const div = document.createElement('div');
          div.innerText = month_number + '/' + (pp_first_day + i);
          div.style.position = 'absolute';
          div.style.left     = `${j * 60}px`;
          div.style.top      = `${(i+1) * 30}px`;
          div.style.width    = '60px';
          div.style.height   = '30px';
          master.appendChild(div);
        } else if(columns[j].type === 'input') {
          const input = document.createElement('input')
          scope.input = input;
          input.style.position = 'absolute';
          input.style.left     = `${j * 60}px`;
          input.style.top      = `${(i+1) * 30}px`;
          input.style.width    = '60px';
          input.style.height   = '30px';
          scope.dirty = false;
          input.addEventListener('input', function(_) {
            scope.dirty = true;
            disable_approval_cells(pp, i);
            all_changes_saved = false;
            update_row(pp, i);
          });
          master.appendChild(input);
        } else {
          // Can't assert this yet because some code is yet unfinished ...
          //assert(columns[j].type === 'blank');
          // do nothing in this case
        }
      }
    }
    return result;
  };

  // Here is the memoized function.
  return function(pp) {
    if(widget_cache[pp] === undefined)
      widget_cache[pp] = make_a_new_one(pp);
    return widget_cache[pp];
  };
}());

const container = document.createElement('div');
container.style.position = 'relative';
container.style.font = '10px sans-serif';
const update_container = function() {
  container.innerHTML = '';   container.appendChild(get_grid_widget(visible_pp).master);
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
  update_computed_columns();
};

const next_pp_button = document.createElement('button');
next_pp_button.innerText = 'Next pay period';
next_pp_button.onclick = () => {
  ++visible_pp;
  update_container();
  update_whichppdiv();
  update_computed_columns();
};

document.body.appendChild(all_changes_saved_div);
document.body.appendChild(prev_pp_button);
document.body.appendChild(next_pp_button);
document.body.appendChild(which_pp_div);
document.body.appendChild(container);

let doc_version_number = -1;

// Continually send requests to the server, thus synchronizing data in both places.
for(;;) {
  try {  // Don't allow errors to stop us!

    // Tell the server about stuff that has been changed by the user.
    const msg = {
      type: 'sync',
      doc_version_number,
      diffs: [],
    };
    const prev_allchangessaved = all_changes_saved;
    assert(all_changes_saved === !!all_changes_saved);  // It can only be null while waiting for server.
    if(all_changes_saved === false)
      all_changes_saved = null;  // null means we're currently waiting for the server to confirm receipt.
    // If we fail to communicate with the server, then we'll want to re-dirty-ify the cells
    // that we've un-dirty-ified in this upcoming loop. Thus, we remember them in `rollback_tasks`.
    const rollback_tasks = [function() {
      if(all_changes_saved === null) {
        all_changes_saved = prev_allchangessaved;
      } else {
        // If it's not null, then it must be either:
        //   false, because the user edited something while we were waiting for a server reply. Or:
        //   true, because there were no user-edits at all in the first place.
      }
    }];
    for(let pp in widget_cache) {
      pp = pp | 0;  // Without this line, `pp` will be a string instead of an integer.

      for(let j=0; j<columns.length; ++j) {
        if(columns[j].type !== 'input'  &&  columns[j].type !== 'approval')
          continue;

        const len = pp_length(pp);
        for(let i=0; i<len; ++i) {
          const scope = widget_cache[pp].columns[j].rows[i];
          if(!scope.dirty)
            continue;

          const value = (columns[j].type === 'input' ? scope.input.value : scope.data);
          msg.diffs.push({
            cell_id: make_grid_cell_id(pp, i, columns[j].id),
            value: value,
          });
          scope.dirty = false;
          rollback_tasks.push(() => {scope.dirty = true;});
        }
      }
    }

    // Talk to the server
    let reply = null;
    try {
      reply = await to_server(msg);
    } catch(e) {
      for(let k=0; k<rollback_tasks.length; ++k)
        rollback_tasks[k]();
      throw e;
    }

    const old_dvn = doc_version_number;
    doc_version_number = reply.doc_version_number;

    // Update the UI according to what the server said has changed.
    for(let diff of reply.diffs) {
      if(diff.cell_id.type !== 'grid_data')
        throw new Error('unimplemented diff type: ' + diff.cell_id.type);

      const {pp, column_id, row_number} = diff.cell_id;
      const widget = get_grid_widget(pp);
      const j = column_numbers[column_id];
      if(j === undefined) {
        console.warn('server gave me a bad column_id: ' + column_id);
        continue;
      }
      const scope = widget.columns[j].rows[row_number];

      // Update the UI to show the new value of the cell.
      if(columns[j].type === 'input') {
        // Disable approval cells in a row when the row changes. This helps prevent erroneous approvals.
        if(old_dvn !== -1)  // Don't need to do it if we're just loading data for the first time ...
          disable_approval_cells(pp, row_number);

        if(!scope.dirty)
          scope.input.value = diff.value;
      } else if(columns[j].type === 'approval') {
        scope.data = diff.value;
      } else {
        throw new Error('weird diff; for column type: ' + columns[j].type);
      }
      update_approval_columns(pp, row_number);
    }
    update_computed_columns();

    if(all_changes_saved === null) {  // It could be false by now, due to user edits in the meantime.
      all_changes_saved = true;
      update_allchangessaveddiv();
    }

  } catch(e) {
    console.error(e);
  }

  await sleep(Math.floor(Math.random() * 2000) + 2000);  // Sleep for a few seconds
}


};
