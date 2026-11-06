// Servidor de respaldo para «Liga Secreta FPB 26» (Node.js).
// Reenvía mensajes entre el creador de la sala y los invitados. No guarda nada.
// Uso:  npm i ws   y luego   node relay-node.mjs     (puerto por defecto 8787 o variable PORT)
import { WebSocketServer } from 'ws';
import http from 'http';

const PORT = +process.env.PORT || 8787;
const rooms = new Map(); // código -> { host, guests: Map(id -> ws) }
let nextId = 1;

const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }); res.end('Servidor de Liga Secreta FPB 26 funcionando'); });
const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });

wss.on('connection', (ws, req) => {
  const q = new URL(req.url, 'http://x').searchParams;
  const room = (q.get('room') || '').toUpperCase().slice(0, 8);
  const role = q.get('role');
  const send = (s, o) => { if (s.readyState === 1) s.send(JSON.stringify(o)); };
  if (!room) { send(ws, { t: 'err', code: 'bad' }); return ws.close(); }
  if (role === 'host') {
    if (rooms.has(room)) { send(ws, { t: 'err', code: 'room-taken' }); return ws.close(); }
    const R = { host: ws, guests: new Map() };
    rooms.set(room, R);
    send(ws, { t: 'ok' });
    ws.on('message', (raw) => {
      let m; try { m = JSON.parse(raw); } catch (e) { return; }
      if (m.t === 'drop') { const g = R.guests.get(m.id); if (g) g.close(); return; }
      const out = JSON.stringify({ from: 'host', d: m.d });
      if (m.to === '*') { for (const g of R.guests.values()) if (g.readyState === 1) g.send(out); }
      else { const g = R.guests.get(m.to); if (g && g.readyState === 1) g.send(out); }
    });
    ws.on('close', () => { for (const g of R.guests.values()) { send(g, { t: 'host-left' }); g.close(); } rooms.delete(room); });
  } else {
    const R = rooms.get(room);
    if (!R) { send(ws, { t: 'err', code: 'no-room' }); return ws.close(); }
    const id = 'g' + (nextId++);
    R.guests.set(id, ws);
    send(ws, { t: 'ok' });
    send(R.host, { t: 'join', id });
    ws.on('message', (raw) => { let m; try { m = JSON.parse(raw); } catch (e) { return; } if (R.host.readyState === 1) R.host.send(JSON.stringify({ from: id, d: m.d })); });
    ws.on('close', () => { R.guests.delete(id); send(R.host, { t: 'leave', id }); });
  }
});
// latido para cerrar conexiones muertas
setInterval(() => { for (const ws of wss.clients) { if (ws.isAlive === false) { ws.terminate(); continue; } ws.isAlive = false; ws.ping(); } }, 20000);
wss.on('connection', (ws) => { ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; }); });
server.listen(PORT, () => console.log('Servidor de Liga Secreta FPB 26 en el puerto ' + PORT));
