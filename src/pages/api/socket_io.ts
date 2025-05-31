
// src/pages/api/socket_io.ts
import type { Server as HTTPServer } from 'http';
import type { Socket as NetSocket } from 'net';
import type { NextApiRequest, NextApiResponse } from 'next';
import { Server as IOServer, Socket as ServerSocket } from 'socket.io';

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: NetSocket & {
    server: HTTPServer & {
      io?: IOServer;
    };
  };
}

let broadcasterSocketId: string | null = null;
let currentStreamTitle: string | null = null; // Store current stream title
const viewers = new Map<string, ServerSocket>(); // Store viewer sockets <socket.id, socket>

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function SocketHandler(req: NextApiRequest, res: NextApiResponseWithSocket) {
  if (!res.socket.server.io) {
    console.log('*Initializing Socket.IO server on /api/socket_io...');
    const io = new IOServer(res.socket.server, {
      path: '/api/socket_io',
      addTrailingSlash: false,
      cors: {
        origin: "*", 
        methods: ["GET", "POST"]
      }
    });

    io.on('connection', (socket: ServerSocket) => {
      console.log('Socket connected:', socket.id);

      socket.on('disconnect', () => {
        console.log('Socket disconnected:', socket.id);
        if (socket.id === broadcasterSocketId) {
          broadcasterSocketId = null;
          currentStreamTitle = null; // Clear title
          viewers.forEach(viewerSocket => viewerSocket.emit('broadcaster-disconnected'));
          // viewers.clear(); // Clearing viewers map here might be too aggressive if they should persist for a bit
          console.log('Broadcaster disconnected and viewers notified.');
        } else {
          viewers.delete(socket.id);
          if (broadcasterSocketId) {
            io.to(broadcasterSocketId).emit('viewer-disconnected', { viewerId: socket.id });
          }
          console.log('Viewer disconnected, total viewers:', viewers.size);
        }
      });

      // Broadcaster events
      socket.on('register-broadcaster', (data?: { streamTitle?: string }) => {
        broadcasterSocketId = socket.id;
        currentStreamTitle = data?.streamTitle || 'Live Stream';
        console.log('Broadcaster registered:', socket.id, 'Title:', currentStreamTitle);
        viewers.forEach(viewerSocket => {
          viewerSocket.emit('broadcaster-ready', { broadcasterId: socket.id, streamTitle: currentStreamTitle });
          if(broadcasterSocketId) { // ensure broadcasterSocketId is not null
            io.to(broadcasterSocketId).emit('new-viewer', { viewerId: viewerSocket.id });
          }
        });
      });
      
      socket.on('update-stream-title', (data: { streamTitle: string }) => {
        if (socket.id === broadcasterSocketId) {
          currentStreamTitle = data.streamTitle;
          console.log('Stream title updated by broadcaster:', currentStreamTitle);
          viewers.forEach(viewerSocket => {
            viewerSocket.emit('stream-title-updated', { streamTitle: currentStreamTitle });
          });
        }
      });

      socket.on('stop-stream', () => {
        if (socket.id === broadcasterSocketId) {
          console.log('Broadcaster explicitly stopped stream:', socket.id);
          broadcasterSocketId = null;
          currentStreamTitle = null;
          viewers.forEach(viewerSocket => viewerSocket.emit('broadcaster-disconnected'));
        }
      });

      socket.on('offer-to-viewer', ({ viewerId, offer }) => {
        const viewerSocket = viewers.get(viewerId);
        if (viewerSocket) {
          console.log(`Broadcaster ${socket.id} sending offer to viewer ${viewerId}`);
          viewerSocket.emit('offer-from-broadcaster', { broadcasterId: socket.id, offer });
        } else {
            console.log(`Viewer ${viewerId} not found for offer from ${socket.id}`);
        }
      });

      socket.on('candidate-to-viewer', ({ viewerId, candidate }) => {
        const viewerSocket = viewers.get(viewerId);
        if (viewerSocket) {
          console.log(`Broadcaster ${socket.id} sending candidate to viewer ${viewerId}`);
          viewerSocket.emit('candidate-from-broadcaster', { broadcasterId: socket.id, candidate });
        }
      });

      // Viewer events
      socket.on('register-viewer', () => {
        viewers.set(socket.id, socket);
        console.log('Viewer registered:', socket.id, '. Total viewers:', viewers.size);
        if (broadcasterSocketId) {
          console.log(`Notifying broadcaster ${broadcasterSocketId} about new viewer ${socket.id}`);
          io.to(broadcasterSocketId).emit('new-viewer', { viewerId: socket.id });
          socket.emit('broadcaster-ready', { broadcasterId: broadcasterSocketId, streamTitle: currentStreamTitle });
        } else {
          socket.emit('broadcaster-disconnected');
          console.log(`Informing viewer ${socket.id} that broadcaster is disconnected.`);
        }
      });
      
      socket.on('answer-to-broadcaster', ({ broadcasterId, answer }) => {
        const broadcaster = io.sockets.sockets.get(broadcasterId);
        if (broadcaster) {
          console.log(`Viewer ${socket.id} sending answer to broadcaster ${broadcasterId}`);
          broadcaster.emit('answer-from-viewer', { viewerId: socket.id, answer });
        } else {
            console.log(`Broadcaster ${broadcasterId} not found for answer from ${socket.id}`);
        }
      });

      socket.on('candidate-to-broadcaster', ({ broadcasterId, candidate }) => {
        const broadcaster = io.sockets.sockets.get(broadcasterId);
         if (broadcaster) {
          console.log(`Viewer ${socket.id} sending candidate to broadcaster ${broadcasterId}`);
          broadcaster.emit('candidate-from-viewer', { viewerId: socket.id, candidate });
        }
      });

    });
    res.socket.server.io = io;
  } else {
    console.log('Socket.IO server already running on /api/socket_io');
  }
  res.end();
}
