#!/usr/bin/env node
// fixture script to use as a child process

if(process.env.EXIT_WITH) {
  process.exit(NUMBER(process.env.EXIT_WITH));


} else if (process.env.OUTPUT_UP_WITH_GARBAGE) {
  console.log(JSON.stringify({ junkJson: "before" }));
  console.log("blah blah before");
  console.log(JSON.stringify({ up: true }));
  console.log("blah blah after");
  stayUp();

} else if (process.env.OUTPUT_UP) {
  console.log(JSON.stringify({ up: true }));

  stayUp();


} else if (process.env.OUTPUT_GARBAGE) {
  console.log('oaksdoskd\nsdjsaoijad\n{}\n{ scooby:do }\n{"scooby":"do"}\naoskdo');

  stayUp();


} else if (process.env.EXPLICIT_FAILURE) {
  console.log(JSON.stringify({ junkJson: "before" }));
  console.log("blah blah before");
  console.log(JSON.stringify({ error: "failed, sorry" }));
  console.log("blah blah after");

  stayUp();


} else if (process.env.DO_NOTHING) {
  stayUp();


} else {
  throw new Error("fixture script not used correctly");
}

function stayUp() {
  setTimeout(function() {
  }, 5000);
}
