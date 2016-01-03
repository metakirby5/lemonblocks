'use strict';

const EventEmitter  = require('events');
const childProcess  = require('child_process');

const util          = require('./util');


class Iwevent extends EventEmitter {
  constructor() {
    super();
    let proc = childProcess.spawn('iwevent');

    util.onCleanup(() => {
      proc.kill();
    });

    proc.stdout.on('data', (data) => {
      let lines = data.toString().split('\n');
      for (let line of lines) {
        if (!line)
          continue;

        let parts = line.trim().split('   ');
        let type = parts[2].split('/')[0];
        type = type.split(':')[0];
        let src = parts[1];

        this.emit(type, src);
      }
    });
  }
}

class Pactl extends EventEmitter {
  constructor() {
    super();
    let proc = childProcess.spawn('pactl', ['subscribe']);

    util.onCleanup(() => {
      proc.kill();
    });

    proc.stdout.on('data', (data) => {
      let lines = data.toString().split('\n');
      for (let line of lines) {
        line = line.trim()
        if (!line)
          continue;

        let parts = line.replace(/^Event\s+|'/g,'').split(' on ');
        let info = parts[1].split(' ');

        let type = `${parts[0]}_${info[0]}`,
            src = info[1];

        this.emit(type, src);
      }
    });
  }
}


module.exports = {
  i3:         require('i3').createClient(),
  acpi:       require('acpi')(),
  mpd:        require('mpd').connect(),
  iwevent:    new Iwevent(),
  pactl:      new Pactl()
};

