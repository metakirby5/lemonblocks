'use strict';
const _             = require('lodash');
const EventEmitter  = require('events');
const moment        = require('moment');
const clients       = require('./clients');
const cst           = require('./constants');


// Abstract block
// Emits 'update' events
class Block extends EventEmitter {
  // Should update block output state and emit an 'update' event
  // abstract update();

  // Should return block output with minimal logic involved
  // abstract query();
}


// Abstract block which updates every tick seconds
class TickBlock extends Block {
  constructor(delay, tick) {
    super();
    this.update();

    // Wait until the delay
    setTimeout(() => {
      // Update once more
      this.update();
      this.emit('update');
      // Set an interval to update on the tick
      setInterval(() => {
        this.update();
        this.emit('update');
      }, tick);
    }, delay);
  }
}


// Abstract block which updates via an i3 ipc connection
class I3Block extends Block {
  constructor() {
    super();
    this.do_registration();
    this.update();
  }

  // Here is where all callback registration should be done
  // abstract do_registration();

  // Registers a this.update to the i3 connection
  register(events) {
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
    this.dtStr = moment().locale(cst.DT_LOCALE).format(cst.DT_FMT);
  }

  query() {
    return this.dtStr;
  }
}


class WorkspaceBlock extends I3Block {
  do_registration() {
    this.register(['workspace']);
  }

  update() {
    clients.i3.workspaces((err, data) => {
      if (err) {
        this.emit('error', err);
        return;
      }
      
      this.spacesStr = data.map(function(space) {
        let current = _.slice(space.name.split(':'), 1).join('') || space.name;
        
        if (space.focused)
          current = `%{+u}${current}%{-u}`;
        current = `%{A:i3-msg workspace "${current.replace(':', '\\:')}":}` +
                  ` ${current} %{A}`;
        if (space.urgent)
          current = `%{B${cst.C_URGENT}}${current}%{B-}`;

        return current;
      }).join('');
      
      this.emit('update');
    });
  }

  query() {
    return this.spacesStr;
  }
}


module.exports = {
  Block:              Block,
  TickBlock:          TickBlock,
  I3Block:            I3Block,
  DatetimeBlock:      DatetimeBlock,
  WorkspaceBlock:     WorkspaceBlock,
};
