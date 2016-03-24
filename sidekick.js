#!/usr/bin/env node
/**
 * kicks off - required as browserify build loses the main module
 */
"use strict";
`sidekick needs a NodeJS version supporting es6! sidekickcode.com/cli-install`;
require("./src/index").run();
