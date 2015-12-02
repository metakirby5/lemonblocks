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
  cBG:           '#ff000000',
  cFG:           '#ffffffff',
  cUL:           '#ffffffff',
  cUrgent:       '#ffff0000',
  cAccent:       '#ff888888',
  cTransparent:  '#00000000',

  strLoading:    '…',
  fudgeTimeout:  20,
  dtLocale:      'ja',                  // For DatetimeBlock
  dtFmt:         'M月D日（dd）H:mm',    // For DatetimeBlock
  titleMaxlen:   80,                    // For TitleBlock
  titleTrunc:    '…',                   // For TitleBlock
  batCritical:   15,                    // For BatteryBlock, in %
  batInterval:   60 * 1000,             // For BatteryBlock
  volPercent:    5,                     // For VolumeBlock
  netFudgeTimeout: 2000,                // For SsidBlock
  yumUpdateFreq: 60 * 1000,             // For YumUpdateBlock
  mpdFudgeTimeout:  50,                 // For MpdBlocks
  mpdXfade:      5,                     // For MpdBlocks
});

