var CachingWriter = require('broccoli-caching-writer');
var path = require('path');
var fs = require('fs');
var uniq = require('lodash.uniq');

module.exports = ConcatWithMaps;
ConcatWithMaps.prototype = Object.create(CachingWriter.prototype);
ConcatWithMaps.prototype.constructor = ConcatWithMaps;

function ConcatWithMaps(inputNode, options, Strategy) {
  if (!(this instanceof ConcatWithMaps)) {
    return new ConcatWithMaps(inputNode, options, Strategy);
  }

  if (!options || !options.outputFile || !options.inputFiles) {
    throw new Error('inputFiles and outputFile options ware required');
  }

  CachingWriter.call(this, [inputNode], {
    inputFiles: options.inputFiles,
    annotation: options.annotation
  });

  if (Strategy === undefined) {
    throw new TypeError('ConcatWithMaps requires a concat Strategy');
  }

  this.Strategy = Strategy;
  this.process = options.process;
  this.inputFiles = options.inputFiles;
  this.outputFile = options.outputFile;
  this.allowNone = options.allowNone;
  this.header = options.header;
  this.headerFiles = options.headerFiles;
  this._headerFooterFilesIndex = makeIndex(options.headerFiles, options.footerFiles);
  this.footer = options.footer;
  this.footerFiles = options.footerFiles;
  this.separator = (options.separator != null) ? options.separator : '\n';

  ensureNoMagic('headerFiles', this.headerFiles);
  ensureNoMagic('footerFiles', this.footerFiles);

  this.encoderCache = {};
}

var MAGIC = /[\{\}\*\[\]]/;

function ensureNoMagic(name, list) {
  (list || []).forEach(function(a) {
    if (MAGIC.test(a)) {
      throw new TypeError(name + ' cannot contain a glob,  `' + a + '`');
    }
  });
}

function makeIndex(a, b) {
  var index = Object.create(null);

  ((a || []).concat(b ||[])).forEach(function(a) {
    index[a] = true;
  });

  return index;
}

ConcatWithMaps.prototype.build = function() {
  var separator = this.separator;
  var firstSection = true;

  var concat = this.concat = new this.Strategy({
    outputFile: path.join(this.outputPath, this.outputFile),
    sourceRoot: this.sourceRoot,
    baseDir: this.inputPaths[0],
    cache: this.encoderCache
  });

  function beginSection() {
    if (firstSection) {
      firstSection = false;
    } else {
      concat.addSpace(separator);
    }
  }

  if (this.process) {
    this.concat.process = this.process;
  }

  if (this.header) {
    beginSection();
    concat.addSpace(this.header);
  }

  if (this.headerFiles) {
    this.headerFiles.forEach(function(file) {
      beginSection();
      concat.addFile(file);
    });
  }

  this.addFiles(beginSection);

  if (this.footerFiles) {
    this.footerFiles.forEach(function(file) {
      beginSection();
      concat.addFile(file);
    });
  }

  if (this.footer) {
    beginSection();
    concat.addSpace(this.footer + '\n');
  }

  return this.concat.end();
};

function isDirectory(fullPath) {
  // files returned from listFiles are directories if they end in /
  // see: https://github.com/joliss/node-walk-sync
  // "Note that directories come before their contents, and have a trailing slash"
  return fullPath.charAt(fullPath.length - 1) === '/';
}

ConcatWithMaps.prototype.addFiles = function(beginSection) {
  var headerFooterFileOverlap = false;

  var files = uniq(this.listFiles()).filter(function(file){
    var relativePath = file.replace(this.inputPaths[0] + '/', '');

    // * remove inputFiles that are already contained within headerFiles and footerFiles
    // * alow duplicates between headerFiles and footerFiles

    if (this._headerFooterFilesIndex[relativePath] === true) {
      headerFooterFileOverlap = true;
      return false;
    }

    return !isDirectory(file);
  }, this);

  // raise IFF:
  //   * headerFiles or footerFiles overlapped with inputFiles
  //   * nothing matched inputFiles
  if (headerFooterFileOverlap === false &&
      files.length === 0 &&
      !this.allowNone) {
    throw new Error('ConcatWithMaps: nothing matched [' + this.inputFiles + ']');
  }

  files.forEach(function(file) {
    beginSection();

    this.concat.addFile(file.replace(this.inputPaths[0] + '/', ''));
  }, this);
};
