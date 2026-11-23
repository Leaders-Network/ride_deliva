const Module = require('module');
const path = require('path');

const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveRideDelivaAlias(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    request = path.join(__dirname, 'dist', request.slice(2));
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};
