/**
 * junit XML output
 *
 * ## References
 *
 * - http://llg.cubic.org/docs/junit/
 * - http://nose2.readthedocs.org/en/latest/plugins/junitxml.html
 * - https://svn.jenkins-ci.org/trunk/hudson/dtkit/dtkit-format/dtkit-junit-model/src/main/resources/com/thalesgroup/dtkit/junit/model/xsd/junit-4.xsd?p=41398 - p = revision number
 *
 *
 */
"use strict";

module.exports = exports = reporter;

const defaultOutput = (x) => console.log(x);

function reporter(emitter, outputter) {
  const output = outputter || defaultOutput;

  output(`<?xml version="1.0" encoding="utf-8"?>
  <testsuite name="sk">`);

  emitter.on("result", function(result) {
    outputTestcase(result, failures());

    function failures() {
      return result.issues.map((issue) => {
        return `<failure message="${escapeAttr(issue.message)}">${cdata(issue.message)}</failure>`
      }).join("\n");
    }
  });

  emitter.on("error", function(result) {
    const err = result.error;

    outputTestcase(result, error() + stdio());

    function error() {
      return `<error name="${escapeAttr(err.message)}"></error>`;
    }

    function stdio() {
      if(!("stderr" in err)) {
        return "";
      }
      return `<system-out>${cdata(err.stdout)}></system-out>
<system-err>${cdata(err.stderr)}</system-err>`;
    }
  });

  emitter.on("end", function() {
    output(`</testsuite>`);
  });

  function pathToClassName(path) {
    return path.replace("/", ".").replace(/\s+/g,"_");
  }

  function outputTestcase(result, content) {
    output(`<testcase name="${escapeAttr(pathToClassName(result.path))}.${result.analyser}">
  ${content}
</testcase>`);
  }

  function cdata(x) {
    return `<![CDATA[${x}]]>`
  }

  function escapeAttr(s) {
    var pairs = {
      "&": "&amp;",
      '"': "&quot;",
      "'": "&apos;",
      "<": "&lt;",
      ">": "&gt;"
    };
    for (var r in pairs) {
      if (typeof(s) !== "undefined") {
        s = s.replace(new RegExp(r, "g"), pairs[r]);
      }
    }
    return s || "";
  }
    
}

