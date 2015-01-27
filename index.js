var _ = require('lodash'),
  async = require('async'),
  follow = require('follow'),
  fs = require('fs'),
  marky = require("marky-markdown"),
  SF = require('seq-file'),
  timing = require('timing')({microtime: false}),
  url = require('url'),
  uuid = require('uuid');

var longest = 0;
var longestName = '';
var count = 0;
var total = 0;

function MB(opts) {
  var _this = this;

  _.extend(this, {
    seqfile: './.seq',
    database: 'registry', // Database to follower.
    failures: [],
    host: '127.0.0.1:5984', // CouchDB Host.
    feed: null, // the follow feed.
    username: 'admin', // couch admin username.
    password: 'admin', // couch admin password.
    maxQueueSize: 10
  }, opts);

  // sequence file used to resume post crash.
  this.seq = new SF(this.seqfile, {
    frequency: 100
  });

  this.seq.readSync();

  // queue used to populate DB.
  this.queue = async.queue(function (doc, cb) {
    _this.benchmark(doc, cb);
  }, this.maxQueueSize);
};

MB.prototype.start = function() {
  var _this = this;

  this.feed = follow({
    db: url.format({
      protocol: 'http',
      host: this.host,
      pathname: this.database,
      auth: this.username + ':' + this.password
    }),
    since: this.seq.seq,
    inactivity_ms: 30000,
    include_docs: true
  }, function(err, change) {
    if (err) throw err;

    _this.seq.save(change.seq);

    if (_this.queue.length() >= _this.maxQueueSize) {
      _this.feed.pause();
    }

    _this.queue.push(change.doc);
  });

  // assign a callback
  this.queue.drain = function() {
    _this.feed.resume();
  }
};

MB.prototype.benchmark = function(doc, cb) {
  var timingId = uuid.v4();

  if (doc.readme) {
    count++;
    timing.time(timingId);
    marky(doc.readme, {highlightSyntax: true}, function(err, output) {
      var timer = timing.timeEnd(timingId);

      total += timer.duration;

      if (timer.duration > longest) {
        longest = timer.duration;
        longestName = doc.name;
      }s

      //if (output) console.log(output.html());
      console.log('BENCHMARK AVG = ', total / count, ' LONGEST = ', longest, longestName, ' this cycle = ', timer.duration);
      return cb();
    });
  } else {
    return cb();
  }
};

(new MB()).start();
