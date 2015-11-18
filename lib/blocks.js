'use strict';
const _             = require('lodash');
const EventEmitter  = require('events');
const moment        = require('moment');
const util          = require('./util');
const cst           = require('./constants');
const clients       = require('./clients');


// Abstract block
// Emits 'update' events
// Output should be stored in this._output
class Block extends EventEmitter {
  constructor() {
    super();
    this._output = cst.STR_UNINIT;   // Uninitialized
  }

  // Should update block output state and emit an 'update' event
  // abstract update();

  query() {
    return this._output;
  }
}


// Abstract block which updates every tick seconds
class TickBlock extends Block {
  constructor(delay, tick) {
    super();

    // Wait until the delay
    setTimeout(() => {
      // Update once more
      this.update();
      // Set an interval to update on the tick
      setInterval(() => {
        this.update();
      }, tick);
    }, delay);

    this.update();
  }
}


// Abstract block which updates via an i3 ipc connection
class I3Block extends Block {
  constructor() {
    super();
    this._do_registration();
    this.update();
  }

  // Here is where all callback registration should be done
  // abstract _do_registration();

  // Registers a this.update to the i3 connection
  _register(events) {
    for (let e of events)
      clients.i3.on(e, (data) => { this.update(); });
  }
}


// Updates time once a minute, on the minute
class DatetimeBlock extends TickBlock {
  constructor() {
    let m = moment();
    let delay = (60 * 1000) - (m.millisecond() + m.second() * 1000);
    super(delay, 60 * 1000);
  }

  update() {
    this._output = moment().locale(cst.DT_LOCALE).format(cst.DT_FMT);
    this.emit('update');
  }
}


class WorkspaceBlock extends I3Block {
  _do_registration() {
    this._register(['workspace']);
  }

  update() {
    clients.i3.workspaces((err, data) => {
      if (err) {
        this.emit('error', err);
        return;
      }
      
      this._output = data.map(function(space) {
        let current = space.name.split(':').slice(1).join('') || space.name;
        
        if (space.focused)
          current = `%{+u}${current}%{-u}`;
        current = `%{A:i3-msg workspace "${space.name.replace(':', '\\:')}":}` +
                  ` ${current} %{A}`;
        if (space.urgent)
          current = `%{B${cst.C_URGENT}}${current}%{B-}`;

        return current;
      }).join('');
      
      this.emit('update');
    });
  }
}


class TitleBlock extends I3Block {
  _do_registration() {
    this._register(['window', 'workspace::focus']);
  }

  update() {
    clients.i3.tree((err, data) => {
      if (err) {
        this.emit('error', err);
        return;
      }

      this._output = _.trunc(util.findFocused(data).name, {
        'length':     cst.TITLE_MAXLEN,
        'omission':   cst.TITLE_TRUNC
      });
      this.emit('update');
    });
  }
}


module.exports = {
  Block:              Block,
  TickBlock:          TickBlock,
  I3Block:            I3Block,
  DatetimeBlock:      DatetimeBlock,
  WorkspaceBlock:     WorkspaceBlock,
  TitleBlock:         TitleBlock,
};
