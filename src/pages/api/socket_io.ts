
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
let currentGeneralStreamSubtitle: string | null = null;
let currentGeneralStreamIsLoggedInOnly: boolean = false;

const generalStreamViewers = new Map<string, ServerSocket>(); // Mapea viewerId → socket

interface CallParticipant {
  socketId: string;
  appUserId: string;
}
let adminForPrivateCall: CallParticipant | null = null;
let userInPrivateCall: CallParticipant | null = null;

const pendingPrivateCalls = new Map<string, { adminSocketId: string; adminAppUserId: string }>();

let siteSettingsCache: SiteSettings | null = null;
let siteSettingsCacheTime: number = 0;
const SITE_SETTINGS_CACHE_DURATION = 3 * 1000;

async function getRefreshedSiteSettings(): Promise<SiteSettings | null> {
  try {
    siteSettingsCache = await getSiteSettingsLogic();
    siteSettingsCacheTime = Date.now();
    console.log("Socket.IO: Site settings cache refreshed.");
  } catch (error) {
    console.error('Socket.IO: Error al refrescar site settings:', error);
  }
  return siteSettingsCache;
}

async function getCachedSiteSettings(): Promise<SiteSettings | null> {
  const now = Date.now();
  if (!siteSettingsCache || now - siteSettingsCacheTime > SITE_SETTINGS_CACHE_DURATION) {
    console.log("Socket.IO: Cache miss or expired, refreshing site settings.");
    return getRefreshedSiteSettings();
  }
  console.log("Socket.IO: Using cached site settings.");
  return siteSettingsCache;
}

getRefreshedSiteSettings();

export const config = { api: { bodyParser: false } };

export default async function SocketHandler(
  req: NextApiRequest,
  res: NextApiResponseWithSocket
) {
  console.log(`Socket.IO: API route /api/socket_io hit. Method: ${req.method}`);

  if (!res.socket.server.io) {
    console.log("Socket.IO: Initializing new IOServer instance.");
    const io = new IOServer(res.socket.server, {
      path: '/api/socket_io',
      addTrailingSlash: false,
      cors: { origin: '*', methods: ['GET', 'POST'] }
    });

    io.on('connection', async (socket: ServerSocket) => {
      try {
        const appUserId = socket.handshake.query.appUserId as string | undefined;
        socket.data.appUserId = appUserId;
        console.log(
          `Socket.IO: Cliente conectado → SocketID: ${socket.id}, AppUserID: ${
            appUserId || 'Anonymous'
          }`
        );

        if (appUserId && pendingPrivateCalls.has(appUserId)) {
          const callInfo = pendingPrivateCalls.get(appUserId)!;
          pendingPrivateCalls.delete(appUserId); // Remove once invite is sent
          if (socket.connected) {
            console.log(`Socket.IO: Emitting pending private-call-invite-from-admin to user ${appUserId}, socket ${socket.id}`);
            socket.emit('private-call-invite-from-admin', {
              adminSocketId: callInfo.adminSocketId,
              adminAppUserId: callInfo.adminAppUserId
            });
          }
        }

        let currentSettings = await getCachedSiteSettings();
        if (!currentSettings) currentSettings = await getRefreshedSiteSettings();

        if (
          appUserId &&
          currentSettings?.liveStreamAuthorizedUserId === appUserId
        ) {
          const adminSocketInstance = adminForPrivateCall
            ? io.sockets.sockets.get(adminForPrivateCall.socketId)
            : null;
          if (adminSocketInstance && adminSocketInstance.connected) {
            console.log(`Socket.IO: Emitting authorized-user-status (connected) for user ${appUserId} to admin ${adminForPrivateCall.socketId}`);
            adminSocketInstance.emit('authorized-user-status', {
              userId: appUserId,
              isConnected: true,
              userSocketId: socket.id
            });
          }
        }
      } catch (connectionError) {
        console.error(`Socket.IO: Error during initial connection logic for socket ${socket.id}:`, connectionError);
      }


      socket.on(
        'request-authorized-user-status',
        async ({ targetUserAppId }: { targetUserAppId: string; }) => {
          try {
            console.log(`Socket.IO: Admin ${socket.id} requesting status for targetUserAppId ${targetUserAppId}`);
            const targetUserSocket = Array.from(io.sockets.sockets.values()).find(
              (s) => s.data.appUserId === targetUserAppId
            );
            if (socket.connected) {
              socket.emit('authorized-user-status', {
                userId: targetUserAppId,
                isConnected: !!targetUserSocket,
                userSocketId: targetUserSocket?.id || null
              });
            }
          } catch (error) {
            console.error(`Socket.IO: Error in 'request-authorized-user-status' for socket ${socket.id}:`, error);
          }
        }
      );

      socket.on('disconnect', async (reason) => {
        try {
          console.log(
            `Socket.IO: Cliente desconectado → SocketID: ${socket.id}, AppUserID: ${
              socket.data.appUserId || 'Anonymous'
            }, Reason: ${reason}`
          );

          generalStreamViewers.delete(socket.id);

          if (socket.id === generalBroadcasterSocketId) {
            console.log(`Socket.IO: General broadcaster ${socket.id} disconnected. Ending stream.`);
            generalBroadcasterSocketId = null;
            currentGeneralStreamTitle = null;
            currentGeneralStreamSubtitle = null;
            currentGeneralStreamIsLoggedInOnly = false;
            io.emit('general-broadcaster-disconnected');
          } else {
            const broadcasterSocket = generalBroadcasterSocketId
              ? io.sockets.sockets.get(generalBroadcasterSocketId)
              : null;
            if (broadcasterSocket && broadcasterSocket.connected) {
              broadcasterSocket.emit('viewer-disconnected', { viewerId: socket.id });
            }
          }

          if (adminForPrivateCall && socket.id === adminForPrivateCall.socketId) {
            console.log(`Socket.IO: Admin ${socket.id} for private call disconnected.`);
            if (userInPrivateCall) {
              const userSocketInstance = io.sockets.sockets.get(userInPrivateCall.socketId);
              if (userSocketInstance && userSocketInstance.connected) {
                userSocketInstance.emit('private-call-terminated-by-admin');
              }
            }
            adminForPrivateCall = null;
            userInPrivateCall = null;
            for (const [userId, info] of pendingPrivateCalls) {
              if (info.adminSocketId === socket.id) {
                pendingPrivateCalls.delete(userId);
              }
            }
          } else if (userInPrivateCall && socket.id === userInPrivateCall.socketId) {
            console.log(`Socket.IO: User ${socket.id} in private call disconnected.`);
            if (adminForPrivateCall) {
              const adminSocketInstance = io.sockets.sockets.get(adminForPrivateCall.socketId);
              if (adminSocketInstance && adminSocketInstance.connected) {
                adminSocketInstance.emit('private-call-user-disconnected', {
                  userSocketId: socket.id,
                  userAppUserId: socket.data.appUserId
                });
              }
            }
            userInPrivateCall = null;
            adminForPrivateCall = null;
          }

          const refreshedSettings = await getCachedSiteSettings();
          if (
            socket.data.appUserId &&
            refreshedSettings?.liveStreamAuthorizedUserId === socket.data.appUserId
          ) {
            const adminSocketInstance = adminForPrivateCall ? io.sockets.sockets.get(adminForPrivateCall.socketId) : Array.from(io.sockets.sockets.values()).find(s => s.data.appUserId === process.env.ADMIN_APP_USER_ID_PLACEHOLDER); // Fallback if adminForPrivateCall is null
            if (adminSocketInstance && adminSocketInstance.connected) {
              adminSocketInstance.emit('authorized-user-status', {
                userId: socket.data.appUserId,
                isConnected: false,
                userSocketId: socket.id
              });
            }
          }
        } catch (error) {
          console.error(`Socket.IO: Error in 'disconnect' handler for socket ${socket.id}:`, error);
        }
      });
      
      socket.on('admin-signals-new-general-stream', async (data) => {
        try {
          console.log(`Socket.IO: Admin ${socket.id} signals new general stream:`, data);
          // The admin is the broadcaster, so we update the server state
          generalBroadcasterSocketId = socket.id;
          currentGeneralStreamTitle = data.streamTitle;
          currentGeneralStreamSubtitle = data.streamSubtitle;
          currentGeneralStreamIsLoggedInOnly = data.isLoggedInOnly;
          socket.data.isGeneralBroadcaster = true;
          
          // Notify all *other* clients to reconnect/refresh for the new stream info
          console.log(`Socket.IO: Broadcasting 'force-viewers-reconnect' from server due to admin signal.`);
          socket.broadcast.emit('force-viewers-reconnect', data);

        } catch (error) {
            console.error(`Socket.IO: Error in 'admin-signals-new-general-stream' for socket ${socket.id}:`, error);
        }
      });

      socket.on('register-general-broadcaster', async (data?: { streamTitle?: string; streamSubtitle?: string; isLoggedInOnly?: boolean }) => {
        try {
          console.log(`Socket.IO: Admin ${socket.id} trying to register as general broadcaster with data:`, data);
          const settings = await getCachedSiteSettings();
          if (!settings) {
            if (socket.connected) socket.emit('general-stream-error', { message: 'Server error: Site settings not available.' });
            return;
          }
          if ((adminForPrivateCall && adminForPrivateCall.socketId === socket.id && userInPrivateCall) || (adminForPrivateCall && adminForPrivateCall.socketId !== socket.id)) {
            if (socket.connected) socket.emit('general-stream-error', { message: 'Cannot start general stream due to private call session.' });
            return;
          }

          generalBroadcasterSocketId = socket.id;
          currentGeneralStreamTitle = data?.streamTitle || settings.liveStreamDefaultTitle || 'Live Stream';
          currentGeneralStreamSubtitle = data?.streamSubtitle || '';
          currentGeneralStreamIsLoggedInOnly = data?.isLoggedInOnly ?? (settings.liveStreamForLoggedInUsersOnly || false);
          socket.data.isGeneralBroadcaster = true;

          console.log(`Socket.IO: Admin ${socket.id} registered as general broadcaster. Title: ${currentGeneralStreamTitle}, Subtitle: ${currentGeneralStreamSubtitle}, LoggedInOnly: ${currentGeneralStreamIsLoggedInOnly}`);

          // Notify existing viewers and also emit a general ready event for newcomers
          const broadcastData = {
              broadcasterId: generalBroadcasterSocketId,
              streamTitle: currentGeneralStreamTitle,
              streamSubtitle: currentGeneralStreamSubtitle,
              isLoggedInOnly: currentGeneralStreamIsLoggedInOnly
          };
          
          generalStreamViewers.forEach((viewerSocket, viewerId) => {
            if (currentGeneralStreamIsLoggedInOnly && !viewerSocket.data.appUserId) {
              if (viewerSocket.connected) viewerSocket.emit('general-stream-access-denied', { message: 'This live stream is for registered users only.' });
            } else {
              if (viewerSocket.connected) viewerSocket.emit('general-broadcaster-ready', broadcastData);
              if (socket.connected) socket.emit('new-general-viewer', { viewerId }); // Tell admin to send offer
            }
          });
          // For any client that connects *after* this point, or was not in generalStreamViewers map
          io.emit('general-broadcaster-ready', broadcastData);

        } catch (error) {
          console.error(`Socket.IO: Error in 'register-general-broadcaster' for socket ${socket.id}:`, error);
        }
      });

      socket.on('register-general-viewer', async () => {
        try {
          console.log(`Socket.IO: Client ${socket.id} (AppUser: ${socket.data.appUserId || 'Anon'}) trying to register as general viewer.`);
          const settings = await getCachedSiteSettings();
          if (!settings) return;

          if (generalBroadcasterSocketId) {
            if (currentGeneralStreamIsLoggedInOnly && !socket.data.appUserId) {
              if (socket.connected) socket.emit('general-stream-access-denied', { message: 'This live stream is for registered users only.' });
              return;
            }
            generalStreamViewers.set(socket.id, socket);
            if (socket.connected) {
              socket.emit('general-broadcaster-ready', {
                broadcasterId: generalBroadcasterSocketId,
                streamTitle: currentGeneralStreamTitle,
                streamSubtitle: currentGeneralStreamSubtitle,
                isLoggedInOnly: currentGeneralStreamIsLoggedInOnly
              });
            }
            const broadcasterSocket = io.sockets.sockets.get(generalBroadcasterSocketId);
            if (broadcasterSocket && broadcasterSocket.connected) {
              broadcasterSocket.emit('new-general-viewer', { viewerId: socket.id });
            }
          } else {
            if (socket.connected) socket.emit('general-broadcaster-disconnected');
          }
        } catch (error) {
          console.error(`Socket.IO: Error in 'register-general-viewer' for socket ${socket.id}:`, error);
        }
      });

      socket.on('general-stream-offer-to-viewer', async ({ viewerId, offer }: { viewerId: string; offer: RTCSessionDescriptionInit; }) => {
        try {
          console.log(`Socket.IO: Broadcaster ${socket.id} sending offer to viewer ${viewerId}`);
          const viewerSocket = generalStreamViewers.get(viewerId);
          if (viewerSocket && viewerSocket.connected && (!currentGeneralStreamIsLoggedInOnly || !!viewerSocket.data.appUserId)) {
            viewerSocket.emit('offer-from-general-broadcaster', { broadcasterId: socket.id, offer });
          } else {
            if (viewerSocket) console.log(`Socket.IO: Viewer ${viewerId} not eligible or disconnected for offer.`);
            generalStreamViewers.delete(viewerId);
          }
        } catch (error) {
          console.error(`Socket.IO: Error in 'general-stream-offer-to-viewer' for socket ${socket.id}:`, error);
        }
      });

      socket.on('general-stream-answer-to-broadcaster', ({ broadcasterId, answer }: { broadcasterId: string; answer: RTCSessionDescriptionInit }) => {
        try {
          console.log(`Socket.IO: Viewer ${socket.id} sending answer to broadcaster ${broadcasterId}`);
          const broadcasterSocket = io.sockets.sockets.get(broadcasterId);
          if (broadcasterSocket && broadcasterSocket.connected) {
            broadcasterSocket.emit('answer-from-general-viewer', { viewerId: socket.id, answer });
          }
        } catch (error) {
          console.error(`Socket.IO: Error in 'general-stream-answer-to-broadcaster' for socket ${socket.id}:`, error);
        }
      });

      socket.on('general-stream-candidate-to-viewer', ({ viewerId, candidate }: { viewerId: string; candidate: RTCIceCandidateInit }) => {
        try {
          const viewerSocket = generalStreamViewers.get(viewerId);
          if (viewerSocket && viewerSocket.connected) {
            viewerSocket.emit('candidate-from-general-broadcaster', { broadcasterId: socket.id, candidate });
          } else {
            generalStreamViewers.delete(viewerId);
          }
        } catch (error) {
          console.error(`Socket.IO: Error in 'general-stream-candidate-to-viewer' for socket ${socket.id}:`, error);
        }
      });

      socket.on('general-stream-candidate-to-broadcaster', ({ broadcasterId, candidate }: { broadcasterId: string; candidate: RTCIceCandidateInit }) => {
        try {
          const broadcasterSocket = io.sockets.sockets.get(broadcasterId);
          if (broadcasterSocket && broadcasterSocket.connected) {
            broadcasterSocket.emit('candidate-from-general-viewer', { viewerId: socket.id, candidate });
          }
        } catch (error) {
          console.error(`Socket.IO: Error in 'general-stream-candidate-to-broadcaster' for socket ${socket.id}:`, error);
        }
      });

      socket.on('stop-general-stream', () => {
        try {
          if (socket.id === generalBroadcasterSocketId) {
            console.log(`Socket.IO: Admin ${socket.id} explicitly stopped general stream.`);
            generalBroadcasterSocketId = null;
            currentGeneralStreamTitle = null;
            currentGeneralStreamSubtitle = null;
            currentGeneralStreamIsLoggedInOnly = false;
            generalStreamViewers.clear();
            io.emit('general-broadcaster-disconnected');
          }
        } catch (error) {
          console.error(`Socket.IO: Error in 'stop-general-stream' for socket ${socket.id}:`, error);
        }
      });

      socket.on('admin-initiate-private-call-request', async ({ targetUserAppId }: { targetUserAppId: string }) => {
        try {
          console.log(`Socket.IO: Admin ${socket.id} (AppUser: ${socket.data.appUserId}) initiating private call to targetUserAppId ${targetUserAppId}`);
          const currentSettingsForCall = await getCachedSiteSettings();
          if (!socket.data.appUserId || !currentSettingsForCall) {
            if (socket.connected) socket.emit('private-call-error', { message: 'Server/user data not ready.' });
            return;
          }
          if (generalBroadcasterSocketId === socket.id) {
            if (socket.connected) socket.emit('private-call-error', { message: 'Stop general stream first.' });
            return;
          }
          if (adminForPrivateCall && adminForPrivateCall.socketId !== socket.id) {
            if (socket.connected) socket.emit('private-call-error', { message: 'Another admin is in a call or waiting.' });
            return;
          }
          if (userInPrivateCall) {
            if (socket.connected) socket.emit('private-call-error', { message: `User ${userInPrivateCall.appUserId} is already in a call.` });
            return;
          }

          adminForPrivateCall = { socketId: socket.id, appUserId: socket.data.appUserId! };
          const targetUserSocket = Array.from(io.sockets.sockets.values()).find(s => s.data.appUserId === targetUserAppId);

          if (targetUserSocket && targetUserSocket.connected) {
            console.log(`Socket.IO: Target user ${targetUserAppId} is connected (socket ${targetUserSocket.id}). Emitting invite.`);
            targetUserSocket.emit('private-call-invite-from-admin', { adminSocketId: socket.id, adminAppUserId: adminForPrivateCall.appUserId });
            if (socket.connected) socket.emit('private-call-invite-sent-to-user', { userSocketId: targetUserSocket.id, userAppUserId: targetUserAppId });
          } else {
            console.log(`Socket.IO: Target user ${targetUserAppId} not connected. Adding to pending calls.`);
            pendingPrivateCalls.set(targetUserAppId, { adminSocketId: socket.id, adminAppUserId: adminForPrivateCall.appUserId });
            if (socket.connected) socket.emit('private-call-user-not-connected', { targetUserAppId });
          }
        } catch (error) {
          console.error(`Socket.IO: Error in 'admin-initiate-private-call-request' for socket ${socket.id}:`, error);
        }
      });

      socket.on('user-accepts-private-call', ({ adminSocketId }: { adminSocketId: string }) => {
        try {
          console.log(`Socket.IO: User ${socket.id} (AppUser: ${socket.data.appUserId}) accepts private call from admin ${adminSocketId}`);
          if (!adminForPrivateCall || adminSocketId !== adminForPrivateCall.socketId || !socket.data.appUserId) {
            if (socket.connected) socket.emit('private-call-error', { message: 'Admin not ready or invalid request.' });
            return;
          }
          if (userInPrivateCall && userInPrivateCall.socketId !== socket.id) {
            if (socket.connected) socket.emit('private-call-error', { message: 'Admin in call with another user.' });
            return;
          }
          userInPrivateCall = { socketId: socket.id, appUserId: socket.data.appUserId };
          const adminSock = io.sockets.sockets.get(adminSocketId);
          if (adminSock && adminSock.connected) {
            adminSock.emit('private-call-user-ready-for-offer', { userSocketId: socket.id, userAppUserId: socket.data.appUserId });
          } else {
            userInPrivateCall = null;
            adminForPrivateCall = null; // Admin disconnected
            if (socket.connected) socket.emit('private-call-error', { message: 'Admin disconnected.' });
          }
        } catch (error) {
          console.error(`Socket.IO: Error in 'user-accepts-private-call' for socket ${socket.id}:`, error);
        }
      });

      socket.on('private-sdp-offer', ({ targetSocketId, offer }: { targetSocketId: string; offer: RTCSessionDescriptionInit }) => {
        try {
          const targetSocketInstance = io.sockets.sockets.get(targetSocketId);
          if (targetSocketInstance && targetSocketInstance.connected) {
            targetSocketInstance.emit('private-sdp-offer-received', { senderSocketId: socket.id, offer });
          }
        } catch (error) {
          console.error(`Socket.IO: Error in 'private-sdp-offer' for socket ${socket.id}:`, error);
        }
      });

      socket.on('private-sdp-answer', ({ targetSocketId, answer }: { targetSocketId: string; answer: RTCSessionDescriptionInit }) => {
        try {
          const targetSocketInstance = io.sockets.sockets.get(targetSocketId);
          if (targetSocketInstance && targetSocketInstance.connected) {
            targetSocketInstance.emit('private-sdp-answer-received', { senderSocketId: socket.id, answer });
          }
        } catch (error) {
          console.error(`Socket.IO: Error in 'private-sdp-answer' for socket ${socket.id}:`, error);
        }
      });

      socket.on('private-ice-candidate', ({ targetSocketId, candidate }: { targetSocketId: string; candidate: RTCIceCandidateInit }) => {
        try {
          const targetSocketInstance = io.sockets.sockets.get(targetSocketId);
          if (targetSocketInstance && targetSocketInstance.connected) {
            targetSocketInstance.emit('private-ice-candidate-received', { senderSocketId: socket.id, candidate });
          }
        } catch (error) {
          console.error(`Socket.IO: Error in 'private-ice-candidate' for socket ${socket.id}:`, error);
        }
      });

      socket.on('admin-end-private-call', ({ userSocketId }: { userSocketId?: string }) => {
        try {
          if (adminForPrivateCall && socket.id === adminForPrivateCall.socketId) {
            console.log(`Socket.IO: Admin ${socket.id} ending private call.`);
            const targetUserSocketId = userInPrivateCall ? userInPrivateCall.socketId : userSocketId;
            if (targetUserSocketId) {
              const userSocketInstance = io.sockets.sockets.get(targetUserSocketId);
              if (userSocketInstance && userSocketInstance.connected) {
                userSocketInstance.emit('private-call-terminated-by-admin');
              }
            }
            adminForPrivateCall = null;
            userInPrivateCall = null;
            // Clear any pending calls initiated by this admin
             for (const [userId, info] of pendingPrivateCalls) {
              if (info.adminSocketId === socket.id) {
                pendingPrivateCalls.delete(userId);
              }
            }
          }
        } catch (error) {
          console.error(`Socket.IO: Error in 'admin-end-private-call' for socket ${socket.id}:`, error);
        }
      });
      
      socket.on('admin-end-private-call-for-user-app-id', ({ targetUserAppId }: { targetUserAppId: string }) => {
        try {
            if (adminForPrivateCall && socket.id === adminForPrivateCall.socketId) {
                console.log(`Socket.IO: Admin ${socket.id} ending private call for user app ID ${targetUserAppId}.`);
                const targetUserSocket = Array.from(io.sockets.sockets.values()).find(s => s.data.appUserId === targetUserAppId);
                if (targetUserSocket && targetUserSocket.connected) {
                    targetUserSocket.emit('private-call-terminated-by-admin');
                }
                adminForPrivateCall = null;
                userInPrivateCall = null; // Ensure userInPrivateCall is also cleared
                pendingPrivateCalls.delete(targetUserAppId); // Remove from pending calls if it was there
            }
        } catch (error) {
            console.error(`Socket.IO: Error in 'admin-end-private-call-for-user-app-id' for socket ${socket.id}:`, error);
        }
      });


      socket.on('user-end-private-call', ({ adminSocketId }: { adminSocketId?: string }) => {
        try {
          if (userInPrivateCall && socket.id === userInPrivateCall.socketId) {
            console.log(`Socket.IO: User ${socket.id} ending private call.`);
            const targetAdminSocketId = adminForPrivateCall ? adminForPrivateCall.socketId : adminSocketId;
            if (targetAdminSocketId) {
              const adminSocketInstance = io.sockets.sockets.get(targetAdminSocketId);
              if (adminSocketInstance && adminSocketInstance.connected) {
                adminSocketInstance.emit('private-call-user-disconnected', { userSocketId: socket.id, userAppUserId: socket.data.appUserId });
              }
            }
            userInPrivateCall = null;
            adminForPrivateCall = null;
          }
        } catch (error) {
          console.error(`Socket.IO: Error in 'user-end-private-call' for socket ${socket.id}:`, error);
        }
      });

    });

    res.socket.server.io = io;
    console.log("Socket.IO: IOServer instance attached to server.");
  } else {
    console.log("Socket.IO: IOServer instance already running.");
  }

  console.log('Socket.IO: SocketHandler API route finalizó respuesta');
  res.end();
}

    