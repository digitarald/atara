#!/usr/bin/env node

var express = require('express');
var glob = require('glob');
var lodash = require('lodash');
var stylus = require('stylus');
var path = require('path');
var fs = require('fs');
var _ = require('lodash');
var json2csv = require('json2csv');

var app = express();
app.set('views', __dirname);
app.set('view engine', 'jade');

app.use(express.static(__dirname));

function normalizeSlug(slug) {
	return slug.replace(/_\d+$/g, '');
}

var ignoreReasons = /MULTIPLE_APPS_PER_ORIGIN_FORBIDDEN|REINSTALL_FORBIDDEN/;

function fetch() {
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

app.get('/', function(req, res) {
	// res.setHeader('content-type', 'text/plain');
	var results = fetch();

	var inputCount = 0;
	var runCount = 0;
	var passedCount = 0;
	var failedCount = 0;

	_.forEach(results, function(app) {
		inputCount++;
		if (app.runs.length) {
			runCount++;
		}
		if (!app.passed) {
			failedCount++;
			return;
		}
		if (app.status) {
			passedCount++;
		} else {
			failedCount++;
		}
	});

	res.render('index', {
		results: results,
		inputCount: inputCount,
		runCount: runCount,
		missingCount: inputCount - runCount,
		passedCount: passedCount,
		failedCount: failedCount
	});
});

app.get('/json', function(req, res) {
	res.send(fetch());
});

app.get('/csv', function(req, res) {
	var results = fetch();
	res.set('Content-Disposition', 'attachment; filename="result.csv"');

	var mapped = _.map(results, function(result) {
		var logcats = [];
		var runs = result.runs.map(function(run) {
			var line = run.status ? 'PASS' : 'FAIL';
			logcats.push(run.logcat);
			if (run.reason) {
				line += ' (' + run.reason + ')';
			}
			return line;
		});
		return {
			id: result.idx,
			name: result.name,
			status: result.status ? 'PASS' : 'FAIL',
			runs: runs.join(', '),
			logcat: logcats.join(', '),
			screenshots: result.screenshots.join(', ')
		}
	});

	json2csv({
		data: mapped,
		fields: Object.keys(mapped[0])
	}, function(err, csv) {
		res.send(csv);
	});
});

var port = process.env.PORT || 8888;
app.listen(port, function() {
	console.log('http://localhost:%d', port);
});