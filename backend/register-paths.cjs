const Module = require('module');
const path = require('path');

const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveRideDelivaAlias(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    request = path.join(__dirname, 'dist', request.slice(2));
  } else if (request === 'bullmq') {
    request = path.join(__dirname, 'node_modules', 'bullmq');
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};
