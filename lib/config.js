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
  cUrgent:       '#ffff0000',
  cAccent:       '#ff888888',
  cUnderline:    '#ff222222',
  cTransparent:  '#00000000',

  lidOpenTimeout: 3000,
  termExec:      'urxvt256cc -e',
  restartBarCmd: 'startbar',
  fudgeTimeout:  50,
  maxLen:        50,
  strLoading:    '…',
  trunc:         '…',
  refreshFreq:   30 * 1000,             // For blocks that could be inaccurate
  animFrameLen:  20,                    // For AnimatedExpandableBlock
  dtLocale:      'ja',                  // For DatetimeBlock
  dtFmt:         'M月D日（dd）H:mm',    // For DatetimeBlock
  weatherInterval:  15 * 60 * 1000,     // For WeatherBlock
  batCritical:   15,                    // For BatteryBlock, in %
  volPercent:    5,                     // For VolumeBlock
  netFudgeTimeout: 2000,                // For SsidBlock
  maxSsidLen:    20,                    // For SsidBlock
  yumUpdateFreq: 60 * 1000,             // For YumUpdateBlock
  mpdFudgeTimeout:  50,                 // For MpdBlocks
});

