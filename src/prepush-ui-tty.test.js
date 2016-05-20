"use strict";

const createUi = require("./prepush-ui-tty")._runUi;
const events = require("events");
const sinon = require("sinon");

const readline = require("readline");
const stream = require("stream");
const util = require("util");


describe('prepush-ui-tty', function() {

  var setup
  var push;
  var main;
  var cursor;
  var ui
  var pushActor;
  var prepush;

  beforeEach(function() {

    cursor = readline.createInterface({ input: new StubReadable, output: new StubWritable});
    main = new events.EventEmitter;
    pushActor = new events.EventEmitter;
    prepush = new events.EventEmitter;
    main.getActor = function(id) {
      assert.equal(id, push.id);
      return pushActor;
    }

    push = {
      id: 1,
    };

    setup = {
      main,
      push,
      prepush,
      cursor,
    };


    ui = createUi(setup);
    
  });

  describe('ending', function() {
    it('exits 0 on success', function() {
      var exitSpy = sinon.spy();
      ui.on("exit", exitSpy);
      pushActor.emit("end");

      assert.spyCalledOnce(exitSpy);
    })

    it('requests confirmation to skip on error', function() {
      var writer = sinon.spy(cursor, "question");
      pushActor.emit("end", new Error);

      assert.spyCalledOnce(writer);
      assert.spyCalledWith(writer, sinon.match(/push anyway?/));
    })
  })

  // can't get the stdout stream to capture output
  describe('exitOptionallySkipping', function() {

    it('outputs exit message', function() {
      prepush.emit('exitOptionallySkipping', {
        message: "oh NOES",
      })

      assert.match(cursor.output.content, /oh NOES/);
    })

    it('prompts for skip', function() {
      prepush.emit('exitOptionallySkipping', {
        message: "oh NOES",
      });

      assert.match(cursor.output.content, /without analysis?/);
    })
      
  })
    
})


function StubReadable() {
  this._read = function() {};
  this.isTTY = true;
  stream.Readable.call(this);
}
util.inherits(StubReadable, stream.Readable);

function StubWritable() {
  this.content = "";
  // being a bit naughty, and overwriting the public write message
  // to keep it sync
  this.write = function(d) {
    this.content += d;
  };
  this.isTTY = true;
  stream.Writable.call(this);
}
util.inherits(StubWritable, stream.Writable);
