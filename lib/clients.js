'use strict';

const EventEmitter  = require('events');
const childProcess  = require('child_process');

const cst = require('./constants');


class Iwevent extends EventEmitter {
  constructor() {
    super();
    let proc = childProcess.spawn('iwevent');

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


module.exports = {
  i3:         require('i3').createClient(),
  acpi:       require('acpi')(),
  iwevent:    new Iwevent(),
  mpd:        require('mpd').connect(),
};

