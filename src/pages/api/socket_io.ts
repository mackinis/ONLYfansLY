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
const SITE_SETTINGS_CACHE_DURATION = 3 * 1000; // 3 segundos de cache

async function getRefreshedSiteSettings(): Promise<SiteSettings | null> {
  try {
    siteSettingsCache = await getSiteSettingsLogic();
    siteSettingsCacheTime = Date.now();
  } catch (error) {
    console.error('Socket.IO: Critical error fetching site settings for refresh:', error);
  }
  return siteSettingsCache;
}

async function getCachedSiteSettings(): Promise<SiteSettings | null> {
  const now = Date.now();
  if (!siteSettingsCache || now - siteSettingsCacheTime > SITE_SETTINGS_CACHE_DURATION) {
    return getRefreshedSiteSettings();
  }
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
    const io = new IOServer(res.socket.server, {
      path: '/api/socket_io',
      addTrailingSlash: false,
      cors: { origin: '*', methods: ['GET', 'POST'] }
    });

    io.on('connection', async (socket: ServerSocket) => {
      const appUserId = socket.handshake.query.appUserId as string | undefined;
      socket.data.appUserId = appUserId;
      console.log(
        `Socket.IO: Client connected - SocketID: ${socket.id}, AppUserID: ${appUserId || 'Anonymous'}, Query:`,
        socket.handshake.query
      );

      let currentSettings = await getCachedSiteSettings();
      if (!currentSettings) currentSettings = await getRefreshedSiteSettings(); // Retries if cache falló

      // Si es el usuario autorizado para llamadas privadas, avisamos al admin si está conectado
      if (appUserId && currentSettings?.liveStreamAuthorizedUserId === appUserId) {
        const adminSocketInstance = adminForPrivateCall
          ? io.sockets.sockets.get(adminForPrivateCall.socketId)
          : null;
        if (adminSocketInstance) {
          adminSocketInstance.emit('authorized-user-status', {
            userId: appUserId,
            isConnected: true,
            userSocketId: socket.id
          });
        }
      }

      socket.on(
        'request-authorized-user-status',
        async ({ targetUserAppId }: { targetUserAppId: string }) => {
          console.log(
            `Socket.IO: Admin ${socket.id} (AppUser: ${socket.data.appUserId}) requested status for user ${targetUserAppId}`
          );
          const targetUserSocket = Array.from(io.sockets.sockets.values()).find(
            s => s.data.appUserId === targetUserAppId
          );
          socket.emit('authorized-user-status', {
            userId: targetUserAppId,
            isConnected: !!targetUserSocket,
            userSocketId: targetUserSocket?.id || null
          });
        }
      );

      socket.on('disconnect', async reason => {
        console.log(
          `Socket.IO: Client disconnected - SocketID: ${socket.id}, AppUserID: ${socket.data.appUserId ||
            'Anonymous'}, Reason: ${reason}`
        );
        // Al desconectar cualquiera, lo borramos de los viewers map
        generalStreamViewers.delete(socket.id);

        // Si el broadcaster se desconecta, avisamos a todos que finalizó el stream
        if (socket.id === generalBroadcasterSocketId) {
          generalBroadcasterSocketId = null;
          currentGeneralStreamTitle = null;
          currentGeneralStreamSubtitle = null;
          currentGeneralStreamIsLoggedInOnly = false;
          io.emit('general-broadcaster-disconnected');
        } else {
          // Si no, notificamos al broadcaster que un viewer se fue
          const broadcasterSocket = generalBroadcasterSocketId
            ? io.sockets.sockets.get(generalBroadcasterSocketId)
            : null;
          broadcasterSocket?.emit('viewer-disconnected', { viewerId: socket.id });
        }

        // Manejo de desconexión en llamada privada
        if (adminForPrivateCall && socket.id === adminForPrivateCall.socketId) {
          if (userInPrivateCall)
            io.sockets.sockets.get(userInPrivateCall.socketId)?.emit('private-call-terminated-by-admin');
          adminForPrivateCall = null;
          userInPrivateCall = null;
        } else if (userInPrivateCall && socket.id === userInPrivateCall.socketId) {
          if (adminForPrivateCall)
            io.sockets.sockets.get(adminForPrivateCall.socketId)?.emit('private-call-user-disconnected', {
              userSocketId: socket.id,
              userAppUserId: socket.data.appUserId
            });
          userInPrivateCall = null;
          adminForPrivateCall = null;
        }

        // Revalidamos el estado del user autorizado, si se iba
        const refreshedSettings = await getCachedSiteSettings();
        if (socket.data.appUserId && refreshedSettings?.liveStreamAuthorizedUserId === socket.data.appUserId) {
          const adminSocketInstance = adminForPrivateCall
            ? io.sockets.sockets.get(adminForPrivateCall.socketId)
            : null;
          adminSocketInstance?.emit('authorized-user-status', {
            userId: socket.data.appUserId,
            isConnected: false,
            userSocketId: socket.id
          });
        }
      });

      /**
       * ———————— 1) REGISTRAR NUEVO BROADCASTER GENERAL ————————
       */
      socket.on(
        'register-general-broadcaster',
        async (data?: { streamTitle?: string; streamSubtitle?: string }) => {
          const settings = await getCachedSiteSettings();
          if (!settings) {
            socket.emit('general-stream-error', { message: 'Server error: Site settings not available.' });
            return;
          }
          // Si hay llamada privada en curso con otro admin, no puede iniciar el general stream
          if (
            (adminForPrivateCall &&
              adminForPrivateCall.socketId === socket.id &&
              userInPrivateCall) ||
            (adminForPrivateCall && adminForPrivateCall.socketId !== socket.id)
          ) {
            socket.emit('general-stream-error', {
              message: 'Cannot start general stream due to private call session.'
            });
            return;
          }

          // Guardamos datos del broadcaster
          generalBroadcasterSocketId = socket.id;
          currentGeneralStreamTitle =
            data?.streamTitle || settings.liveStreamDefaultTitle || 'Live Stream';
          currentGeneralStreamSubtitle = data?.streamSubtitle || '';
          currentGeneralStreamIsLoggedInOnly = settings.liveStreamForLoggedInUsersOnly || false;
          socket.data.isGeneralBroadcaster = true;

          // 1) Emitimos a todos los clientes que ahora sí hay un broadcaster listo
          io.emit('general-broadcaster-ready', {
            broadcasterId: generalBroadcasterSocketId,
            streamTitle: currentGeneralStreamTitle,
            streamSubtitle: currentGeneralStreamSubtitle,
            isLoggedInOnly: currentGeneralStreamIsLoggedInOnly
          });

          // 2) ¡IMPORTANTE! Si ya había viewers conectados antes de que el admin se registrara,
          //    hay que notificarles a todos para que el admin genere la oferta WebRTC hacia ellos.
          //    (De lo contrario, esos viewers nunca entraron en generalStreamViewers y jamás reciben offer.)
          const broadcasterSocket = io.sockets.sockets.get(generalBroadcasterSocketId);
          if (broadcasterSocket) {
            for (const [viewerId] of generalStreamViewers) {
              // Emitimos un “new-general-viewer” al admin para cada viewer existente
              broadcasterSocket.emit('new-general-viewer', { viewerId });
            }
          }
        }
      );

      /**
       * ———————— 2) REGISTRAR NUEVO VIEWER GENERAL ————————
       */
      socket.on('register-general-viewer', async () => {
        console.log(`Socket.IO: Received 'register-general-viewer' from ${socket.id}`);
        const settings = await getCachedSiteSettings();
        if (!settings) {
          console.error(
            "Socket.IO: Cannot register viewer, site settings unavailable."
          );
          return;
        }

        if (generalBroadcasterSocketId) {
          // Si es streaming solo para registrados, chequeamos que el viewer tenga appUserId
          if (currentGeneralStreamIsLoggedInOnly && !socket.data.appUserId) {
            socket.emit('general-stream-access-denied', {
              message: 'This live stream is for registered users only.'
            });
            return;
          }
          // Guardamos este viewer en el mapa
          generalStreamViewers.set(socket.id, socket);

          // 1) Le avisamos a este viewer que hay un broadcaster listo
          socket.emit('general-broadcaster-ready', {
            broadcasterId: generalBroadcasterSocketId,
            streamTitle: currentGeneralStreamTitle,
            streamSubtitle: currentGeneralStreamSubtitle,
            isLoggedInOnly: currentGeneralStreamIsLoggedInOnly
          });

          // 2) Le avisamos al admin (broadcaster) que hay un viewer nuevo
          const broadcasterSocket = io.sockets.sockets.get(
            generalBroadcasterSocketId
          );
          broadcasterSocket?.emit('new-general-viewer', {
            viewerId: socket.id
          });
        } else {
          // Si no hay broadcaster conectado, simplemente le decimos “estamos offline”
          socket.emit('general-broadcaster-disconnected');
        }
      });

      /**
       * ———————— 3) FLUJO WebRTC ENTRE BROADCASTER → VIEWER ————————
       */
      socket.on(
        'general-stream-offer-to-viewer',
        async ({
          viewerId,
          offer
        }: { viewerId: string; offer: RTCSessionDescriptionInit }) => {
          const viewerSocket = generalStreamViewers.get(viewerId);
          if (viewerSocket) {
            // Si es streaming solo para registrados, chequeamos de nuevo
            if (currentGeneralStreamIsLoggedInOnly && !viewerSocket.data.appUserId) {
              viewerSocket.emit('general-stream-access-denied', {
                message: 'This live stream is for registered users only.'
              });
              return;
            }
            // Reenviamos la oferta al viewer
            viewerSocket.emit('offer-from-general-broadcaster', {
              broadcasterId: socket.id,
              offer
            });
          }
        }
      );

      socket.on(
        'general-stream-answer-to-broadcaster',
        ({
          broadcasterId,
          answer
        }: { broadcasterId: string; answer: RTCSessionDescriptionInit }) => {
          const broadcasterSocket = io.sockets.sockets.get(broadcasterId);
          broadcasterSocket?.emit('answer-from-general-viewer', {
            viewerId: socket.id,
            answer
          });
        }
      );

      socket.on(
        'general-stream-candidate-to-viewer',
        ({ viewerId, candidate }: { viewerId: string; candidate: RTCIceCandidateInit }) => {
          generalStreamViewers
            .get(viewerId)
            ?.emit('candidate-from-general-broadcaster', {
              broadcasterId: socket.id,
              candidate
            });
        }
      );

      socket.on(
        'general-stream-candidate-to-broadcaster',
        ({
          broadcasterId,
          candidate
        }: {
          broadcasterId: string;
          candidate: RTCIceCandidateInit;
        }) => {
          io.sockets.sockets
            .get(broadcasterId)
            ?.emit('candidate-from-general-viewer', {
              viewerId: socket.id,
              candidate
            });
        }
      );

      socket.on('stop-general-stream', () => {
        if (socket.id === generalBroadcasterSocketId) {
          generalBroadcasterSocketId = null;
          currentGeneralStreamTitle = null;
          currentGeneralStreamSubtitle = null;
          currentGeneralStreamIsLoggedInOnly = false;
          io.emit('general-broadcaster-disconnected');
        }
      });

      /**
       * ———————— 4) Resto del código de llamadas privadas, etc… ————————
       * (No lo incluyo porque no era la parte que fallaba)
       */
      socket.on('admin-initiate-private-call-request', async ({ targetUserAppId }) => { /* … */ });
      socket.on('user-accepts-private-call', ({ adminSocketId }) => { /* … */ });
      socket.on('private-sdp-offer', ({ targetSocketId, offer }) => {
        io.to(targetSocketId).emit('private-sdp-offer-received', {
          senderSocketId: socket.id,
          offer
        });
      });
      socket.on('private-sdp-answer', ({ targetSocketId, answer }) => {
        io.to(targetSocketId).emit('private-sdp-answer-received', {
          senderSocketId: socket.id,
          answer
        });
      });
      socket.on('private-ice-candidate', ({ targetSocketId, candidate }) => {
        io.to(targetSocketId).emit('private-ice-candidate-received', {
          senderSocketId: socket.id,
          candidate
        });
      });
      socket.on('admin-end-private-call', ({ userSocketId }) => { /* … */ });
      socket.on('admin-end-private-call-for-user-app-id', ({ targetUserAppId }) => { /* … */ });
      socket.on('user-end-private-call', ({ adminSocketId }) => { /* … */ });
    });

    res.socket.server.io = io;
  }

  console.log(
    'Socket.IO: SocketHandler API route completing HTTP response.'
  );
  res.end();
}
