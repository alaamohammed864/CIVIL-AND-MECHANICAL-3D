import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

// In-memory project cloud store (backed up by client IndexedDB)
const cloudProjects = new Map<string, unknown>();

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: '4M ENGINEERING CLOUD', timestamp: new Date().toISOString() });
  });

  // Project storage endpoints
  app.get('/api/projects', (_req, res) => {
    res.json({ projects: Array.from(cloudProjects.values()) });
  });

  app.post('/api/projects', (req, res) => {
    const project = req.body;
    if (!project || typeof project.id !== 'string') {
      res.status(400).json({ error: 'Invalid project payload: missing id' });
      return;
    }
    cloudProjects.set(project.id, { ...project, cloudSyncedAt: new Date().toISOString() });
    res.json({ ok: true, id: project.id, syncedAt: new Date().toISOString() });
  });

  // Server-Side Gemini Engineering Copilot endpoint
  app.post('/api/copilot', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error: 'GEMINI_API_KEY is not configured in environment secrets. Please add GEMINI_API_KEY in Settings > Secrets.',
      });
      return;
    }

    const { prompt, modelSummary } = req.body as { prompt?: string; modelSummary?: unknown };
    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'Prompt is required.' });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const systemInstruction = `You are Engineering Copilot inside 4M ENGINEERING CLOUD, a professional Web CAD/BIM/MEP/Energy engineering suite.
You are analyzing a live BIM & MEP model. You MUST base every number, room name, clash, circuit, or BOQ observation strictly on the provided modelSummary JSON.
Never invent elements that are not in modelSummary.
Respond concisely with structured technical clarity, citing engineering standards (ASHRAE, IEC 60364, NFPA 13, ISO 19650) with formulas/assumptions clearly labeled as advisory engineering estimates (not stamped/certified).
If the user asks to perform an automated workflow (e.g., fix HVAC terminal, optimize duct size, upgrade cable, resolve clash), include clear recommended parameter changes they can review and apply.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `User engineering query:\n${prompt}\n\nLive BIM/MEP Model Context (JSON):\n${JSON.stringify(modelSummary, null, 2)}`,
        config: {
          systemInstruction,
        },
      });

      res.json({
        reply: response.text || 'No response generated.',
        model: 'gemini-4-hydrogen',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gemini API call failed';
      res.status(500).json({ error: message });
    }
  });

  // Vite dev middleware or static dist serving
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const server = http.createServer(app);

  // Real-Time WebSocket Collaboration Hub (Presence, Live Cursors, Element Sync)
  const wss = new WebSocketServer({ server, path: '/ws' });
  const clients = new Map<WebSocket, { userId: string; name: string; projectId: string }>();

  wss.on('connection', (ws) => {
    const userId = `eng-${Math.random().toString(36).slice(2, 7)}`;
    clients.set(ws, { userId, name: 'Engineer', projectId: '' });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type: string;
          projectId?: string;
          name?: string;
          cursor?: { x: number; y: number };
          payload?: unknown;
        };

        if (msg.type === 'join') {
          clients.set(ws, {
            userId,
            name: msg.name || 'Engineer',
            projectId: msg.projectId || '',
          });
          broadcastPresence(msg.projectId || '');
        } else if (msg.type === 'cursor' || msg.type === 'project_patch') {
          const sender = clients.get(ws);
          if (!sender) return;
          wss.clients.forEach((peer) => {
            if (peer !== ws && peer.readyState === WebSocket.OPEN) {
              const peerMeta = clients.get(peer);
              if (peerMeta && peerMeta.projectId === sender.projectId) {
                peer.send(
                  JSON.stringify({
                    ...msg,
                    userId: sender.userId,
                    name: sender.name,
                  }),
                );
              }
            }
          });
        }
      } catch {
        // Ignore malformed socket frames
      }
    });

    ws.on('close', () => {
      const meta = clients.get(ws);
      clients.delete(ws);
      if (meta?.projectId) {
        broadcastPresence(meta.projectId);
      }
    });
  });

  function broadcastPresence(projectId: string) {
    const activePeers: { userId: string; name: string }[] = [];
    clients.forEach((meta) => {
      if (meta.projectId === projectId) {
        activePeers.push({ userId: meta.userId, name: meta.name });
      }
    });
    const packet = JSON.stringify({ type: 'presence', peers: activePeers });
    wss.clients.forEach((peer) => {
      if (peer.readyState === WebSocket.OPEN && clients.get(peer)?.projectId === projectId) {
        peer.send(packet);
      }
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`4M ENGINEERING CLOUD server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start 4M ENGINEERING CLOUD server:', err);
  process.exit(1);
});
