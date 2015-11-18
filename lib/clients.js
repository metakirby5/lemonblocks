'use strict';

const cst = require('./constants');

module.exports = {
  i3:     require('i3').createClient(),
  acpi:   require('acpi')(),
};

