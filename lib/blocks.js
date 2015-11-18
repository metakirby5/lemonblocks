'use strict';
const EventEmitter = require('events');
const _ = require('lodash');
const clients = require('./clients');

// Abstract block
// Emits 'update' events
class Block extends EventEmitter {
  // Should update block output state and emit an 'update' event
  // abstract update();

  // Should return block output with minimal logic involved
  // abstract query();
}
module.exports.Block = Block;

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
module.exports.I3Block = I3Block;

class WorkspaceBlock extends I3Block {
  do_registration() {
    this.register(['workspace']);
  }

  update() {
    // TODO actually create a spaces string
    clients.i3.workspaces((err, data) => {
      // TODO handle error
      if (err) {
        console.error(err);
        return
      }
      
      this.spacesStr = data.map(function(space) {
        let current = _.slice(space.name.split(':'), 1).join('') || space.name;
        
        if (space.focused)
          current = `%{+u}${current}%{-u}`;
        current = `%{A:i3-msg workspace "${current.replace(':', '\\:')}":}` +
                  ` ${current} %{A}`;
        // TODO urgent w/ color consts
        //if (space.urgent)

        return current;
      }).join('');
      
      this.emit('update');
    });
  }

  query() {
    return this.spacesStr;
  }
}
module.exports.WorkspaceBlock = WorkspaceBlock;

