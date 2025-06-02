
// src/pages/api/socket_io.ts
import type { Server as HTTPServer } from 'http';
import type { Socket as NetSocket } from 'net';
import type { NextApiRequest, NextApiResponse } from 'next';
import { Server as IOServer, Socket as ServerSocket } from 'socket.io';
import { getSiteSettingsLogic } from '@/lib/actions';
import type { SiteSettings } from '@/lib/types';

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: NetSocket & {
    server: HTTPServer & {
      io?: IOServer;
    };
  };
}

let generalBroadcasterSocketId: string | null = null;
let currentGeneralStreamTitle: string | null = null;
let currentGeneralStreamSubtitle: string | null = null; // NUEVO
let currentGeneralStreamIsLoggedInOnly: boolean = false;
const generalStreamViewers = new Map<string, ServerSocket>();

interface CallParticipant {
  socketId: string;
  appUserId: string;
}
let adminForPrivateCall: CallParticipant | null = null;
let userInPrivateCall: CallParticipant | null = null;

let siteSettingsCache: SiteSettings | null = null;
let siteSettingsCacheTime: number = 0;
const SITE_SETTINGS_CACHE_DURATION = 3 * 1000; // 3 seconds cache

async function getRefreshedSiteSettings(): Promise<SiteSettings | null> {
  try {
    siteSettingsCache = await getSiteSettingsLogic();
    siteSettingsCacheTime = Date.now();
  } catch (error) { console.error('Socket.IO: Critical error fetching site settings for refresh:', error); }
  return siteSettingsCache;
}

async function getCachedSiteSettings(): Promise<SiteSettings | null> {
  const now = Date.now();
  if (!siteSettingsCache || (now - siteSettingsCacheTime > SITE_SETTINGS_CACHE_DURATION)) {
    return getRefreshedSiteSettings();
  }
  return siteSettingsCache;
}

getRefreshedSiteSettings();

export const config = { api: { bodyParser: false } };

export default async function SocketHandler(req: NextApiRequest, res: NextApiResponseWithSocket) {
  console.log(`Socket.IO: API route /api/socket_io hit. Method: ${req.method}`);

  if (!res.socket.server.io) {
    const io = new IOServer(res.socket.server, {
      path: '/api/socket_io', addTrailingSlash: false, cors: { origin: "*", methods: ["GET", "POST"] }
    });

    io.on('connection', async (socket: ServerSocket) => {
      const appUserId = socket.handshake.query.appUserId as string | undefined;
      socket.data.appUserId = appUserId;
      console.log(`Socket.IO: Client connected - SocketID: ${socket.id}, AppUserID: ${appUserId || 'Anonymous'}, Query:`, socket.handshake.query);

      let currentSettings = await getCachedSiteSettings();
      if (!currentSettings) currentSettings = await getRefreshedSiteSettings(); // Retry if cache failed

      if (appUserId && currentSettings?.liveStreamAuthorizedUserId === appUserId) {
        const adminSocketInstance = adminForPrivateCall ? io.sockets.sockets.get(adminForPrivateCall.socketId) : null;
        if (adminSocketInstance) {
          adminSocketInstance.emit('authorized-user-status', { userId: appUserId, isConnected: true, userSocketId: socket.id });
        }
      }

      socket.on('request-authorized-user-status', async ({ targetUserAppId }: { targetUserAppId: string }) => {
        console.log(`Socket.IO: Admin ${socket.id} (AppUser: ${socket.data.appUserId}) requested status for user ${targetUserAppId}`);
        const targetUserSocket = Array.from(io.sockets.sockets.values()).find(s => s.data.appUserId === targetUserAppId);
        socket.emit('authorized-user-status', {
          userId: targetUserAppId,
          isConnected: !!targetUserSocket,
          userSocketId: targetUserSocket?.id || null
        });
      });

      socket.on('disconnect', async (reason) => {
        console.log(`Socket.IO: Client disconnected - SocketID: ${socket.id}, AppUserID: ${socket.data.appUserId || 'Anonymous'}, Reason: ${reason}`);
        generalStreamViewers.delete(socket.id);

        if (socket.id === generalBroadcasterSocketId) {
          generalBroadcasterSocketId = null; currentGeneralStreamTitle = null; currentGeneralStreamSubtitle = null; currentGeneralStreamIsLoggedInOnly = false;
          io.emit('general-broadcaster-disconnected');
        } else {
          const broadcasterSocket = generalBroadcasterSocketId ? io.sockets.sockets.get(generalBroadcasterSocketId) : null;
          broadcasterSocket?.emit('viewer-disconnected', { viewerId: socket.id });
        }

        if (adminForPrivateCall && socket.id === adminForPrivateCall.socketId) {
          if (userInPrivateCall) io.sockets.sockets.get(userInPrivateCall.socketId)?.emit('private-call-terminated-by-admin');
          adminForPrivateCall = null; userInPrivateCall = null;
        } else if (userInPrivateCall && socket.id === userInPrivateCall.socketId) {
          if (adminForPrivateCall) io.sockets.sockets.get(adminForPrivateCall.socketId)?.emit('private-call-user-disconnected', { userSocketId: socket.id, userAppUserId: socket.data.appUserId });
          userInPrivateCall = null; adminForPrivateCall = null;
        }

        const refreshedSettings = await getCachedSiteSettings();
        if (socket.data.appUserId && refreshedSettings?.liveStreamAuthorizedUserId === socket.data.appUserId) {
          const adminSocketInstance = adminForPrivateCall ? io.sockets.sockets.get(adminForPrivateCall.socketId) : null;
          adminSocketInstance?.emit('authorized-user-status', { userId: socket.data.appUserId, isConnected: false, userSocketId: socket.id });
        }
      });

      socket.on('register-general-broadcaster', async (data?: { streamTitle?: string; streamSubtitle?: string; }) => { // Recibir subtítulo
        const settings = await getCachedSiteSettings();
        if (!settings) { socket.emit('general-stream-error', { message: 'Server error: Site settings not available.' }); return; }
        if ((adminForPrivateCall && adminForPrivateCall.socketId === socket.id && userInPrivateCall) || (adminForPrivateCall && adminForPrivateCall.socketId !== socket.id)) {
            socket.emit('general-stream-error', { message: 'Cannot start general stream due to private call session.' }); return;
        }
        generalBroadcasterSocketId = socket.id;
        currentGeneralStreamTitle = data?.streamTitle || settings.liveStreamDefaultTitle || 'Live Stream';
        currentGeneralStreamSubtitle = data?.streamSubtitle || ''; // Almacenar subtítulo
        currentGeneralStreamIsLoggedInOnly = settings.liveStreamForLoggedInUsersOnly || false;
        socket.data.isGeneralBroadcaster = true;
        io.emit('general-broadcaster-ready', {
            broadcasterId: generalBroadcasterSocketId,
            streamTitle: currentGeneralStreamTitle,
            streamSubtitle: currentGeneralStreamSubtitle, // Emitir subtítulo
            isLoggedInOnly: currentGeneralStreamIsLoggedInOnly
        });
      });

      socket.on('register-general-viewer', async () => {
        console.log(`Socket.IO: Received 'register-general-viewer' from ${socket.id}`);
        const settings = await getCachedSiteSettings();
        if (!settings) { console.error("Socket.IO: Cannot register viewer, site settings unavailable."); return; }

        if (generalBroadcasterSocketId) {
            if (currentGeneralStreamIsLoggedInOnly && !socket.data.appUserId) {
                socket.emit('general-stream-access-denied', { message: 'This live stream is for registered users only.' });
                return;
            }
            generalStreamViewers.set(socket.id, socket);
            socket.emit('general-broadcaster-ready', {
                broadcasterId: generalBroadcasterSocketId,
                streamTitle: currentGeneralStreamTitle,
                streamSubtitle: currentGeneralStreamSubtitle, // Emitir subtítulo
                isLoggedInOnly: currentGeneralStreamIsLoggedInOnly
            });
            const broadcasterSocket = io.sockets.sockets.get(generalBroadcasterSocketId);
            broadcasterSocket?.emit('new-general-viewer', { viewerId: socket.id });
        } else {
            socket.emit('general-broadcaster-disconnected');
        }
      });

      socket.on('general-stream-offer-to-viewer', async ({ viewerId, offer }) => {
        const viewerSocket = generalStreamViewers.get(viewerId);
        if (viewerSocket) {
            if (currentGeneralStreamIsLoggedInOnly && !viewerSocket.data.appUserId) {
                viewerSocket.emit('general-stream-access-denied', { message: 'This live stream is for registered users only.' });
                return;
            }
            viewerSocket.emit('offer-from-general-broadcaster', { broadcasterId: socket.id, offer });
        }
      });
      socket.on('general-stream-answer-to-broadcaster', ({ broadcasterId, answer }) => {
        const broadcasterSocket = io.sockets.sockets.get(broadcasterId);
        broadcasterSocket?.emit('answer-from-general-viewer', { viewerId: socket.id, answer });
      });
      socket.on('general-stream-candidate-to-viewer', ({ viewerId, candidate }) => {
        generalStreamViewers.get(viewerId)?.emit('candidate-from-general-broadcaster', { broadcasterId: socket.id, candidate });
      });
      socket.on('general-stream-candidate-to-broadcaster', ({ broadcasterId, candidate }) => {
        io.sockets.sockets.get(broadcasterId)?.emit('candidate-from-general-viewer', { viewerId: socket.id, candidate });
      });
      socket.on('stop-general-stream', () => {
        if (socket.id === generalBroadcasterSocketId) {
          generalBroadcasterSocketId = null; currentGeneralStreamTitle = null; currentGeneralStreamSubtitle = null; currentGeneralStreamIsLoggedInOnly = false;
          io.emit('general-broadcaster-disconnected');
        }
      });

      socket.on('admin-initiate-private-call-request', async ({ targetUserAppId }: { targetUserAppId: string }) => {
        const currentSettingsForCall = await getCachedSiteSettings();
        if (!socket.data.appUserId || !currentSettingsForCall) { socket.emit('private-call-error', { message: 'Server/user data not ready.' }); return; }
        if (generalBroadcasterSocketId === socket.id) { socket.emit('private-call-error', { message: 'Stop general stream first.' }); return; }
        if (adminForPrivateCall && adminForPrivateCall.socketId !== socket.id) { socket.emit('private-call-error', { message: 'Another admin in call setup.' }); return; }
        if (userInPrivateCall) { socket.emit('private-call-error', { message: `User ${userInPrivateCall.appUserId} already in call.` }); return; }

        adminForPrivateCall = { socketId: socket.id, appUserId: socket.data.appUserId };
        const targetUserSocket = Array.from(io.sockets.sockets.values()).find(s => s.data.appUserId === targetUserAppId);
        if (targetUserSocket) {
          targetUserSocket.emit('private-call-invite-from-admin', { adminSocketId: socket.id, adminAppUserId: adminForPrivateCall.appUserId });
          socket.emit('private-call-invite-sent-to-user', { userSocketId: targetUserSocket.id, userAppUserId: targetUserAppId });
        } else {
          socket.emit('private-call-user-not-connected', { targetUserAppId });
          adminForPrivateCall = null;
        }
      });

      socket.on('user-accepts-private-call', ({ adminSocketId }: { adminSocketId: string }) => {
          if (!adminForPrivateCall || adminSocketId !== adminForPrivateCall.socketId || !socket.data.appUserId) { socket.emit('private-call-error', { message: 'Admin not ready or invalid request.' }); return; }
          if(userInPrivateCall && userInPrivateCall.socketId !== socket.id) { socket.emit('private-call-error', {message: 'Admin in call with another user.'}); return; }
          userInPrivateCall = { socketId: socket.id, appUserId: socket.data.appUserId };
          const adminSock = io.sockets.sockets.get(adminSocketId);
          if (adminSock) {
            adminSock.emit('private-call-user-ready-for-offer', { userSocketId: socket.id, userAppUserId: socket.data.appUserId });
          } else {
            userInPrivateCall = null; adminForPrivateCall = null;
            socket.emit('private-call-error', { message: 'Admin disconnected.' });
          }
      });

      socket.on('private-sdp-offer', ({ targetSocketId, offer }) => io.to(targetSocketId).emit('private-sdp-offer-received', { senderSocketId: socket.id, offer }));
      socket.on('private-sdp-answer', ({ targetSocketId, answer }) => io.to(targetSocketId).emit('private-sdp-answer-received', { senderSocketId: socket.id, answer }));
      socket.on('private-ice-candidate', ({ targetSocketId, candidate }) => io.to(targetSocketId).emit('private-ice-candidate-received', { senderSocketId: socket.id, candidate }));

      socket.on('admin-end-private-call', ({userSocketId}: {userSocketId?: string}) => {
        if (adminForPrivateCall && socket.id === adminForPrivateCall.socketId) {
          const targetUserSocketId = userInPrivateCall ? userInPrivateCall.socketId : userSocketId;
          if (targetUserSocketId) io.sockets.sockets.get(targetUserSocketId)?.emit('private-call-terminated-by-admin');
          adminForPrivateCall = null; userInPrivateCall = null;
        }
      });
      socket.on('admin-end-private-call-for-user-app-id', ({ targetUserAppId }: { targetUserAppId: string }) => {
         if (adminForPrivateCall && socket.id === adminForPrivateCall.socketId) {
            const targetUserSocket = Array.from(io.sockets.sockets.values()).find(s => s.data.appUserId === targetUserAppId);
            targetUserSocket?.emit('private-call-terminated-by-admin');
            adminForPrivateCall = null; userInPrivateCall = null;
         }
      });
      socket.on('user-end-private-call', ({adminSocketId} : {adminSocketId?: string}) => {
        if (userInPrivateCall && socket.id === userInPrivateCall.socketId) {
          const targetAdminSocketId = adminForPrivateCall ? adminForPrivateCall.socketId : adminSocketId;
          if (targetAdminSocketId) io.sockets.sockets.get(targetAdminSocketId)?.emit('private-call-user-disconnected', { userSocketId: socket.id, userAppUserId: socket.data.appUserId });
          userInPrivateCall = null; adminForPrivateCall = null;
        }
      });
    });
    res.socket.server.io = io;
  }
  console.log("Socket.IO: SocketHandler API route completing HTTP response.");
  res.end();
}
