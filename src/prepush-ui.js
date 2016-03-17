/**
 * UI for prepush
 */
"use strict";

const log = require("../../common/log");

module.exports = exports = pickAndRunUI;

const ttyUi = require("./prepush-ui-tty");
const nonTtyUi = require("./prepush-ui-non-tty");


function pickAndRunUI(setup) {
  return process.stdout.isTTY ? ttyUi(setup) : nonTtyUi(setup);
}
