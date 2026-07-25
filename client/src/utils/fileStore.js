// Simple module-level file store for passing files between routes
// React Router state doesn't reliably preserve File objects between lazy-loaded routes
let _pendingFile = null;
let _pendingFileName = "";

export function setPendingFile(file) {
  _pendingFile = file;
  _pendingFileName = file?.name || "";
}

export function getPendingFile() {
  return _pendingFile;
}

export function getPendingFileName() {
  return _pendingFileName;
}

export function clearPendingFile() {
  _pendingFile = null;
  _pendingFileName = "";
}
