'use strict';

module.exports = {
  C_URGENT:       '#ffff0000',
  C_TRANSPARENT:  '#00000000',

  STR_LOADING:    '…',
  FUDGE_TIMEOUT:  20,
  DT_LOCALE:      'ja',                 // For DatetimeBlock
  DT_FMT:         'M月D日 (dd) H:mm',   // For DatetimeBlock
  TITLE_MAXLEN:   80,                   // For TitleBlock
  TITLE_TRUNC:    '…',                  // For TitleBlock
  BAT_INTERVAL:   60 * 1000,            // For BatteryBlock
  NET_FUDGE_TIMEOUT: 500,               // For SsidBlock
};

