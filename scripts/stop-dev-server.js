#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG_ENDPOINT = 'http://127.0.0.1:7242/ingest/ad9e6371-5bb0-4684-9664-1062a2397ac6';

function log(data) {
  const payload = {
    location: 'stop-dev-server.js',
    message: data.message,
    data: data.data || {},
    timestamp: Date.now(),
    sessionId: 'debug-session',
    runId: 'stop-server',
    hypothesisId: data.hypothesisId || 'FIX'
  };
  
  fetch(LOG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => {});
}

// #region agent log
log({ hypothesisId: 'FIX', message: 'Stop script started', data: {} });
// #endregion

(async () => {
  try {
    // Find all Next.js dev server processes
    // #region agent log
    log({ hypothesisId: 'FIX', message: 'Finding Next.js processes', data: {} });
    // #endregion
    
    let processes;
    try {
      processes = execSync('ps aux | grep -E "(next-server|node.*next dev)" | grep -v grep | grep -v stop-dev-server', { encoding: 'utf8' }).trim();
    } catch (err) {
      // No processes found or command failed
      processes = '';
    }
    
    // #region agent log
    log({ hypothesisId: 'FIX', message: 'Found processes', data: { processes: processes.substring(0, 500) } });
    // #endregion
    
    if (!processes) {
      console.log('No Next.js dev server processes found.');
      // #region agent log
      log({ hypothesisId: 'FIX', message: 'No processes to stop', data: {} });
      // #endregion
      process.exit(0);
    }
    
    // Extract PIDs
    const pids = processes.split('\n')
      .map(line => line.trim().split(/\s+/)[1])
      .filter(pid => pid && !isNaN(pid));
    
    // #region agent log
    log({ hypothesisId: 'FIX', message: 'Extracted PIDs', data: { pids } });
    // #endregion
    
    // Kill processes gracefully (SIGTERM)
    for (const pid of pids) {
      try {
        // #region agent log
        log({ hypothesisId: 'FIX', message: 'Stopping process', data: { pid } });
        // #endregion
        
        process.kill(parseInt(pid), 'SIGTERM');
        console.log(`Sent SIGTERM to process ${pid}`);
      } catch (err) {
        // #region agent log
        log({ hypothesisId: 'FIX', message: 'Error stopping process', data: { pid, error: err.message } });
        // #endregion
        console.error(`Error stopping process ${pid}:`, err.message);
      }
    }
    
    // Wait a moment for graceful shutdown
    console.log('Waiting for processes to shut down gracefully...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if any processes are still running
    const remaining = execSync('ps aux | grep -E "(next-server|node.*next dev)" | grep -v grep | grep -v stop-dev-server', { encoding: 'utf8' }).trim();
    
    // #region agent log
    log({ hypothesisId: 'FIX', message: 'Checking remaining processes', data: { remaining: remaining.substring(0, 200) } });
    // #endregion
    
    if (remaining) {
      console.log('Some processes are still running. Force killing...');
      // Force kill if still running
      for (const pid of pids) {
        try {
          process.kill(parseInt(pid), 'SIGKILL');
          // #region agent log
          log({ hypothesisId: 'FIX', message: 'Force killed process', data: { pid } });
          // #endregion
        } catch (err) {
          // Process may already be dead
        }
      }
    }
    
    // Remove lock file if it exists
    const lockFile = path.join(__dirname, '..', '.next', 'dev', 'lock');
    try {
      if (fs.existsSync(lockFile)) {
        // #region agent log
        log({ hypothesisId: 'FIX', message: 'Removing lock file', data: { lockFile } });
        // #endregion
        fs.unlinkSync(lockFile);
        console.log('Lock file removed.');
      }
    } catch (err) {
      // #region agent log
      log({ hypothesisId: 'FIX', message: 'Error removing lock file', data: { error: err.message } });
      // #endregion
      console.warn(`Warning: Could not remove lock file: ${err.message}`);
    }
    
    // #region agent log
    log({ hypothesisId: 'FIX', message: 'Stop script completed', data: {} });
    // #endregion
    
    console.log('Next.js dev server processes stopped.');
    console.log('You can now run "npm run dev" again.');
    
  } catch (err) {
    // #region agent log
    log({ hypothesisId: 'FIX', message: 'Error in stop script', data: { error: err.message, stack: err.stack } });
    // #endregion
    console.error('Error:', err.message);
    process.exit(1);
  }
})();

