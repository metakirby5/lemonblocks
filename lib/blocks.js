'use strict';

const _             = require('lodash');
const EventEmitter  = require('events');
const process       = require('process');
const childProcess  = require('child_process');

const async         = require('async');
const moment        = require('moment');
const linuxBattery  = require('linux-battery');
const mpdCmd        = require('mpd').cmd;

const util          = require('./util');
const config        = require('./config');
const clients       = require('./clients');

// Allow more listeners
process.setMaxListeners(0);


// Abstract block
// Emits 'update' events
// Output should be stored in this._output
// Updates on SIGUSR1 if class name is in blocks to be updated
class Block extends EventEmitter {
  constructor() {
    super();
    this._output = ` ${config.get('strLoading')} `;

    // Update block on SIGUSR1
    process.on('SIGUSR1', () => {
      util.getUpdateBlocks((err, blocks) => {
        if (err) {
          this.emit('error', err);
          return;
        }

        if (blocks.indexOf(this.constructor.name) > -1)
          this.update();
      });
    });
  }

  // Should update block output state and emit an 'update' event
  // abstract update();

  query() {
    return this._output ? util.addBG(util.toggleAttr(this._output, 'u'), 'cBG') : '';
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

  // Manual override: no block styling
  query() {
    return this._output;
  }
}


// Abstract block which updates at intervals
class IntervalBlock extends Block {
  constructor(interval, delay) {
    super();

    // Default for delay
    delay = delay || 0;

    // Wait until the delay
    setTimeout(() => {
      this.update();

      // Set an interval to update on the interval
      setInterval(this.update.bind(this), interval);
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
  }

  // Here is where all callback registration should be done
  // abstract _do_registration();

  // Registers a this.update to the emitter for each event
  _register(events) {
    for (let e of events)
      this.emitter.on(e, this.update.bind(this));

    // Update once initially - needs to be here in case of a
    // ready callback
    this.update();
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


// Abstract block which updates via an mpd connection
class MpdBlock extends EventBlock {
  constructor() {
    super(clients.mpd);
  }
}


// Updates time once a minute, on the minute
class DatetimeBlock extends IntervalBlock {
  constructor() {
    let m = moment();
    let delay =(60 * 1000) -
      (m.millisecond() + m.second() * 1000) +
      config.get('fudgeTimeout');
    super(60 * 1000, delay);
  }

  update() {
    this._output = ` ${
      moment().locale(config.get('dtLocale')).format(config.get('dtFmt'))
    } `;
    this.emit('update');
  }
}


class ProcBlock extends IntervalBlock {
  // procMap = { process: displayAs }
  constructor(procMap, interval) {
    super(interval || config.get('refreshFreq'));
    this.procMap = procMap;
  }

  update() {
    async.parallel(_.pairs(this.procMap).map((kvs) => {
      return (cb) => {
        let process   = kvs[0],
            displayAs = ` ${kvs[1] || process} `;
        childProcess.spawn('pgrep', ['-x', process]).on('close', (code) => {
          cb(null, code ? util.addBG(displayAs, 'cUrgent', 'cBG') : displayAs);
        });
      }
    }), (err, results) => {
      this._output = `${results.join('')}`;
      this.emit('update');
    });
  }
}


// Updates once an hour
class YumUpdateBlock extends IntervalBlock {
  constructor() {
    super(config.get('yumUpdateFreq'));
  }

  update() {
    childProcess.exec('yum check-update | sed \'1,/^$/d\' | wc -l', (err, out) => {
      if (err) {
        this.emit('error', err);
        return;
      }

      let updates = Number.parseInt(out.trim());
      let output = ` ${updates} `;

      // Accent if updates
      if (updates)
        output = util.addBG(output, 'cAccent');

      output = util.addAction(output,
          `${config.get('termExec')} sudo yum update`);

      this._output = output;
      this.emit('update');
    });
  }
}


class WorkspaceBlock extends I3Block {
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
        let current = ` ${
          space.name.split(':').slice(1).join('') || space.name
        } `;
        
        current = util.addAction(current, `i3-msg workspace "${space.name}"`);

        if (space.focused)
          return util.addBG(current, 'cAccent');
        else if (space.urgent)
          return util.addBG(current, 'cUrgent');
        else
          return util.addBG(current, 'cBG');
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
    this.emitter.tree((err, data) => {
      if (err) {
        this.emit('error', err);
        return;
      }

      this._output = ` ${_.trunc(util.findFocused(data).name, {
        length:     config.get('maxLen'),
        omission:   config.get('trunc')
      })} `;

      this.emit('update');
    });
  }
}


class I3ModeBlock extends I3Block {
  constructor() {
    super();
  }

  _do_registration() {
    this._register(['mode']);
  }

  update(e) {
    this._output = (!e || e.change === 'default') ?
      '' : util.addBG(` ${e.change} `, 'cUrgent');
    this.emit('update');
  }
}


class BatteryBlock extends AcpiBlock {
  constructor() {
    super();

    // Update status periodically
    setInterval(this.update.bind(this), config.get('refreshFreq'));
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
        let percent = Number.parseInt(bat.percentage.replace(/[^\d]/, ''));
        stats.push(percent);

        let output = ` ${stats.join(' ')} `;

        // Critical
        if (percent <= config.get('batCritical') && bat.state !== 'charging')
          output = util.addBG(output, 'cUrgent');

        this._output = output;
        this.emit('update');
      });
    }, config.get('fudgeTimeout'));
  }
}


class VolumeBlock extends AcpiBlock {
  _do_registration() {
    this._register([
        'button/volumeup',
        'button/volumedown',
        'button/mute',
        'jack/headphone',
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

        let matches = out.match(/\[(\d{1,3})%\] \[(on|off)\]$/m);
        let output = ` ${matches[1]} `;
        if (matches[2] === 'off')
          output = util.addBG(output, 'cUrgent');

        // Commands
        // Toggle mute
        output = util.addAction(output, 'amixer set Master toggle', 1,
            [this.constructor.name]);
        // Volume up
        output = util.addAction(output,
            `amixer set Master ${config.get('volPercent')}%+`, 4,
            [this.constructor.name]);
        // Volume down
        output = util.addAction(output,
            `amixer set Master ${config.get('volPercent')}%-`, 5,
            [this.constructor.name]);

        this._output = output;
        this.emit('update');
      });
    }, config.get('fudgeTimeout'));
  }
}


class SsidBlock extends EventBlock {
  constructor() {
    super(clients.iwevent);

    // Update status periodically
    setInterval(this.update.bind(this), config.get('refreshFreq'));
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
        let output = ` ${
          _.trunc(err ? 'disconnected' : out.match(/ESSID:"(.*?)"$/m)[1], {
            length:     config.get('maxSsidLen'),
            omission:   config.get('trunc')
          })
        } `;

        // Disconnected -> critical
        if (err)
          output = util.addBG(output, 'cUrgent');

        output = util.addAction(output, `${config.get('termExec')} nmtui`);

        this._output = output;
        this.emit('update');
      });
    }, config.get('netFudgeTimeout'));
  }
}

class CurrentSongBlock extends MpdBlock {
  _do_registration() {
    this.emitter.on('ready', () => {
      this._register(['system-player', 'system-playlist']);
    });
  }

  update() {
    this.emitter.sendCommand(mpdCmd('currentsong', []), (err, data) => {
      if (err) {
        this.emit('error', err);
        return;
      }

      if (data) {
        let stats = [];

        let matches  = [
          data.match(/^Title: (.*?)$/m) || data.match(/^file: (.*?)$/m),
          data.match(/^Artist: (.*?)$/m)
        ];

        matches.forEach((match) => {
          if (match)
            stats.push(match[1]);
        });

        this._output = ` ${_.trunc(stats.join(' - '), {
          length:     config.get('maxLen'),
          omission:   config.get('trunc')
        })} `;
      } else {
        // Nothing playing
        this._output = ' no tunes ';
      }

      this.emit('update');
    });
  }
}

class PlayStatusBlock extends MpdBlock {
  _do_registration() {
    this.emitter.on('ready', () => {
      this._register(['system-player', 'system-playlist', 'system-options']);
    });
  }

  update() {
    if (this.fudge)
      clearTimeout(this.fudge);
    this.fudge = setTimeout(() => {
      this.emitter.sendCommand(mpdCmd('status', []), (err, data) => {
        if (err) {
          this.emit('error', err);
          return;
        }

        if (data) {
          let playing = '♪';
          let playingMatch = data.match(/^state: (.*?)$/m);
          if (playingMatch) {
            switch (playingMatch[1]) {
              case 'play':
                playing = '▶';
                break;
              case 'pause':
                playing = '‖';
                break;
              case 'stop':
                playing = '■';
                break;
              default:
                // Do nothing
            }
          }

          this._output = util.addAction(` ${playing} `, 'mpc toggle');
        } else {
          // Nothing playing
          this._output = ' ♪ ';
        }

        this.emit('update');
      });
    }, config.get('mpdFudgeTimeout'));
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
  ProcBlock:          ProcBlock,
  YumUpdateBlock:     YumUpdateBlock,
  WorkspaceBlock:     WorkspaceBlock,
  TitleBlock:         TitleBlock,
  I3ModeBlock:        I3ModeBlock,
  BatteryBlock:       BatteryBlock,
  VolumeBlock:        VolumeBlock,
  SsidBlock:          SsidBlock,
  CurrentSongBlock:   CurrentSongBlock,
  PlayStatusBlock:    PlayStatusBlock,
};

