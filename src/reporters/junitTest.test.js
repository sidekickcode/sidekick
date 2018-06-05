"use strict";

const reporter = require("./junit");
const scenario = require("./scenario.test.js");
const et = require("elementtree");
const _ = require("lodash");
var chai = require("chai");
var assert = chai.assert;

describe("junit reporter", function () {

    const self = this;

    before(function (done) {
        self.scenario = scenario.create([
            {
                name: "result",
                path: "blub.js",
                data: {
                    analyser: "blubCheck",
                    path: "blub.js",
                    issues: [
                        { message: "<total></total><failure" },
                    ]
                }
            },
            {
                name: "error",
                data: {
                    path: "blub.js",
                    analyser: "blubHint",
                    error: {
                        message: "escape </error> your xml!",
                        stdout: "<failure></failure><broken",
                        stderr: "",
                    },
                },
            },
            {
                name: "result",
                data: {
                    path: "horrible fileName -- not a good idea.js",
                    analyser: "blubHint",
                    issues: [
                        { message: "some failure" },
                    ],
                },
            },
        ]);

        self.scenario.on("end", function () {
            // wait for reporter to do its thing
            setImmediate(done);
        });

        self.output = "";

        reporter(self.scenario, function (out) {
            self.output += out;
        });

        self.scenario.start();
    });

    it("emits something resembling xml", function () {
        assert.match(self.output, /<failure/);

    });

    it("emits valid XML", function () {
        self.parsed = et.parse(self.output);
    });

    it("has testsuite as root", function () {
        assert.equal(self.parsed.getroot().tag, "testsuite");
    });

    it("provides a failure per issue", function () {
        self.failures = self.parsed.findall("*/failure");
        const totalIssues = _.reduce(self.scenario.eventsByName.result, function (a, r) {
            return a.concat(r.data.issues);
        }, []);

        assert.lengthOf(self.failures, totalIssues.length);
    });

    it("is possible to read stdout that contains xml", function () {
        const out = self.parsed.findall("*/system-out");
        const found = _.find(out, (e) => e.text.indexOf("<failure></failure><broken") !== -1);
        assert(found);
    });


    it("is possible to read stderr of errors", function () {
        const stderr = self.parsed.findall("*/system-err");

        const text = _.map(stderr, "text").join(" ");

        assert.match(text, /Everything/);

    });

    it("names are formatted as classnames", function () {
        const failures = self.parsed.findall("testcase");

        const difficultName = _.find(failures, (f) => /not.+a.+good/.test(f.attrib.name));
        assert(difficultName, "couldn't find failure node for 'horrible name' result");

        assert.equal(difficultName.attrib.name, "horrible_fileName_--_not_a_good_idea.js.blubHint");

    });


});
