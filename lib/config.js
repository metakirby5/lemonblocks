'use strict';


// Manages all configuration
class Config {
  constructor(settings) {
    this._settings = settings;
  }

  get(key) {
    return this._settings[key];
  }

  set(key, val) {
    this._settings[key] = val;
  }

  update(obj) {
    Object.assign(this._settings, obj);
  }
}


module.exports = new Config({
  cFG:           '#ffffffff',
  cBG:           '#ff000000',
  cUrgent:       '#ffff0000',
  cTransparent:  '#00000000',

  strLoading:    '…',
  fudgeTimeout:  20,
  dtLocale:      'ja',                  // For DatetimeBlock
  dtFmt:         'M月D日（dd）H:mm',    // For DatetimeBlock
  titleMaxlen:   80,                    // For TitleBlock
  titleTrunc:    '…',                   // For TitleBlock
  batInterval:   60 * 1000,             // For BatteryBlock
  netFudgeTimeout: 1000,                // For SsidBlock
});

