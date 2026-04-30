const net = require('net');
const { execSync } = require('child_process');

const port = parseInt(process.argv[2] || '3001', 10);

function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

function findProcessOnPort(port) {
  try {
    if (process.platform === 'win32') {
      const output = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf-8' }).trim();
      if (!output) return null;
      const pid = output.split(/\s+/).pop();
      if (!pid || pid === '0') return null;
      try {
        const name = execSync(`tasklist /fi "PID eq ${pid}" /fo csv /nh`, { encoding: 'utf-8' }).trim();
        const match = name.match(/"([^"]+)"/);
        return { pid, name: match ? match[1] : 'unknown' };
      } catch {
        return { pid, name: 'unknown' };
      }
    } else {
      const output = execSync(`lsof -i :${port} -t`, { encoding: 'utf-8' }).trim();
      if (!output) return null;
      const pid = output.split('\n')[0];
      return { pid, name: 'process' };
    }
  } catch {
    return null;
  }
}

(async () => {
  const occupied = await checkPort(port);
  if (!occupied) {
    process.exit(0);
  }

  const proc = findProcessOnPort(port);
  console.log('');
  console.log(`\x1b[33m⚠ 端口 ${port} 已被占用\x1b[0m`);
  if (proc) {
    console.log(`  进程: ${proc.name} (PID: ${proc.pid})`);
    if (process.platform === 'win32') {
      console.log(`  \x1b[36m终止命令: taskkill /PID ${proc.pid} /F\x1b[0m`);
    } else {
      console.log(`  \x1b[36m终止命令: kill -9 ${proc.pid}\x1b[0m`);
    }
  }
  console.log('');
  process.exit(1);
})();
