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

// Mapa para almacenar llamadas privadas pendientes { appUserId → { adminSocketId, adminAppUserId } }
const pendingPrivateCalls = new Map<string, { adminSocketId: string; adminAppUserId: string }>();

let siteSettingsCache: SiteSettings | null = null;
let siteSettingsCacheTime: number = 0;
const SITE_SETTINGS_CACHE_DURATION = 3 * 1000; // 3 segs de cache

async function getRefreshedSiteSettings(): Promise<SiteSettings | null> {
  try {
    siteSettingsCache = await getSiteSettingsLogic();
    siteSettingsCacheTime = Date.now();
  } catch (error) {
    console.error('Socket.IO: Error al refrescar site settings:', error);
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

// Cargamos inicialmente
getRefreshedSiteSettings();

export const config = { api: { bodyParser: false } };

export default async function SocketHandler(
  req: NextApiRequest,
  res: NextApiResponseWithSocket
) {
  console.log(`Socket.IO: API route /api/socket_io hit. Method: ${req.method}`);

  // Sólo inicializamos el server de Socket.IO si no existe
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
        `Socket.IO: Cliente conectado → SocketID: ${socket.id}, AppUserID: ${
          appUserId || 'Anonymous'
        }`
      );

      // Si hay una llamada privada pendiente para este usuario, enviamos la invitación ahora
      if (appUserId && pendingPrivateCalls.has(appUserId)) {
        const { adminSocketId, adminAppUserId } = pendingPrivateCalls.get(appUserId)!;
        pendingPrivateCalls.delete(appUserId);
        socket.emit('private-call-invite-from-admin', {
          adminSocketId,
          adminAppUserId
        });
      }

      // Actualizamos cache de settings
      let currentSettings = await getCachedSiteSettings();
      if (!currentSettings) currentSettings = await getRefreshedSiteSettings();

      // Si este socket es el usuario autorizado exclusivo para llamadas privadas,
      // notificamos al admin (si está esperando)
      if (
        appUserId &&
        currentSettings?.liveStreamAuthorizedUserId === appUserId
      ) {
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

      // ————————————————————————————————————————————————————————————————————
      // 1) Petición del admin para ver si el usuario autorizado está conectado
      socket.on(
        'request-authorized-user-status',
        async ({
          targetUserAppId
        }: {
          targetUserAppId: string;
        }) => {
          console.log(
            `Socket.IO: Admin ${socket.id} (AppUser: ${socket.data.appUserId}) solicitó status de usuario ${targetUserAppId}`
          );
          const targetUserSocket = Array.from(io.sockets.sockets.values()).find(
            (s) => s.data.appUserId === targetUserAppId
          );
          socket.emit('authorized-user-status', {
            userId: targetUserAppId,
            isConnected: !!targetUserSocket,
            userSocketId: targetUserSocket?.id || null
          });
        }
      );

      // ————————————————————————————————————————————————————————————————————
      // 2) Al desconectarse cualquier socket:
      socket.on('disconnect', async (reason) => {
        console.log(
          `Socket.IO: Cliente desconectado → SocketID: ${socket.id}, AppUserID: ${
            socket.data.appUserId || 'Anonymous'
          }, Reason: ${reason}`
        );

        // Si se desconectó un viewer, lo quitamos del mapa
        generalStreamViewers.delete(socket.id);

        // Si se desconectó el broadcaster general (admin),
        // emitimos a todos que el stream terminó
        if (socket.id === generalBroadcasterSocketId) {
          generalBroadcasterSocketId = null;
          currentGeneralStreamTitle = null;
          currentGeneralStreamSubtitle = null;
          currentGeneralStreamIsLoggedInOnly = false;
          io.emit('general-broadcaster-disconnected');
        } else {
          // Si se desconectó un viewer en medio de la emisión,
          // avisamos al broadcaster para limpiar el RTCPeerConnection local
          const broadcasterSocket = generalBroadcasterSocketId
            ? io.sockets.sockets.get(generalBroadcasterSocketId)
            : null;
          broadcasterSocket?.emit('viewer-disconnected', {
            viewerId: socket.id
          });
        }

        // Lógica de llamada privada (si admin o user se desconecta):
        if (adminForPrivateCall && socket.id === adminForPrivateCall.socketId) {
          if (userInPrivateCall) {
            io.sockets.sockets
              .get(userInPrivateCall.socketId)
              ?.emit('private-call-terminated-by-admin');
          }
          adminForPrivateCall = null;
          userInPrivateCall = null;
          // También borramos cualquier llamada pendiente iniciada por este admin
          for (const [userId, info] of pendingPrivateCalls) {
            if (info.adminSocketId === socket.id) {
              pendingPrivateCalls.delete(userId);
            }
          }
        } else if (
          userInPrivateCall &&
          socket.id === userInPrivateCall.socketId
        ) {
          if (adminForPrivateCall) {
            io.sockets.sockets
              .get(adminForPrivateCall.socketId)
              ?.emit('private-call-user-disconnected', {
                userSocketId: socket.id,
                userAppUserId: socket.data.appUserId
              });
          }
          userInPrivateCall = null;
          adminForPrivateCall = null;
        }

        // Si el usuario autorizado (registro) se desconecta, avisamos al admin
        const refreshedSettings = await getCachedSiteSettings();
        if (
          socket.data.appUserId &&
          refreshedSettings?.liveStreamAuthorizedUserId === socket.data.appUserId
        ) {
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

      // ————————————————————————————————————————————————————————————————————
      // 3) Admin ─► registra el stream público (“general broadcaster”)
      socket.on(
        'register-general-broadcaster',
        async (data?: { streamTitle?: string; streamSubtitle?: string }) => {
          const settings = await getCachedSiteSettings();
          if (!settings) {
            socket.emit('general-stream-error', {
              message: 'Server error: Site settings not available.'
            });
            return;
          }

          // Si hay una llamada privada en curso, no puede arrancar el
          // stream general al mismo tiempo
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

          // 3.1) Guardamos datos del broadcaster
          generalBroadcasterSocketId = socket.id;
          currentGeneralStreamTitle =
            data?.streamTitle || settings.liveStreamDefaultTitle || 'Live Stream';
          currentGeneralStreamSubtitle = data?.streamSubtitle || '';
          currentGeneralStreamIsLoggedInOnly =
            settings.liveStreamForLoggedInUsersOnly || false;
          socket.data.isGeneralBroadcaster = true;

          // 3.2) A TODOS los viewers ya registrados antes
          // les enviamos “general-broadcaster-ready” para que se preparen a recibir offer
          // Y, adicionalmente, enviamos un “new-general-viewer” **al propio broadcaster** 
          // para que el admin (cliente) ejecute createOffer()
          for (const [viewerId, viewerSocket] of generalStreamViewers) {
            // Si el stream es solo para usuarios logueados, nos aseguramos:
            if (
              currentGeneralStreamIsLoggedInOnly &&
              !viewerSocket.data.appUserId
            ) {
              viewerSocket.emit('general-stream-access-denied', {
                message: 'This live stream is for registered users only.'
              });
              continue;
            }

            // 3.2.1) Avisamos al viewer: “el broadcaster está listo,
            // aquí están título/subtítulo/flag de login‐only”
            viewerSocket.emit('general-broadcaster-ready', {
              broadcasterId: generalBroadcasterSocketId,
              streamTitle: currentGeneralStreamTitle,
              streamSubtitle: currentGeneralStreamSubtitle,
              isLoggedInOnly: currentGeneralStreamIsLoggedInOnly
            });

            // 3.2.2) Avisamos al broadcaster: “tenemos un viewer ya conectado”,
            // para que el admin (cliente) ejecute createOffer()
            socket.emit('new-general-viewer', {
              viewerId: viewerId
            });
          }

          // 3.3) Además, emitimos a todos por si hay usuarios que aún no se han conectado:
          // esto actualizará el estado UI de viewers nuevos que lleguen más tarde.
          io.emit('general-broadcaster-ready', {
            broadcasterId: generalBroadcasterSocketId,
            streamTitle: currentGeneralStreamTitle,
            streamSubtitle: currentGeneralStreamSubtitle,
            isLoggedInOnly: currentGeneralStreamIsLoggedInOnly
          });
        }
      );

      // ————————————————————————————————————————————————————————————————————
      // 4) Viewer ─► se suscribe al stream general
      socket.on('register-general-viewer', async () => {
        console.log(
          `Socket.IO: Recibido 'register-general-viewer' de ${socket.id}`
        );
        const settings = await getCachedSiteSettings();
        if (!settings) {
          console.error(
            'Socket.IO: No se pudo registrar viewer, site settings indisponible.'
          );
          return;
        }

        if (generalBroadcasterSocketId) {
          // Si el stream es “solo para logueados” y este viewer no tiene appUserId
          if (
            currentGeneralStreamIsLoggedInOnly &&
            !socket.data.appUserId
          ) {
            socket.emit('general-stream-access-denied', {
              message: 'This live stream is for registered users only.'
            });
            return;
          }

          // 4.1) Guardamos este viewer en el mapa
          generalStreamViewers.set(socket.id, socket);

          // 4.2) Le avisamos de inmediato al viewer: “el broadcaster ya está listo”,
          // con título/subtítulo y flag de loggedInOnly
          socket.emit('general-broadcaster-ready', {
            broadcasterId: generalBroadcasterSocketId,
            streamTitle: currentGeneralStreamTitle,
            streamSubtitle: currentGeneralStreamSubtitle,
            isLoggedInOnly: currentGeneralStreamIsLoggedInOnly
          });

          // 4.3) También avisamos al broadcaster (admin) de que hay un viewer nuevo,
          // para que lance un createOffer() hacia él.
          const broadcasterSocket = io.sockets.sockets.get(
            generalBroadcasterSocketId
          );
          broadcasterSocket?.emit('new-general-viewer', {
            viewerId: socket.id
          });
        } else {
          // Si no hay broadcaster activo, avisamos al viewer de que no existe stream
          socket.emit('general-broadcaster-disconnected');
        }
      });

      // ————————————————————————————————————————————————————————————————————
      // 5) El broadcaster envía un offer al viewer
      socket.on(
        'general-stream-offer-to-viewer',
        async ({
          viewerId,
          offer
        }: {
          viewerId: string;
          offer: RTCSessionDescriptionInit;
        }) => {
          const viewerSocket = generalStreamViewers.get(viewerId);
          if (
            viewerSocket &&
            (!currentGeneralStreamIsLoggedInOnly ||
              !!viewerSocket.data.appUserId)
          ) {
            viewerSocket.emit('offer-from-general-broadcaster', {
              broadcasterId: socket.id,
              offer
            });
          }
        }
      );

      // 6) El viewer responde el answer al broadcaster
      socket.on(
        'general-stream-answer-to-broadcaster',
        ({ broadcasterId, answer }: { broadcasterId: string; answer: RTCSessionDescriptionInit }) => {
          const broadcasterSocket = io.sockets.sockets.get(broadcasterId);
          broadcasterSocket?.emit('answer-from-general-viewer', {
            viewerId: socket.id,
            answer
          });
        }
      );

      // 7) ICE candidates del broadcaster al viewer
      socket.on(
        'general-stream-candidate-to-viewer',
        ({ viewerId, candidate }: { viewerId: string; candidate: RTCIceCandidateInit }) => {
          const viewerSocket = generalStreamViewers.get(viewerId);
          viewerSocket?.emit('candidate-from-general-broadcaster', {
            broadcasterId: socket.id,
            candidate
          });
        }
      );

      // 8) ICE candidates del viewer al broadcaster
      socket.on(
        'general-stream-candidate-to-broadcaster',
        ({ broadcasterId, candidate }: { broadcasterId: string; candidate: RTCIceCandidateInit }) => {
          io.sockets.sockets.get(broadcasterId)?.emit(
            'candidate-from-general-viewer',
            { viewerId: socket.id, candidate }
          );
        }
      );

      // 9) Cuando el admin detiene el stream con “stop-general-stream”
      socket.on('stop-general-stream', () => {
        if (socket.id === generalBroadcasterSocketId) {
          generalBroadcasterSocketId = null;
          currentGeneralStreamTitle = null;
          currentGeneralStreamSubtitle = null;
          currentGeneralStreamIsLoggedInOnly = false;
          generalStreamViewers.clear();
          io.emit('general-broadcaster-disconnected');
        }
      });

      // ————————————————————————————————————————————————————————————————————
      // 10) Llamada privada (admin → usuario autorizado)
      socket.on(
        'admin-initiate-private-call-request',
        async ({ targetUserAppId }: { targetUserAppId: string }) => {
          const currentSettingsForCall = await getCachedSiteSettings();
          if (!socket.data.appUserId || !currentSettingsForCall) {
            socket.emit('private-call-error', {
              message: 'Server/user data not ready.'
            });
            return;
          }
          if (generalBroadcasterSocketId === socket.id) {
            socket.emit('private-call-error', {
              message: 'Stop general stream first.'
            });
            return;
          }
          if (
            adminForPrivateCall &&
            adminForPrivateCall.socketId !== socket.id
          ) {
            socket.emit('private-call-error', {
              message: 'Another admin en llamada / espera.'
            });
            return;
          }
          if (userInPrivateCall) {
            socket.emit('private-call-error', {
              message: `User ${userInPrivateCall.appUserId} ya está en llamada.`
            });
            return;
          }

          adminForPrivateCall = {
            socketId: socket.id,
            appUserId: socket.data.appUserId!
          };
          const targetUserSocket = Array.from(io.sockets.sockets.values()).find(
            (s) => s.data.appUserId === targetUserAppId
          );
          if (targetUserSocket) {
            targetUserSocket.emit('private-call-invite-from-admin', {
              adminSocketId: socket.id,
              adminAppUserId: adminForPrivateCall.appUserId
            });
            socket.emit('private-call-invite-sent-to-user', {
              userSocketId: targetUserSocket.id,
              userAppUserId: targetUserAppId
            });
          } else {
            // Usuario no conectado aún: guardamos la llamada como pendiente
            pendingPrivateCalls.set(targetUserAppId, {
              adminSocketId: socket.id,
              adminAppUserId: adminForPrivateCall.appUserId
            });
            socket.emit('private-call-user-not-connected', { targetUserAppId });
            // adminForPrivateCall se mantiene para cuando el usuario llegue
          }
        }
      );

      socket.on(
        'user-accepts-private-call',
        ({ adminSocketId }: { adminSocketId: string }) => {
          if (
            !adminForPrivateCall ||
            adminSocketId !== adminForPrivateCall.socketId ||
            !socket.data.appUserId
          ) {
            socket.emit('private-call-error', {
              message: 'Admin no está listo o request inválido.'
            });
            return;
          }
          if (
            userInPrivateCall &&
            userInPrivateCall.socketId !== socket.id
          ) {
            socket.emit('private-call-error', {
              message: 'Admin en llamada con otro usuario.'
            });
            return;
          }
          userInPrivateCall = {
            socketId: socket.id,
            appUserId: socket.data.appUserId
          };
          const adminSock = io.sockets.sockets.get(adminSocketId);
          if (adminSock) {
            adminSock.emit('private-call-user-ready-for-offer', {
              userSocketId: socket.id,
              userAppUserId: socket.data.appUserId
            });
          } else {
            userInPrivateCall = null;
            adminForPrivateCall = null;
            socket.emit('private-call-error', {
              message: 'Admin se desconectó.'
            });
          }
        }
      );

      socket.on(
        'private-sdp-offer',
        ({ targetSocketId, offer }: { targetSocketId: string; offer: RTCSessionDescriptionInit }) =>
          io.to(targetSocketId).emit('private-sdp-offer-received', {
            senderSocketId: socket.id,
            offer
          })
      );
      socket.on(
        'private-sdp-answer',
        ({ targetSocketId, answer }: { targetSocketId: string; answer: RTCSessionDescriptionInit }) =>
          io.to(targetSocketId).emit('private-sdp-answer-received', {
            senderSocketId: socket.id,
            answer
          })
      );
      socket.on(
        'private-ice-candidate',
        ({ targetSocketId, candidate }: { targetSocketId: string; candidate: RTCIceCandidateInit }) =>
          io.to(targetSocketId).emit('private-ice-candidate-received', {
            senderSocketId: socket.id,
            candidate
          })
      );

      socket.on(
        'admin-end-private-call',
        ({ userSocketId }: { userSocketId?: string }) => {
          if (
            adminForPrivateCall &&
            socket.id === adminForPrivateCall.socketId
          ) {
            const targetUserSocketId = userInPrivateCall
              ? userInPrivateCall.socketId
              : userSocketId;
            if (targetUserSocketId)
              io.sockets.sockets
                .get(targetUserSocketId)
                ?.emit('private-call-terminated-by-admin');
            adminForPrivateCall = null;
            userInPrivateCall = null;
            // Limpiamos pendientes si existieran
            for (const [userId, info] of pendingPrivateCalls) {
              if (info.adminSocketId === socket.id) {
                pendingPrivateCalls.delete(userId);
              }
            }
          }
        }
      );
      socket.on(
        'admin-end-private-call-for-user-app-id',
        ({ targetUserAppId }: { targetUserAppId: string }) => {
          if (
            adminForPrivateCall &&
            socket.id === adminForPrivateCall.socketId
          ) {
            const targetUserSocket = Array.from(
              io.sockets.sockets.values()
            ).find((s) => s.data.appUserId === targetUserAppId);
            targetUserSocket?.emit('private-call-terminated-by-admin');
            adminForPrivateCall = null;
            userInPrivateCall = null;
            // Limpiamos pendientes para ese usuario
            pendingPrivateCalls.delete(targetUserAppId);
          }
        }
      );
      socket.on(
        'user-end-private-call',
        ({ adminSocketId }: { adminSocketId?: string }) => {
          if (userInPrivateCall && socket.id === userInPrivateCall.socketId) {
            const targetAdminSocketId = adminForPrivateCall
              ? adminForPrivateCall.socketId
              : adminSocketId;
            if (targetAdminSocketId)
              io.sockets.sockets
                .get(targetAdminSocketId)
                ?.emit('private-call-user-disconnected', {
                  userSocketId: socket.id,
                  userAppUserId: socket.data.appUserId
                });
            userInPrivateCall = null;
            adminForPrivateCall = null;
            // No es necesario borrar pendientes aquí, ya fue atendido
          }
        }
      );
    });

    // Guardamos la instancia de io en res.socket.server para que no se reinicie en cada petición
    res.socket.server.io = io;
  }

  console.log('Socket.IO: SocketHandler API route finalizó respuesta');
  res.end();
}
