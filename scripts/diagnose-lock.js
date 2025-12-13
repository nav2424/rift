#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const LOCK_FILE = path.join(__dirname, '..', '.next', 'dev', 'lock');
const LOG_ENDPOINT = 'http://127.0.0.1:7242/ingest/ad9e6371-5bb0-4684-9664-1062a2397ac6';

function log(data) {
  const payload = {
    location: 'diagnose-lock.js',
    message: data.message,
    data: data.data || {},
    timestamp: Date.now(),
    sessionId: 'debug-session',
    runId: 'diagnostic',
    hypothesisId: data.hypothesisId || 'A'
  };
  
  fetch(LOG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => {});
}

// #region agent log
log({ hypothesisId: 'A', message: 'Diagnostic script started', data: { lockFile: LOCK_FILE } });
// #endregion

// Hypothesis A: Lock file exists
try {
  const exists = fs.existsSync(LOCK_FILE);
  // #region agent log
  log({ hypothesisId: 'A', message: 'Lock file existence check', data: { exists } });
  // #endregion
  
  if (exists) {
    // #region agent log
    log({ hypothesisId: 'A', message: 'Lock file found, checking stats', data: {} });
    // #endregion
    
    const stats = fs.statSync(LOCK_FILE);
    // #region agent log
    log({ hypothesisId: 'A', message: 'Lock file stats', data: { 
      size: stats.size, 
      mode: stats.mode.toString(8),
      mtime: stats.mtime.toISOString()
    } });
    // #endregion
    
    // Try to read lock file
    try {
      const content = fs.readFileSync(LOCK_FILE, 'utf8');
      // #region agent log
      log({ hypothesisId: 'A', message: 'Lock file content', data: { content: content.substring(0, 200) } });
      // #endregion
    } catch (readErr) {
      // #region agent log
      log({ hypothesisId: 'A', message: 'Failed to read lock file', data: { error: readErr.message } });
      // #endregion
    }
  }
} catch (err) {
  // #region agent log
  log({ hypothesisId: 'A', message: 'Error checking lock file', data: { error: err.message } });
  // #endregion
}

// Hypothesis B: Process 40090 is running
try {
  const pid40090 = execSync('ps -p 40090 -o pid,comm,args 2>/dev/null || echo "NOT_FOUND"', { encoding: 'utf8' }).trim();
  // #region agent log
  log({ hypothesisId: 'B', message: 'Process 40090 check', data: { result: pid40090 } });
  // #endregion
} catch (err) {
  // #region agent log
  log({ hypothesisId: 'B', message: 'Error checking process 40090', data: { error: err.message } });
  // #endregion
}

// Hypothesis C: Other Next.js processes running
try {
  const nextProcesses = execSync('ps aux | grep -E "(next|node.*dev)" | grep -v grep | grep -v diagnose-lock', { encoding: 'utf8' }).trim();
  const processCount = nextProcesses.split('\n').filter(l => l.trim()).length;
  // #region agent log
  log({ hypothesisId: 'C', message: 'Next.js processes found', data: { count: processCount, processes: nextProcesses.substring(0, 500) } });
  // #endregion
} catch (err) {
  // #region agent log
  log({ hypothesisId: 'C', message: 'Error checking Next.js processes', data: { error: err.message } });
  // #endregion
}

// Hypothesis D: Lock file permissions
try {
  if (fs.existsSync(LOCK_FILE)) {
    fs.accessSync(LOCK_FILE, fs.constants.R_OK);
    // #region agent log
    log({ hypothesisId: 'D', message: 'Lock file is readable', data: {} });
    // #endregion
    
    fs.accessSync(LOCK_FILE, fs.constants.W_OK);
    // #region agent log
    log({ hypothesisId: 'D', message: 'Lock file is writable', data: {} });
    // #endregion
  }
} catch (err) {
  // #region agent log
  log({ hypothesisId: 'D', message: 'Lock file permission error', data: { error: err.message, code: err.code } });
  // #endregion
}

// Hypothesis E: Port 3000 usage
try {
  const port3000 = execSync('lsof -ti:3000 2>/dev/null || echo "NONE"', { encoding: 'utf8' }).trim();
  // #region agent log
  log({ hypothesisId: 'E', message: 'Port 3000 usage', data: { pid: port3000 } });
  // #endregion
} catch (err) {
  // #region agent log
  log({ hypothesisId: 'E', message: 'Error checking port 3000', data: { error: err.message } });
  // #endregion
}

// #region agent log
log({ hypothesisId: 'A', message: 'Diagnostic script completed', data: {} });
// #endregion

console.log('Diagnostic complete. Check logs for details.');

