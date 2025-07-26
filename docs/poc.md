# DevOps Cockpit - Proof of Concept

## Objective

Validate core technical feasibility in 4 hours:
- **WebSocket streaming** from backend processes to browser
- **Postgres integration** for job persistence  
- **Svelte reactivity** with real-time updates
- **Process execution** (local make + remote SSH)

**Success Definition**: Demonstrate all exam requirements working in a minimal, reliable demo.

---

## POC Scope (Ruthlessly Minimal)

### What's Included
- ✅ **2 hardcoded make targets**: `vm status`, `vm logs`
- ✅ **1 hardcoded SSH command**: `ssh dev-vm docker ps`
- ✅ **WebSocket streaming**: Real-time stdout/stderr to browser
- ✅ **Postgres storage**: Jobs + logs persistence
- ✅ **Svelte UI**: Single page with reactive log display
- ✅ **Job history**: Basic list from database

### What's Excluded (Defer to Full Implementation)
- ❌ mkcli registry parsing
- ❌ SSH config parsing
- ❌ Target discovery
- ❌ Job cancellation
- ❌ Multiple simultaneous jobs
- ❌ Terminal spawning
- ❌ Error recovery
- ❌ UI polish

---

## Architecture (Ultra-Simple)

```
Frontend (Single Svelte Page)
    ↓ WebSocket
Backend (Express + Socket.io)  
    ↓ spawn() / ssh
Local Process / Remote SSH
    ↓ 
Postgres (Jobs + Logs)
```

### Technology Stack
- **Frontend**: Svelte + Socket.io-client (single component)
- **Backend**: Node.js + Express + Socket.io + node-postgres
- **Database**: Postgres (2 tables)
- **Execution**: child_process.spawn() + ssh

---

## Database Schema (Minimal)

```sql
-- Setup script: database.sql
CREATE DATABASE vm_orchestrator_poc;

-- Jobs table
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('local', 'ssh')),
  command TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

-- Job logs table (time-series)
CREATE TABLE job_logs (
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  stream TEXT NOT NULL CHECK (stream IN ('stdout', 'stderr')),
  data TEXT NOT NULL
);

-- Index for log retrieval
CREATE INDEX idx_job_logs_job_timestamp ON job_logs(job_id, timestamp);
```

---

## Implementation Files

### File Structure
```
poc/
├── package.json
├── server.js              # Backend (100 lines)
├── database.sql           # Schema setup
├── public/
│   ├── index.html         # Static HTML shell
│   ├── app.js            # Svelte component (80 lines)
│   └── style.css         # Minimal styling
└── README.md             # Demo instructions
```

### Backend (server.js)

```javascript
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { Pool } from 'pg';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Postgres connection
const db = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'vm_orchestrator_poc',
  password: 'password',
  port: 5432,
});

// Hardcoded configuration (POC only)
const COMMANDS = {
  'vm-status': { 
    type: 'local', 
    cmd: 'make', 
    args: ['-C', '/path/to/terraform-dev-server', 'status'] 
  },
  'vm-logs': { 
    type: 'local', 
    cmd: 'make', 
    args: ['-C', '/path/to/terraform-dev-server', 'logs'] 
  },
  'docker-ps': { 
    type: 'ssh', 
    cmd: 'ssh', 
    args: ['ubuntu@10.0.1.10', 'docker ps'] 
  }
};

app.use(express.static('public'));
app.use(express.json());

// API: Get job history
app.get('/api/jobs', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, type, command, status, started_at, finished_at 
      FROM jobs 
      ORDER BY started_at DESC 
      LIMIT 10
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// WebSocket connection
io.on('connection', (socket) => {
  console.log('Client connected');
  
  socket.on('execute-command', async (commandKey) => {
    const command = COMMANDS[commandKey];
    if (!command) {
      socket.emit('error', { message: `Unknown command: ${commandKey}` });
      return;
    }
    
    const jobId = uuidv4();
    const commandStr = `${command.cmd} ${command.args.join(' ')}`;
    
    try {
      // Store job in database
      await db.query(
        'INSERT INTO jobs (id, type, command, status) VALUES ($1, $2, $3, $4)',
        [jobId, command.type, commandStr, 'running']
      );
      
      socket.emit('job-started', { jobId, command: commandStr });
      
      // Execute command
      const process = spawn(command.cmd, command.args);
      
      process.stdout.on('data', async (data) => {
        const chunk = data.toString();
        
        // Store in database
        await db.query(
          'INSERT INTO job_logs (job_id, stream, data) VALUES ($1, $2, $3)',
          [jobId, 'stdout', chunk]
        );
        
        // Stream to client
        socket.emit('job-log', { jobId, stream: 'stdout', data: chunk });
      });
      
      process.stderr.on('data', async (data) => {
        const chunk = data.toString();
        
        await db.query(
          'INSERT INTO job_logs (job_id, stream, data) VALUES ($1, $2, $3)',
          [jobId, 'stderr', chunk]
        );
        
        socket.emit('job-log', { jobId, stream: 'stderr', data: chunk });
      });
      
      process.on('close', async (code) => {
        const status = code === 0 ? 'success' : 'failed';
        
        await db.query(
          'UPDATE jobs SET status = $1, finished_at = NOW() WHERE id = $2',
          [status, jobId]
        );
        
        socket.emit('job-finished', { jobId, status, exitCode: code });
      });
      
    } catch (error) {
      console.error('Command execution error:', error);
      socket.emit('error', { message: error.message });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`POC Server running on port ${PORT}`);
});
```

### Frontend (public/app.js)

```javascript
import { writable } from 'svelte/store';
import { io } from 'socket.io-client';

// Svelte stores
const jobs = writable([]);
const currentJob = writable(null);
const logLines = writable([]);
const connectionStatus = writable('connecting');

// WebSocket connection
const socket = io();

socket.on('connect', () => {
  connectionStatus.set('connected');
  loadJobHistory();
});

socket.on('disconnect', () => {
  connectionStatus.set('disconnected');
});

socket.on('job-started', (data) => {
  currentJob.set(data);
  logLines.set([]);
});

socket.on('job-log', (data) => {
  logLines.update(lines => [...lines, {
    stream: data.stream,
    data: data.data,
    timestamp: new Date()
  }]);
});

socket.on('job-finished', (data) => {
  logLines.update(lines => [...lines, {
    stream: 'system',
    data: `Job finished with status: ${data.status} (exit code: ${data.exitCode})`,
    timestamp: new Date()
  }]);
  currentJob.set(null);
  loadJobHistory();
});

socket.on('error', (data) => {
  logLines.update(lines => [...lines, {
    stream: 'error',
    data: data.message,
    timestamp: new Date()
  }]);
});

// API functions
async function loadJobHistory() {
  try {
    const response = await fetch('/api/jobs');
    const jobHistory = await response.json();
    jobs.set(jobHistory);
  } catch (error) {
    console.error('Failed to load job history:', error);
  }
}

function executeCommand(commandKey) {
  socket.emit('execute-command', commandKey);
}

// Svelte component
export default {
  props: {},
  setup() {
    return {
      jobs,
      currentJob,
      logLines,
      connectionStatus,
      executeCommand
    };
  }
};
```

### Frontend HTML (public/index.html)

```html
<!DOCTYPE html>
<html>
<head>
  <title>DevOps Cockpit POC</title>
  <link rel="stylesheet" href="/style.css">
  <script type="module" src="/socket.io/socket.io.js"></script>
</head>
<body>
  <div id="app">
    <h1>DevOps Cockpit - Proof of Concept</h1>
    
    <!-- Connection Status -->
    <div class="status">
      Status: <span id="connection-status">connecting...</span>
    </div>
    
    <!-- Command Buttons -->
    <div class="commands">
      <h2>Available Commands</h2>
      <button onclick="executeCommand('vm-status')">VM Status</button>
      <button onclick="executeCommand('vm-logs')">VM Logs</button>
      <button onclick="executeCommand('docker-ps')">Docker PS (SSH)</button>
    </div>
    
    <!-- Live Log Output -->
    <div class="console">
      <h2>Live Output</h2>
      <div id="current-job"></div>
      <div id="log-output"></div>
    </div>
    
    <!-- Job History -->
    <div class="history">
      <h2>Job History</h2>
      <div id="job-list"></div>
    </div>
  </div>
  
  <script type="module" src="/app.js"></script>
</body>
</html>
```

---

## Setup Instructions

### Prerequisites
- Node.js 18+
- Postgres running locally
- SSH access to target VM (for SSH commands)

### Quick Setup

```bash
# 1. Create database
psql -c "CREATE DATABASE vm_orchestrator_poc;"
psql vm_orchestrator_poc < database.sql

# 2. Install dependencies
npm init -y
npm install express socket.io pg uuid

# 3. Update hardcoded paths in server.js
# - Fix make target paths
# - Fix SSH connection details

# 4. Start server
node server.js

# 5. Open browser
open http://localhost:3000
```

---

## Demo Script (2 Minutes)

### Setup (30 seconds)
1. Show POC running in browser
2. Point out connection status: "connected"
3. Show empty job history initially

### Core Demo (60 seconds)
1. **Click "VM Status"**
   - Show job started message
   - Watch live logs stream in real-time
   - Point out stdout/stderr different colors
   - Show job completion status

2. **Click "Docker PS (SSH)"**
   - Show SSH command execution
   - Watch remote command output stream
   - Demonstrate WebSocket streaming works for both local and remote

### Validation (30 seconds)
3. **Show Job History**
   - Refresh page → jobs persist (Postgres)
   - Show timestamps and status
   - Click previous job → could show stored logs

### Technology Showcase
- **WebSockets**: "Real-time streaming, no page refresh needed"
- **Postgres**: "Job history persists across sessions"  
- **Svelte**: "Reactive UI updates automatically"

---

## POC Success Criteria

### Technical Validation ✅
- [ ] WebSocket connection establishes and maintains
- [ ] Local make targets execute and stream output
- [ ] SSH commands execute and stream output
- [ ] Postgres stores jobs and logs correctly
- [ ] Svelte displays live updates reactively
- [ ] Job history loads from database

### Exam Requirements ✅
- [ ] **WebSockets**: Demonstrably streaming real-time data
- [ ] **Postgres**: Database integration shown working
- [ ] **Svelte**: Reactive frontend framework in use

### Demo Quality ✅
- [ ] Reliable execution (works every time)
- [ ] Clear visual feedback (easy to see what's happening)
- [ ] Complete flow (start to finish in 2 minutes)
- [ ] Error handling (doesn't crash on failures)

---

## Next Steps After POC

Once POC validates the technical approach:

1. **Expand to full mkcli integration**
2. **Add SSH config parsing middleware**  
3. **Implement terminal spawning for interactive commands**
4. **Build comprehensive Svelte UI with shadcn-svelte**
5. **Add job management (cancel, retry, filter)**

**POC Success = Green light for full implementation**

The POC proves the core concept works and satisfies all exam requirements in a minimal, demonstrable package.