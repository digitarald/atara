var results = require('./fetch')();
//console.log(JSON.stringify(results, null, 2));

// { errorName: ['appNames']}
var errors = {};
Object.keys(results).forEach(function (appName) {
  var app = results[appName];

  if (app.failed > 0) {
    //console.log(app.name + " had an error: " + JSON.stringify(app.runs, null, 2));
    app.runs.forEach(function (run) {
      if (!errors[run.reason]) {
        errors[run.reason] = [];
      }
      if (errors[run.reason].indexOf(app.name) === -1) {
        errors[run.reason].push(app.name);
      }
    });
  }
});

console.log(JSON.stringify(errors, null, 2));
