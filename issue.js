var results = require('./fetch')();
//console.log(JSON.stringify(results, null, 2));

var timeoutRE = /TimeoutException/;
// { errorName: { apps: ['appNames'], count: 0 } }
var errors = {};
Object.keys(results).forEach(function (appName) {
  var app = results[appName];

  if (app.failed > 0) {
    //console.log(app.name + " had an error: " + JSON.stringify(app.runs, null, 2));
    app.runs.forEach(function (run) {
      if (!run.reason) return;
      if (timeoutRE.test(run.reason)) {
        run.reason = "failed to install: TimeoutException: Timed out after 120.X seconds\n";
      }
      if (!errors[run.reason]) {
        errors[run.reason] = { apps: [], count: 0 };
      }
      if (errors[run.reason].apps.indexOf(app.name) === -1) {
        errors[run.reason].apps.push(app.name);
        ++errors[run.reason].count;
      }
    });
  }
});

console.log(JSON.stringify(errors, null, 2));

