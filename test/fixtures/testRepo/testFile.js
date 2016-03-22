"use strict";

var foo = void 0;

function hello(x) {
  if(x == 0) {
    console.log("jshint will like this");
    console.log("yup");
  }
}

function hello(x) {
  if(x == 0) {
    console.log("jshint will like this") && console.log("yup");
    return
    {};
  }
}
