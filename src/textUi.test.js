"use strict";

var ui = require("./textUi");

describe('banners', function() {

  it('makes banners', function() {
    var expected = 
`************************************************************
*                                                          *
*                       PUSH COMPLETE                      *
*                                                          *
*   push handled in SidekickJS app - everything is ok :)   *
*                                                          *
************************************************************`;


    var output = ui.banner([
      "PUSH COMPLETE",
      "push handled in SidekickJS app - everything is ok :)",
    ], {
      width: 60,
    })

    assert.equal(output, expected);
  })

  
  it('handles real life use', function() {
     var output = ui.banner([
      "PUSH COMPLETE",
      "Push completed successfully in SidekickJS app - everything is ok :)",
      "",
      "Git reported an error because its push was cancelled in favour of the push initated inside the SidekickJS app. This is fine, and your code was pushed.",
    ], {
      width: 50,
    });

    assert.match(output, /PUSH COMPLETE/);
  })
    
})  
