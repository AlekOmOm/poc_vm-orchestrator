<script>
  import { onMount } from 'svelte';
  import io from 'socket.io-client';

  let status = 'connecting';
  let logs = '';
  let jobs = [];
  const socket = io('http://localhost:3000');

  onMount(() => {
    socket.on('connect', () => status = 'connected');
    socket.on('disconnect', () => status = 'disconnected');
    socket.on('job-log', d => logs += d.data);
    socket.on('job-finished', () => {
      fetch('/api/jobs').then(r => r.json()).then(j => jobs = j);
    });
    fetch('/api/jobs').then(r => r.json()).then(j => jobs = j);
  });

  function exec(cmd) {
    logs = '';
    socket.emit('execute-command', cmd);
  }
</script>

<main>
  <h1>VM Orchestrator POC</h1>
  <p>Status: {status}</p>

  <div class="commands">
    <button on:click={() => exec('vm-status')}>VM Status</button>
    <button on:click={() => exec('vm-logs')}>VM Logs</button>
    <button on:click={() => exec('docker-ps')}>Docker PS (SSH)</button>
  </div>

  <div class="console">
    <h2>Live Output</h2>
    <pre>{logs}</pre>
  </div>

  <div class="history">
    <h2>Job History</h2>
    <ul>
      {#each jobs as job}
        <li>
          {new Date(job.started_at).toLocaleTimeString()} - {job.command} ({job.status})
        </li>
      {/each}
    </ul>
  </div>
</main>

<style>
  main { font-family: sans-serif; }
  .console pre { background: #eee; padding: 1em; white-space: pre-wrap; }
  .commands button { margin-right: 1em; }
</style>
