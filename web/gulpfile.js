/*
Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

'use strict';

var gulp = require('gulp');
var path = require('path');
var fs = require('fs');
var glob = require('glob-all');
var packageJson = require('./package.json');
var crypto = require('crypto');
var console = require("gulp-util");
var runSequence = require("run-sequence");
let Manifest = require('http2-push-manifest/lib/manifest');

var DIST = '.';

var dist = function(subpath) {
  return !subpath ? DIST : path.join(DIST, subpath);
};

var ensurePath = function(file) {
  // Make a path if one wasn't given. e.g. basic.html -> ./basic.html
  return (file.indexOf(path.sep) === -1) ? `.${path.sep}${file}` : file;
};

gulp.task('push-manifest', function(done) {
  let files = ['index.html'];
  let result = {};
  let manifestName = 'push_manifest.json';

  let singleFile = files.length < 2;

  function processFile(file) {
    let f = ensurePath(file);
    let basePath = f.slice(0, f.lastIndexOf(path.sep))
    let inputPath = f.slice(f.lastIndexOf(path.sep) + 1);

    let manifest = new Manifest({basePath, inputPath, name: manifestName });
    return manifest.generate().then(output => {
      if (singleFile)
        manifest.write(output.file);
      else
        result[inputPath] = output.file;
    });
  }

  return Promise.all(files.map(file => processFile(file)))
  .then(() => {
    if (!singleFile) {
      let manifest = new Manifest({name: manifestName})
      manifest.write(result);
    }
  });
});

gulp.task('cache-config', function(done) {
  var dir = dist();
  var config = {
    cacheId: packageJson.name || path.basename(__dirname),
    disabled: false
  };

  let files = ['index.html'];
  let manifestName = 'cache-config.json';

  function processFile(file) {
    let f = ensurePath(file);
    let basePath = f.slice(0, f.lastIndexOf(path.sep))
    let inputPath = f.slice(f.lastIndexOf(path.sep) + 1);

    let manifest = new Manifest({basePath, inputPath, name: manifestName });
    return manifest.generate().then(output => {
      config.precache = output.urls.map((url) => {
        return url.startsWith('/') ? url.slice(1) : url;
      });
    });
  }

  return Promise.all(files.map(file => processFile(file)))
  .then(() => {
    config.precache.push('./');

    let md5 = crypto.createHash('md5');
    md5.update(JSON.stringify(config.precache));
    config.precacheFingerprint = md5.digest('hex');

    var configPath = path.join(dir, manifestName);
    return new Promise(function(resolve) {
      fs.writeFile(configPath, JSON.stringify(config), resolve);
    });
  });
});

gulp.task('default', function(cb) {
  runSequence(
    'cache-config',
    'push-manifest',
    cb);
});
