'use strict';

const _             = require('lodash');
const EventEmitter  = require('events');
const childProcess  = require('child_process');

const moment        = require('moment');
const linuxBattery  = require('linux-battery');
const mpdCmd        = require('mpd').cmd;

const util          = require('./util');
const config        = require('./config');
const clients       = require('./clients');


// Abstract block
// Emits 'update' events
// Output should be stored in this._output
class Block extends EventEmitter {
  constructor() {
    super();
    this._output = ` ${config.get('strLoading')} `;
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
  constructor(interval, delay) {
    super();

    // Default for delay
    delay = delay || 0;

    // Wait until the delay
    setTimeout(() => {
      // Update once more
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

  // Registers a this.update to the emitter, then updates once
  _register(events) {
    for (let e of events)
      this.emitter.on(e, this.update.bind(this));

    // Update once initially
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
    this.emitter.tree((err, data) => {
      if (err) {
        this.emit('error', err);
        return;
      }

      this._output = ` ${_.trunc(util.findFocused(data).name, {
        length:     config.get('maxlen'),
        omission:   config.get('trunc')
      })} `;

      this.emit('update');
    });
  }
}


class BatteryBlock extends AcpiBlock {
  constructor() {
    super();

    // Update status periodically
    setInterval(this.update.bind(this), config.get('batInterval'));
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
        if (percent <= config.get('batCritical'))
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

        let matches = out.match(/\[(\d{1,3})%\] \[(on|off)\]\n/);
        let output = ` ${matches[1]} `;
        if (matches[2] === 'off')
          output = util.addBG(output, 'cUrgent');

        // Commands
        // Toggle mute
        output = util.addAction(output, 'amixer set Master toggle', 1, true);
        // Volume up
        output = util.addAction(output,
            `amixer set Master ${config.get('volPercent')}%+`, 4, true);
        // Volume down
        output = util.addAction(output,
            `amixer set Master ${config.get('volPercent')}%-`, 5, true);

        this._output = output;
        this.emit('update');
      });
    }, config.get('fudgeTimeout'));
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
        let output = ` ${
          err ? 'disconnected' : out.match(/ESSID:"(.*)"\n/)[1]
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
          data.match(/\nTitle: (.*)\n/),
          data.match(/\nArtist: (.*)\n/)
        ];

        matches.forEach((match) => {
          if (match)
            stats.push(match[1]);
        });

        this._output = ` ${_.trunc(stats.join(' - '), {
          length:     config.get('maxlen'),
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
          let stats = '';

          let binaries  = [
            {
              label: 'r',
              action: 'mpc repeat',
              match: data.match(/\nrepeat: ([01])\n/)
            },
            {
              label: 'z',
              action: 'mpc random',
              match: data.match(/\nrandom: ([01])\n/)
            }
          ];

          binaries.forEach((status) => {
            stats += util.addAction(
                (status.match && status.match[1] !== '0') ? status.label : '-',
                status.action);
          });

          let xfadeMatch = data.match(/\nxfade: (\d+)\n/);
          this.lastXfade = xfadeMatch ? Number.parseInt(xfadeMatch[1]) : 0;
          stats += util.addAction(xfadeMatch ? 'x' : '-',
              `mpc crossfade ${this.lastXfade ? 0 : config.get('mpdXfade')}`);

          let playing = '♪';
          let playingMatch = data.match(/\nstate: (.*)\n/);
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

          playing = util.addAction(playing, 'mpc toggle');

          this._output = ` ${stats} ${playing} `;
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
  YumUpdateBlock:     YumUpdateBlock,
  WorkspaceBlock:     WorkspaceBlock,
  TitleBlock:         TitleBlock,
  BatteryBlock:       BatteryBlock,
  VolumeBlock:        VolumeBlock,
  SsidBlock:          SsidBlock,
  CurrentSongBlock:   CurrentSongBlock,
  PlayStatusBlock:    PlayStatusBlock,
};

