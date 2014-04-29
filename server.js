#!/usr/bin/env node

var connect = require('connect');
var express = require('express');
var lodash = require('lodash');
var stylus = require('stylus');
var _ = require('lodash');
var json2csv = require('json2csv');

var app = express();
app.set('views', __dirname);
app.set('view engine', 'jade');

app.use(connect.compress());
app.use(express.static(__dirname));

var fetch = require('./fetch.js');

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