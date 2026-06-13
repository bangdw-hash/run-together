import { createServer } from 'node:http';
import { Server } from 'socket.io';
import type { ClientToServer, ServerToClient } from '@run-together/shared';
import { Gateway } from './gateway.js';

const PORT = Number(process.env.PORT ?? 4000);

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, liveSessions: gateway.store.all().length }));
    return;
  }
  res.writeHead(404).end();
});

const io = new Server<ClientToServer, ServerToClient>(httpServer, {
  cors: { origin: '*' },
});
const gateway = new Gateway(io);

httpServer.listen(PORT, () => {
  console.log(`[run-together] realtime gateway listening on :${PORT}`);
});
