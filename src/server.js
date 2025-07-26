import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { Pool } from 'pg';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const db = new Pool({
  user: 'user',
  host: 'localhost',
  database: 'vm_orchestrator_poc',
  password: 'password',
  port: 5432,
});

const COMMANDS = {
  'vm-status': { type: 'local', cmd: 'echo', args: ['Simulating make status...done.'] },
  'vm-logs': { type: 'local', cmd: 'echo', args: ['Simulating make logs...fake log output.'] },
  'docker-ps': { type: 'ssh', cmd: 'echo', args: ['Simulating ssh command...container up.'] }
};

app.use(express.static(path.join(__dirname, '../../frontend/dist')));

app.get('/api/jobs', async (req, res) => {
  try {
    const result = await db.query('SELECT id, type, command, status, started_at, finished_at FROM jobs ORDER BY started_at DESC LIMIT 10');
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

io.on('connection', socket => {
  socket.on('execute-command', async key => {
    const c = COMMANDS[key];
    if (!c) {
      socket.emit('error', { message: `Unknown command: ${key}` });
      return;
    }
    const id = uuidv4();
    const cmdStr = `${c.cmd} ${c.args.join(' ')}`;
    try {
      await db.query('INSERT INTO jobs (id, type, command, status) VALUES ($1, $2, $3, $4)', [id, c.type, cmdStr, 'running']);
      socket.emit('job-started', { jobId: id, command: cmdStr });
      const p = spawn(c.cmd, c.args);
      p.stdout.on('data', async d => {
        const chunk = d.toString();
        await db.query('INSERT INTO job_logs (job_id, stream, data) VALUES ($1, $2, $3)', [id, 'stdout', chunk]);
        socket.emit('job-log', { jobId: id, stream: 'stdout', data: chunk });
      });
      p.stderr.on('data', async d => {
        const chunk = d.toString();
        await db.query('INSERT INTO job_logs (job_id, stream, data) VALUES ($1, $2, $3)', [id, 'stderr', chunk]);
        socket.emit('job-log', { jobId: id, stream: 'stderr', data: chunk });
      });
      p.on('close', async code => {
        const status = code === 0 ? 'success' : 'failed';
        await db.query('UPDATE jobs SET status = $1, finished_at = NOW() WHERE id = $2', [status, id]);
        socket.emit('job-finished', { jobId: id, status, exitCode: code });
      });
    } catch (e) {
      socket.emit('error', { message: e.message });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 