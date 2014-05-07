#!/usr/bin/env node

var connect = require('connect');
var express = require('express');
var glob = require('glob');
var lodash = require('lodash');
var stylus = require('stylus');
var path = require('path');
var fs = require('fs');
var _ = require('lodash');
var json2csv = require('json2csv');
var bodyParser = require('body-parser');
var crypto = require('crypto');

var app = express();
app.set('views', __dirname);
app.set('view engine', 'jade');

app.use(bodyParser());
app.use(connect.compress());
app.use(express.static(__dirname));

function normalizeSlug(slug) {
	return slug.replace(/_\d+$/g, '');
}

var ignoreReasons = /MULTIPLE_APPS_PER_ORIGIN_FORBIDDEN|REINSTALL_FORBIDDEN|NETWORK_ERROR|TimeoutException/;

var all = JSON.parse(fs.readFileSync('reports/manifest.json'));

function fetch() {
	var results = {};
	var i = 0;
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

	var checksums = [];

	function checksum(str, algorithm, encoding) {
		return crypto
			.createHash(algorithm || 'md5')
			.update(str, 'utf8')
			.digest(encoding || 'hex')
	}

	var files = glob.sync('reports/*/test_results*.json');
	files.forEach(function(file) {
		var data = fs.readFileSync(file);

		var checks = checksum(data);
		if (checksums.indexOf(checks) != -1) {
			console.warn('Skipped file %s', file);
			return;
		}
		checksums.push(checks);

		var partial = JSON.parse(data);
		var skipped = [];
		for (var name in partial) {
			var slug = normalizeSlug(name);
			var app = results[slug];
			if (!app) {
				skipped.push(slug);
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
			app.runs.push(run);
			app.status = (app.passed && app.passed >= app.failed)
				? 1
				: ((app.runs.length < 2) ? -1 : 0);
		}
		if (skipped.length) {
			console.warn('Read %s, skipped %s', file, skipped.join(', '));
		}
	});
	return results;
}

app.get('/', function(req, res) {
	var results = fetch();

	var inputCount = 0;
	var runCount = 0;
	var passedCount = 0;
	var failedCount = 0;
	var retestCount = 0;
	var missingCount = 0;

	_.forEach(results, function(app) {
		inputCount++;
		if (app.runs.length) {
			runCount++;
		} else {
			missingCount++;
		}
		if (app.status == 1) {
			passedCount++;
		} else if (!app.status) {
			failedCount++;
		} else if (app.status == -1) {
			retestCount++;
		}
	});

	var data = {
		results: results,
		inputCount: inputCount,
		runCount: runCount,
		missingCount: missingCount,
		passedCount: passedCount,
		retestCount: retestCount,
		failedCount: failedCount
	};

	if (req.query.json) {
		return res.send(data);
	}

	res.render('index', data);
});

app.get('/retest', function(req, res) {
	var results = fetch();
	var filtered = all.filter(function(app) {
		var slug = normalizeSlug(app.app_name);
		return results[slug].retest;
	})
	res.send(filtered);
});

app.post('/export', function(req, res) {
	var mapped = [];
	_.forEach(req.body.app, function(result, slug) {
		mapped.push({
			app: slug,
			result: result
		});
	});

	json2csv({
		data: mapped,
		fields: Object.keys(mapped[0])
	}, function(err, csv) {
		res.set('Content-Disposition', 'attachment; filename="export.csv"');
		res.send(csv);
	});
});

app.get('/json', function(req, res) {
	res.send(fetch());
});

app.get('/csv', function(req, res) {
	var results = fetch();

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
		res.set('Content-Disposition', 'attachment; filename="result.csv"');
		res.send(csv);
	});
});

var port = process.env.PORT || 8888;
app.listen(port, function() {
	console.log('http://localhost:%d', port);
});