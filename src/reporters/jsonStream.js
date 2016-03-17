/**
 * JSON output
 */
"use strict";

module.exports = exports = reporter;

const defaultOutput = (x) => console.log(x);

function reporter(emitter, outputter) {
  const output = outputter || defaultOutput;

  emitter.on("result", outputJson);

  emitter.on("error", outputJson);

  function outputJson(x) {
    output(JSON.stringify(x));
  }
}

