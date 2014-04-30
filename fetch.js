var fs = require('fs');
var _ = require('lodash');
var glob = require('glob');
var path = require('path');

var ignoreReasons = /MULTIPLE_APPS_PER_ORIGIN_FORBIDDEN|REINSTALL_FORBIDDEN/;

function normalizeSlug(slug) {
  return slug.replace(/_\d+$/g, '');
}

module.exports = function fetch() {
  var results = {};
  var i = 0;
  var all = JSON.parse(fs.readFileSync('reports/manifest.json'));
  _.forEach(all, function(app) {
    var slug = normalizeSlug(app.app_name);
    results[slug] = {
      idx: i++,
      name: app.app_name,
      slug: slug,
      runs: [],
      passed: 0,
      failed: 0,
      screenshots: [],
      logs: []
    };
  });

  var files = glob.sync('reports/*/*.json');
  files.forEach(function(file) {
    var data = fs.readFileSync(file);
    var partial = JSON.parse(data);
    for (var name in partial) {
      var slug = normalizeSlug(name);
      var app = results[slug];
      if (!app) {
        console.warn('Skipped %s from %s', slug, file);
        continue;
      }
      var entry = partial[name];
      var run = {};
      run.status = !(entry.status && entry.status.indexOf('FAILED') == 0);
      run.from = file;
      run.logcat = path.dirname(file) + '/' + entry.logcat;
      if (!run.status) {
        if (ignoreReasons.test(entry.status)) {
          continue;
        }
        run.reason = entry.status.substr(8);
        app.failed++;
      } else {
        app.passed++;
        app.screenshots.push('/' + path.dirname(file) + '/' + entry.screenshot);
      }
      app.status = app.passed && app.passed >= app.failed;
      app.runs.push(run);
    }
  });
  return results;
}