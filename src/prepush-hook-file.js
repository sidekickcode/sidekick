"use strict";

exports.newHookFile = newHookFile;
exports.withComment = withComment;

function withComment() {
  return "# sidekick prepush analysis\nexec sk prepush $@\n";
}

function newHookFile() {
  return `#!/bin/sh
${withComment()}`;
}
