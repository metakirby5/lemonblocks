'use strict';

const _             = require('lodash');
const EventEmitter  = require('events');
const childProcess  = require('child_process');

const moment        = require('moment');
const linuxBattery  = require('linux-battery');

const util          = require('./util');
const cst           = require('./constants');
const clients       = require('./clients');


// Abstract block
// Emits 'update' events
// Output should be stored in this._output
class Block extends EventEmitter {
  constructor() {
    super();
    this._output = cst.STR_LOADING;
  }

  // Should update block output state and emit an 'update' event
  // abstract update();

  query() {
    return this._output;
  }
}


// Static block
class StaticBlock extends Block {
  constructor(text) {
    super();
    this._output = text;
  }

  update() {
    this.emit('update');
  }
}


// Abstract block which updates at intervals
class IntervalBlock extends Block {
  constructor(delay, interval) {
    super();

    // Wait until the delay
    setTimeout(() => {
      // Update once more
      this.update();
      // Set an interval to update on the interval
      setInterval(() => {
        this.update();
      }, interval);
    }, delay);

    // Update once initially
    this.update();
  }
}


// Abstract block which updates via an event emitter
class EventBlock extends Block {
  constructor(emitter) {
    super();
    this.emitter = emitter;
    this._do_registration();

    // Update once initially
    this.update();
  }

  // Here is where all callback registration should be done
  // abstract _do_registration();

  // Registers a this.update to the i3 connection
  _register(events) {
    for (let e of events)
      this.emitter.on(e, (data) => { this.update(); });
  }
}


// Abstract block which updates via an i3 ipc connection
class I3Block extends EventBlock {
  constructor() {
    super(clients.i3);
  }
}


// Abstract block which updates via an acpi connection
class AcpiBlock extends EventBlock {
  constructor() {
    super(clients.acpi);
  }
}


// Updates time once a minute, on the minute
class DatetimeBlock extends IntervalBlock {
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
  constructor(separator) {
    super();
    this.separator = separator || ' ';
  }

  _do_registration() {
    this._register(['workspace']);
  }

  update() {
    this.emitter.workspaces((err, data) => {
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
      }).join(this.separator);
      
      this.emit('update');
    });
  }
}


class TitleBlock extends I3Block {
  _do_registration() {
    this._register(['window', 'workspace::focus']);
  }

  update() {
    this.emitter.tree((err, data) => {
      if (err) {
        this.emit('error', err);
        return;
      }

      this._output = _.trunc(util.findFocused(data).name, {
        length:     cst.TITLE_MAXLEN,
        omission:   cst.TITLE_TRUNC
      });

      this.emit('update');
    });
  }
}


class BatteryBlock extends AcpiBlock {
  constructor(separator) {
    super();

    this.separator = separator || ' ';

    // Update status periodically
    setInterval(() => {
      this.update();
    }, cst.BAT_INTERVAL);
  }

  _do_registration() {
    this._register(['ac_adapter']);
  }

  update() {
    // Set a fudge timeout
    if (this.fudge)
      clearTimeout(this.fudge);
    this.fudge = setTimeout(() => {
      linuxBattery().then((batteries) => {
        let bat = batteries[0]; // Grab the first battery
        let stats = [];

        // Time until...
        let time = bat.timeToEmpty || bat.timeToFull;
        if (time)
          stats.push(time.replace(/\s*([a-z])[a-z]*/, '$1'));

        // Charging status
        let state;
        switch (bat.state) {
          case 'fully-charged':
            state = '✓';
            break;
          case 'charging':
            state = '↑';
            break;
          case 'discharging':
            state = '↓';
            break;
          default:
            // Do nothing
        }
        if (state)
          stats.push(state);

        // Percent
        stats.push(bat.percentage.replace(/[^\d]/, ''));

        this._output = stats.join(this.separator);
        this.emit('update');
      });
    }, cst.FUDGE_TIMEOUT);
  }
}


class VolumeBlock extends AcpiBlock {
  _do_registration() {
    this._register([
        'button/volumeup',
        'button/volumedown',
        'button/mute',
    ]);
  }

  update() {
    // Set a fudge timeout
    if (this.fudge)
      clearTimeout(this.fudge);
    this.fudge = setTimeout(() => {
      childProcess.exec('amixer get Master', (err, out) => {
        if (err) {
          this.emit('error', err);
          return;
        }

        let matches = out.match(/\[(\d{1,3})%\] \[(on|off)\]/);
        let state = matches[1];
        if (matches[2] === 'off')
          state = `%{B${cst.C_URGENT}}${state}%{B-}`;

        this._output = state;
        this.emit('update');
      });
    }, cst.FUDGE_TIMEOUT);
  }
}


class SsidBlock extends EventBlock {
  constructor() {
    super(clients.iwevent);
  }

  _do_registration() {
    this._register(['New Access Point']);
  }

  // TODO: detect if airplane mode is on or not
  update() {
    // Set a fudge timout
    if (this.fudge)
      clearTimeout(this.fudge);
    this.fudge = setTimeout(() => {
      childProcess.exec('iwgetid', (err, out) => {
        // err means no ssid
        this._output = err ? 'disconnected' : out.match(/ESSID:"(.*)"/)[1];
        this.emit('update');
      });
    }, cst.NET_FUDGE_TIMEOUT);
  }
}


module.exports = {
  Block:              Block,
  StaticBlock:        StaticBlock,
  IntervalBlock:      IntervalBlock,
  EventBlock:         EventBlock,
  I3Block:            I3Block,
  AcpiBlock:          AcpiBlock,
  DatetimeBlock:      DatetimeBlock,
  WorkspaceBlock:     WorkspaceBlock,
  TitleBlock:         TitleBlock,
  BatteryBlock:       BatteryBlock,
  VolumeBlock:        VolumeBlock,
  SsidBlock:          SsidBlock,
};
