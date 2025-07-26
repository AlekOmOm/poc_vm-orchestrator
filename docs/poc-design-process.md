# vm-orchestrator - Proof of Concept Design Process

## Project Setup
**Project**: vm-orchestrator Proof of Concept  
**Current State**: Implementation plan exists, need minimal viable proof  
**Key Stakeholders**: Exam evaluator, developer (you), potential users

---

## Step 1: Challenge Requirements (POC-Focused)

### Requirements Under Scrutiny for POC

**Hard Constraints (Exam Requirements):**
- ✅ **WebSockets** - Must demonstrate real-time capability
- ✅ **Postgres** - Must show database integration  
- ✅ **Svelte + shadcn-svelte** - Must use required frontend stack

**POC Requirements to Challenge:**

**"Full mkcli integration" - *Originator: Implementation plan*
- Assumption: Need complete mkcli registry parsing + target discovery
- Challenge: POC only needs to prove WebSocket streaming works
- **POC Approach**: Hardcode 2-3 make targets, focus on execution + streaming

**"SSH config parsing middleware" - *Originator: Implementation plan*
- Assumption: Need sophisticated ~/.ssh/config parsing
- Challenge: POC only needs to prove SSH execution works
- **POC Approach**: Hardcode 1 SSH connection, focus on remote streaming

**"Complex job management" - *Originator: Implementation plan*
- Assumption: Need job queuing, cancellation, history UI
- Challenge: POC only needs to prove core loop works
- **POC Approach**: Single job execution, basic status tracking

**"shadcn-svelte component library" - *Originator: Implementation plan*
- Assumption: Need polished UI components
- Challenge: POC only needs to prove data flows work
- **POC Approach**: Minimal Svelte components, focus on reactivity

### Core POC Question
**Are we proving the right thing?**
- ✅ WebSocket streaming from backend process to frontend
- ✅ Postgres job persistence and retrieval
- ✅ Svelte reactive updates from WebSocket data
- ✅ Process execution (local make target)
- ✅ SSH execution (remote command)
- ❓ Full tool integration (defer to full implementation)

---

## Step 2: Delete Parts/Process (POC Ruthless Deletion)

### High Deletion Priority for POC

**Delete These Components:**
1. **mkcli registry parsing** → Hardcode `["vm", "vm-config"]` aliases
2. **Target discovery** → Hardcode `["status", "create", "logs"]` targets  
3. **SSH config parsing** → Hardcode single VM connection
4. **Job history UI** → Simple job list, no filtering/search
5. **Error recovery** → Basic error display only
6. **Terminal spawning** → Defer to main implementation
7. **vm-config integration** → Mock data for VMs
8. **Authentication** → Skip entirely
9. **Job cancellation** → Defer to main implementation
10. **Complex UI layouts** → Single page with tabs

**"Just in Case" Features to Delete:**
- Multiple project environments
- Job filtering and search
- Real-time job status updates beyond logs
- Process cleanup and management
- Configuration management
- File upload/download

**Components Without Clear POC Value:**
- Job replay functionality
- Advanced terminal features
- SSH key management
- Performance optimization
- Production deployment considerations

### Minimal POC Core
**What survives deletion:**
1. **Single hardcoded make target execution** (`vm status`)
2. **Single hardcoded SSH command** (`docker ps`)
3. **WebSocket streaming** (stdout/stderr to browser)
4. **Postgres job storage** (basic job + events tables)
5. **Svelte reactive display** (live log updates)
6. **Basic job history** (list of completed jobs)

---

## Step 3: Simplify/Optimize POC Design

### POC-Optimized Architecture

**Ultra-Simple Tech Stack:**
```
Frontend: Single Svelte page + Socket.io-client
Backend: Express + Socket.io + node-postgres + child_process
Database: Postgres (2 tables only)
Execution: spawn() for local, ssh for remote
```

**Simplified Data Model:**
```sql
-- Minimal POC schema
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- 'local' | 'ssh'  
  command TEXT NOT NULL,
  status TEXT NOT NULL, -- 'running' | 'done' | 'error'
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE TABLE job_logs (
  job_id UUID REFERENCES jobs(id),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  stream TEXT NOT NULL, -- 'stdout' | 'stderr'
  data TEXT NOT NULL
);
```

**POC Process Flow:**
```
1. User clicks "Run vm status" button
2. Frontend emits WebSocket event
3. Backend spawns `make -C ~/code/vm status`
4. Backend streams stdout/stderr via WebSocket
5. Frontend appends to log display (Svelte reactivity)
6. Backend stores job + logs in Postgres
7. Process completes → status update via WebSocket
```

**POC File Structure:**
```
poc/
├── package.json           # Dependencies only
├── server.js             # Single backend file
├── database.sql          # Schema setup
├── public/
│   ├── index.html        # Single page
│   └── app.js           # Single Svelte component
└── README.md            # POC demo instructions
```

### System-Wide POC Simplification

**Backend (server.js) - ~100 lines:**
```javascript
const express = require('express');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const { spawn } = require('child_process');

// Hardcoded configuration
const MAKE_TARGETS = {
  'vm': { dir: '/Users/you/code/terraform-dev-server', targets: ['status', 'create'] }
};

const SSH_HOSTS = {
  'dev-vm': { user: 'ubuntu', host: '10.0.1.10' }
};
```

**Frontend (app.js) - ~50 lines:**
```javascript
import { writable } from 'svelte/store';
import { io } from 'socket.io-client';

// Single component with job execution + log display
const jobs = writable([]);
const currentLogs = writable([]);
```

---

## Step 4: Accelerate POC Cycle Time

### POC Development Strategy (4 Hours Total)

**Hour 1: Foundation**
- Express + Socket.io + Postgres connection
- Single hardcoded command execution
- Basic WebSocket log streaming
- **Success Criteria**: Can run `echo "hello"` and see output in browser

**Hour 2: Real Commands**  
- Add `make -C ~/path status` execution
- Add SSH command execution (`ssh user@host docker ps`)
- Postgres job + log storage
- **Success Criteria**: Real make target + SSH command both stream logs

**Hour 3: Svelte Integration**
- Replace static HTML with Svelte component
- WebSocket connection in Svelte
- Reactive log display
- **Success Criteria**: Svelte shows live log updates

**Hour 4: Demo Polish**
- Job history from Postgres
- Basic error handling
- Multiple command buttons
- **Success Criteria**: Demo-ready POC

### POC Validation Checkpoints

**After Hour 1:**
- [ ] WebSocket connection established
- [ ] Process stdout streams to browser
- [ ] Postgres connection working

**After Hour 2:**
- [ ] Real make target executes and streams
- [ ] SSH command executes and streams  
- [ ] Jobs and logs stored in database

**After Hour 3:**
- [ ] Svelte component displays live logs
- [ ] WebSocket data triggers Svelte reactivity
- [ ] Frontend shows job status changes

**After Hour 4:**
- [ ] Multiple commands can be executed
- [ ] Job history displays from database
- [ ] POC demonstrates all exam requirements

---

## Step 5: Automate Last (POC Scope)

### Manual Processes for POC (Good for Demo)

**Keep Manual:**
- Database setup (run schema script manually)
- Server startup (node server.js)
- Configuration (hardcoded values in source)
- Process cleanup (manual kill if needed)
- Error recovery (restart server manually)

**No Automation in POC:**
- File watching for auto-restart
- Database migrations
- Environment configuration
- Process monitoring
- Log rotation
- Health checks

### POC Automation Strategy

**Only Essential Automation:**
```javascript
// Automatic WebSocket reconnection (5 lines)
socket.on('disconnect', () => {
  setTimeout(() => socket.connect(), 1000);
});

// Automatic job cleanup on process exit (3 lines)
process.on('exit', () => {
  // Update any running jobs to 'error' status
});
```

**Defer All Other Automation** to main implementation phase.

---

## POC Success Criteria

### Technical Validation
- [ ] **WebSocket streaming**: Real-time command output appears in browser
- [ ] **Postgres integration**: Jobs and logs persist across server restarts
- [ ] **Svelte reactivity**: UI updates automatically when WebSocket data arrives
- [ ] **Process execution**: Both local make targets and SSH commands work
- [ ] **Multi-command**: Can run multiple commands, see separate log streams

### Exam Requirement Validation  
- [ ] **WebSockets**: Demonstrably streaming real-time data
- [ ] **Postgres**: Database queries shown working (job history)
- [ ] **Svelte**: Frontend framework visibly handling reactive updates

### Demo Readiness
- [ ] **Single-click demo**: Can show entire flow in <2 minutes
- [ ] **Error handling**: Basic error states don't crash the system
- [ ] **Visual clarity**: Easy to see what's happening during demo
- [ ] **Reliable**: POC works consistently across multiple runs

---

## POC Implementation Focus

### Core POC Loop (Prove This Works)
```
1. Button Click (Svelte)
   ↓
2. WebSocket Emit (Frontend)
   ↓  
3. Process Spawn (Backend)
   ↓
4. Stream Output (Backend → Frontend via WebSocket)
   ↓
5. Reactive Display (Svelte)
   ↓
6. Database Storage (Postgres)
   ↓
7. Job Complete (Status Update via WebSocket)
```

### POC Scope Boundaries

**In Scope:**
- 2 hardcoded make targets (`vm status`, `vm create`)
- 1 hardcoded SSH command (`ssh user@host docker ps`) 
- Basic job list (show last 10 jobs from database)
- Live log streaming for currently running job
- Simple error display if command fails

**Out of Scope:**
- Dynamic target discovery
- SSH config parsing  
- Job cancellation
- Multiple simultaneous jobs
- Job filtering or search
- Terminal spawning
- Complex UI layouts
- Configuration management

### POC Development Rules

1. **Hardcode everything** - No dynamic discovery in POC
2. **Single page** - No routing or navigation
3. **Minimal UI** - Function over form
4. **Basic error handling** - Display errors, don't crash
5. **Focus on data flow** - Prove the technical concept works

This POC will validate the core technical feasibility while satisfying all exam requirements in minimum time.