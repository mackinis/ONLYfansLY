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
let generalBroadcasterAppUserId: string | null = null; // Guarda el appUserId del broadcaster
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

const pendingPrivateCalls = new Map<
  string,
  { adminSocketId: string; adminAppUserId: string }
>();

let siteSettingsCache: SiteSettings | null = null;
let siteSettingsCacheTime: number = 0;
const SITE_SETTINGS_CACHE_DURATION = 3 * 1000;

async function getRefreshedSiteSettings(): Promise<SiteSettings | null> {
  try {
    siteSettingsCache = await getSiteSettingsLogic();
    siteSettingsCacheTime = Date.now();
    console.log('Socket.IO: Site settings cache refreshed.');
  } catch (error) {
    console.error('Socket.IO: Error al refrescar site settings:', error);
  }
  return siteSettingsCache;
}

async function getCachedSiteSettings(): Promise<SiteSettings | null> {
  const now = Date.now();
  if (!siteSettingsCache || now - siteSettingsCacheTime > SITE_SETTINGS_CACHE_DURATION) {
    console.log('Socket.IO: Cache miss or expired, refreshing site settings.');
    return getRefreshedSiteSettings();
  }
  console.log('Socket.IO: Using cached site settings.');
  return siteSettingsCache;
}

// Inicializamos cache inmediatamente al arrancar el servidor:
getRefreshedSiteSettings();

export const config = { api: { bodyParser: false } };

export default async function SocketHandler(
  req: NextApiRequest,
  res: NextApiResponseWithSocket
) {
  console.log(`Socket.IO: API route /api/socket_io hit. Method: ${req.method}`);

  if (!res.socket.server.io) {
    console.log('Socket.IO: Initializing new IOServer instance.');
    const io = new IOServer(res.socket.server, {
      path: '/api/socket_io',
      addTrailingSlash: false,
      cors: { origin: '*', methods: ['GET', 'POST'] },
    });

    io.on('connection', async (socket: ServerSocket) => {
      try {
        const appUserId = socket.handshake.query.appUserId as string | undefined;
        socket.data.appUserId = appUserId;
        console.log(
          `Socket.IO: Cliente conectado → SocketID: ${socket.id}, AppUserID: ${appUserId || 'Anonymous'}`
        );

        // 1) Si un admin que ya estaba broadcasting se reconecta con el mismo appUserId,
        // reasignamos su socket como broadcaster y reenviamos estado a todos.
        if (
          appUserId &&
          generalBroadcasterAppUserId &&
          appUserId === generalBroadcasterAppUserId
        ) {
          console.log(
            `Socket.IO: Admin reconectado detected (AppUserID: ${appUserId}). Reasignando broadcaster.`
          );
          generalBroadcasterSocketId = socket.id;
          socket.data.isGeneralBroadcaster = true;
          // Notificar a todos que el broadcaster sigue activo
          io.emit('general-broadcaster-ready', {
            broadcasterId: generalBroadcasterSocketId,
            streamTitle: currentGeneralStreamTitle,
            streamSubtitle: currentGeneralStreamSubtitle,
            isLoggedInOnly: currentGeneralStreamIsLoggedInOnly,
          });
        }

        // 2) Si hay llamadas privadas pendentes, reenviar la invitación
        if (appUserId && pendingPrivateCalls.has(appUserId)) {
          const callInfo = pendingPrivateCalls.get(appUserId)!;
          pendingPrivateCalls.delete(appUserId);
          if (socket.connected) {
            console.log(
              `Socket.IO: Emitting pending private-call-invite-from-admin to user ${appUserId}, socket ${socket.id}`
            );
            socket.emit('private-call-invite-from-admin', {
              adminSocketId: callInfo.adminSocketId,
              adminAppUserId: callInfo.adminAppUserId,
            });
          }
        }

        // 3) Notificar al admin si este usuario es el autorizado para private call
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
            console.log(
              `Socket.IO: Emitting authorized-user-status (connected) for user ${appUserId} to admin ${adminForPrivateCall?.socketId}`
            );
            adminSocketInstance.emit('authorized-user-status', {
              userId: appUserId,
              isConnected: true,
              userSocketId: socket.id,
            });
          }
        }

        // 4) Emitir estado inicial de broadcasting al viewer recién conectado
        if (generalBroadcasterSocketId) {
          socket.emit('general-broadcaster-ready', {
            broadcasterId: generalBroadcasterSocketId,
            streamTitle: currentGeneralStreamTitle,
            streamSubtitle: currentGeneralStreamSubtitle,
            isLoggedInOnly: currentGeneralStreamIsLoggedInOnly,
          });
        } else {
          socket.emit('general-broadcaster-disconnected');
        }
      } catch (connectionError) {
        console.error(
          `Socket.IO: Error durante la conexión inicial de ${socket.id}:`,
          connectionError
        );
      }

      // 5) Manejador para que el cliente pregunte si hay un broadcast activo
      socket.on('check-active-broadcast', () => {
        if (generalBroadcasterSocketId) {
          socket.emit('active-broadcast-info', {
            broadcasterId: generalBroadcasterSocketId,
            streamTitle: currentGeneralStreamTitle,
            streamSubtitle: currentGeneralStreamSubtitle,
            isLoggedInOnly: currentGeneralStreamIsLoggedInOnly,
          });
        } else {
          socket.emit('no-active-broadcast');
        }
      });

      // 6) Registro de admin solicitando el estado del usuario autorizado
      socket.on(
        'request-authorized-user-status',
        async ({ targetUserAppId }: { targetUserAppId: string }) => {
          try {
            console.log(
              `Socket.IO: Admin ${socket.id} requesting status para targetUserAppId ${targetUserAppId}`
            );
            const targetUserSocket = Array.from(io.sockets.sockets.values()).find(
              (s) => s.data.appUserId === targetUserAppId
            );
            if (socket.connected) {
              socket.emit('authorized-user-status', {
                userId: targetUserAppId,
                isConnected: !!targetUserSocket,
                userSocketId: targetUserSocket?.id || null,
              });
            }
          } catch (error) {
            console.error(
              `Socket.IO: Error en 'request-authorized-user-status' para socket ${socket.id}:`,
              error
            );
          }
        }
      );

      // 7) Un viewer se registra para el broadcast
      socket.on('register-general-viewer', async () => {
        try {
          console.log(
            `Socket.IO: Client ${socket.id} (AppUser: ${socket.data.appUserId || 'Anon'}) quiere registrarse como viewer.`
          );
          const settings = await getCachedSiteSettings();
          if (!settings) return;

          // Si hay un broadcaster activo
          if (generalBroadcasterSocketId) {
            if (currentGeneralStreamIsLoggedInOnly && !socket.data.appUserId) {
              // Viewer anónimo no autorizado
              if (socket.connected)
                socket.emit('general-stream-access-denied', {
                  message: 'This live stream is for registered users only.',
                });
              return;
            }
            // Solo agregamos si no estaba previamente en el Map
            if (!generalStreamViewers.has(socket.id)) {
              generalStreamViewers.set(socket.id, socket);
              // Notificar al broadcaster que hay un nuevo viewer
              const broadcasterSocket = io.sockets.sockets.get(
                generalBroadcasterSocketId
              );
              if (broadcasterSocket && broadcasterSocket.connected) {
                broadcasterSocket.emit('new-general-viewer', {
                  viewerId: socket.id,
                });
              }
            }
            // Notificar directamente al viewer con detalles del broadcast
            if (socket.connected) {
              socket.emit('general-broadcaster-ready', {
                broadcasterId: generalBroadcasterSocketId,
                streamTitle: currentGeneralStreamTitle,
                streamSubtitle: currentGeneralStreamSubtitle,
                isLoggedInOnly: currentGeneralStreamIsLoggedInOnly,
              });
            }
          } else {
            // No hay broadcaster → avisar viewer
            if (socket.connected) socket.emit('general-broadcaster-disconnected');
          }
        } catch (error) {
          console.error(
            `Socket.IO: Error en 'register-general-viewer' para ${socket.id}:`,
            error
          );
        }
      });

      // 8) El broadcaster (admin) se registra para iniciar un broadcast
      socket.on(
        'register-general-broadcaster',
        async (data?: {
          streamTitle?: string;
          streamSubtitle?: string;
          isLoggedInOnly?: boolean;
        }) => {
          try {
            console.log(
              `Socket.IO: Admin ${socket.id} intenta registrarse como general broadcaster con data:`,
              data
            );
            const settings = await getCachedSiteSettings();
            if (!settings) {
              if (socket.connected)
                socket.emit('general-stream-error', {
                  message: 'Server error: Site settings not available.',
                });
              return;
            }
            // Si el admin está en llamada privada, no permitir
            if (
              (adminForPrivateCall &&
                adminForPrivateCall.socketId === socket.id &&
                userInPrivateCall) ||
              (adminForPrivateCall && adminForPrivateCall.socketId !== socket.id)
            ) {
              if (socket.connected)
                socket.emit('general-stream-error', {
                  message: 'Cannot start general stream due to private call session.',
                });
              return;
            }
            // Si ya hay otro broadcaster distinto, no permitir
            if (
              generalBroadcasterSocketId &&
              generalBroadcasterSocketId !== socket.id
            ) {
              if (socket.connected)
                socket.emit('general-stream-error', {
                  message: 'Another broadcaster is already active.',
                });
              return;
            }

            // Guardar el estado del broadcast
            generalBroadcasterSocketId = socket.id;
            generalBroadcasterAppUserId = socket.data.appUserId || null;
            currentGeneralStreamTitle =
              data?.streamTitle || settings.liveStreamDefaultTitle || 'Live Stream';
            currentGeneralStreamSubtitle = data?.streamSubtitle || '';
            currentGeneralStreamIsLoggedInOnly =
              data?.isLoggedInOnly ??
              (settings.liveStreamForLoggedInUsersOnly || false);
            socket.data.isGeneralBroadcaster = true;

            console.log(
              `Socket.IO: Admin ${socket.id} se registró como general broadcaster. Title: ${currentGeneralStreamTitle}, Subtitle: ${currentGeneralStreamSubtitle}, LoggedInOnly: ${currentGeneralStreamIsLoggedInOnly}`
            );

            // Notificar a todos (viejos y nuevos) que el broadcaster está listo
            io.emit('general-broadcaster-ready', {
              broadcasterId: generalBroadcasterSocketId,
              streamTitle: currentGeneralStreamTitle,
              streamSubtitle: currentGeneralStreamSubtitle,
              isLoggedInOnly: currentGeneralStreamIsLoggedInOnly,
            });
          } catch (error) {
            console.error(
              `Socket.IO: Error en 'register-general-broadcaster' para ${socket.id}:`,
              error
            );
            if (socket.connected)
              socket.emit('general-stream-error', {
                message: 'Server error while registering broadcaster.',
              });
          }
        }
      );

      // 9) El broadcaster envía un offer SDP a un viewer específico
      socket.on(
        'general-stream-offer-to-viewer',
        async ({
          viewerId,
          offer,
        }: {
          viewerId: string;
          offer: RTCSessionDescriptionInit;
        }) => {
          try {
            console.log(
              `Socket.IO: Broadcaster ${socket.id} enviando offer a viewer ${viewerId}`
            );
            const viewerSocket = generalStreamViewers.get(viewerId);
            if (
              viewerSocket &&
              viewerSocket.connected &&
              (!currentGeneralStreamIsLoggedInOnly || !!viewerSocket.data.appUserId)
            ) {
              viewerSocket.emit('offer-from-general-broadcaster', {
                broadcasterId: socket.id,
                offer,
              });
            } else {
              console.log(
                `Socket.IO: Viewer ${viewerId} no es elegible o está desconectado para offer.`
              );
              generalStreamViewers.delete(viewerId);
            }
          } catch (error) {
            console.error(
              `Socket.IO: Error en 'general-stream-offer-to-viewer' para ${socket.id}:`,
              error
            );
          }
        }
      );

      // 10) El viewer responde con su SDP answer al broadcaster
      socket.on(
        'general-stream-answer-to-broadcaster',
        ({
          broadcasterId,
          answer,
        }: {
          broadcasterId: string;
          answer: RTCSessionDescriptionInit;
        }) => {
          try {
            console.log(
              `Socket.IO: Viewer ${socket.id} enviando answer a broadcaster ${broadcasterId}`
            );
            const broadcasterSocket = io.sockets.sockets.get(broadcasterId);
            if (broadcasterSocket && broadcasterSocket.connected) {
              broadcasterSocket.emit('answer-from-general-viewer', {
                viewerId: socket.id,
                answer,
              });
            }
          } catch (error) {
            console.error(
              `Socket.IO: Error en 'general-stream-answer-to-broadcaster' para ${socket.id}:`,
              error
            );
          }
        }
      );

      // 11) El broadcaster envía ICE candidate al viewer
      socket.on(
        'general-stream-candidate-to-viewer',
        ({
          viewerId,
          candidate,
        }: {
          viewerId: string;
          candidate: RTCIceCandidateInit;
        }) => {
          try {
            console.log(
              `Socket.IO: Broadcaster ${socket.id} enviando ICE candidate a viewer ${viewerId}`
            );
            const viewerSocket = generalStreamViewers.get(viewerId);
            if (viewerSocket && viewerSocket.connected) {
              viewerSocket.emit('candidate-from-general-broadcaster', {
                broadcasterId: socket.id,
                candidate,
              });
            } else {
              generalStreamViewers.delete(viewerId);
            }
          } catch (error) {
            console.error(
              `Socket.IO: Error en 'general-stream-candidate-to-viewer' para ${socket.id}:`,
              error
            );
          }
        }
      );

      // 12) El viewer envía ICE candidate al broadcaster
      socket.on(
        'general-stream-candidate-to-broadcaster',
        ({
          broadcasterId,
          candidate,
        }: {
          broadcasterId: string;
          candidate: RTCIceCandidateInit;
        }) => {
          try {
            console.log(
              `Socket.IO: Viewer ${socket.id} enviando ICE candidate a broadcaster ${broadcasterId}`
            );
            const broadcasterSocket = io.sockets.sockets.get(broadcasterId);
            if (broadcasterSocket && broadcasterSocket.connected) {
              broadcasterSocket.emit('candidate-from-general-viewer', {
                viewerId: socket.id,
                candidate,
              });
            }
          } catch (error) {
            console.error(
              `Socket.IO: Error en 'general-stream-candidate-to-broadcaster' para ${socket.id}:`,
              error
            );
          }
        }
      );

      // 13) El administrador detiene manualmente el stream
      socket.on('stop-general-stream', () => {
        try {
          if (socket.id === generalBroadcasterSocketId) {
            console.log(
              `Socket.IO: Admin ${socket.id} detuvo el general stream manualmente.`
            );
            generalBroadcasterSocketId = null;
            generalBroadcasterAppUserId = null;
            currentGeneralStreamTitle = null;
            currentGeneralStreamSubtitle = null;
            currentGeneralStreamIsLoggedInOnly = false;
            generalStreamViewers.clear();
            io.emit('general-broadcaster-disconnected');
          }
        } catch (error) {
          console.error(
            `Socket.IO: Error en 'stop-general-stream' para ${socket.id}:`,
            error
          );
        }
      });

      // 14) Forzar a todos los viewers a reconectarse (por ejemplo, admin cambió título o reinició ICE)
      socket.on(
        'force-viewers-reconnect',
        ({
          streamTitle,
          streamSubtitle,
          isLoggedInOnly,
        }: {
          streamTitle: string;
          streamSubtitle: string;
          isLoggedInOnly: boolean;
        }) => {
          try {
            console.log(
              `Socket.IO: Broadcasting 'force-viewers-reconnect' con nuevos datos del stream.`
            );
            // Limpiar todos los viewers actuales para forzar re-registro
            generalStreamViewers.clear();

            // actualizar estado en servidor
            currentGeneralStreamTitle = streamTitle;
            currentGeneralStreamSubtitle = streamSubtitle;
            currentGeneralStreamIsLoggedInOnly = isLoggedInOnly;

            // notificar a todos
            socket.broadcast.emit('force-viewers-reconnect', {
              broadcasterId: generalBroadcasterSocketId,
              streamTitle,
              streamSubtitle,
              isLoggedInOnly,
            });
          } catch (error) {
            console.error(
              `Socket.IO: Error en 'force-viewers-reconnect' para ${socket.id}:`,
              error
            );
          }
        }
      );

      // 15) Cliente se desconecta
      socket.on('disconnect', async (reason) => {
        try {
          console.log(
            `Socket.IO: Cliente desconectado → SocketID: ${socket.id}, AppUserID: ${
              socket.data.appUserId || 'Anonymous'
            }, Reason: ${reason}`
          );

          // Si el socket era viewer, removerlo del Map y notificar al broadcaster
          if (generalStreamViewers.has(socket.id)) {
            generalStreamViewers.delete(socket.id);
            if (generalBroadcasterSocketId) {
              const broadcasterSocket = io.sockets.sockets.get(
                generalBroadcasterSocketId
              );
              if (broadcasterSocket && broadcasterSocket.connected) {
                broadcasterSocket.emit('viewer-disconnected', {
                  viewerId: socket.id,
                });
              }
            }
          }

          // Si el socket era el broadcaster, terminar el stream por completo
          if (socket.id === generalBroadcasterSocketId) {
            console.log(
              `Socket.IO: Broadcaster general ${socket.id} desconectado. Terminando stream.`
            );
            generalBroadcasterSocketId = null;
            generalBroadcasterAppUserId = null;
            currentGeneralStreamTitle = null;
            currentGeneralStreamSubtitle = null;
            currentGeneralStreamIsLoggedInOnly = false;
            generalStreamViewers.clear();
            io.emit('general-broadcaster-disconnected');
          }

          // Manejo de desconexión en llamadas privadas
          if (
            adminForPrivateCall &&
            socket.id === adminForPrivateCall.socketId
          ) {
            console.log(
              `Socket.IO: Admin ${socket.id} de llamada privada desconectado.`
            );
            if (userInPrivateCall) {
              const userSocketInstance = io.sockets.sockets.get(
                userInPrivateCall.socketId
              );
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
          } else if (
            userInPrivateCall &&
            socket.id === userInPrivateCall.socketId
          ) {
            console.log(
              `Socket.IO: Usuario ${socket.id} en llamada privada desconectado.`
            );
            if (adminForPrivateCall) {
              const adminSocketInstance = io.sockets.sockets.get(
                adminForPrivateCall.socketId
              );
              if (adminSocketInstance && adminSocketInstance.connected) {
                adminSocketInstance.emit('private-call-user-disconnected', {
                  userSocketId: socket.id,
                  userAppUserId: socket.data.appUserId,
                });
              }
            }
            userInPrivateCall = null;
            adminForPrivateCall = null;
          }

          // Si este socket era usuario autorizado y estaba en private call
          const refreshedSettings = await getCachedSiteSettings();
          if (
            socket.data.appUserId &&
            refreshedSettings?.liveStreamAuthorizedUserId ===
              socket.data.appUserId
          ) {
            const adminSocketInstance = adminForPrivateCall
              ? io.sockets.sockets.get(adminForPrivateCall.socketId)
              : Array.from(io.sockets.sockets.values()).find(
                  (s) =>
                    s.data.appUserId ===
                    process.env.ADMIN_APP_USER_ID_PLACEHOLDER
                ); // Fallback
            if (adminSocketInstance && adminSocketInstance.connected) {
              adminSocketInstance.emit('authorized-user-status', {
                userId: socket.data.appUserId,
                isConnected: false,
                userSocketId: socket.id,
              });
            }
          }
        } catch (error) {
          console.error(
            `Socket.IO: Error en 'disconnect' handler para ${socket.id}:`,
            error
          );
        }
      });

      // ----------- LÓGICA DE LLAMADAS PRIVADAS -----------

      socket.on(
        'admin-initiate-private-call-request',
        async ({ targetUserAppId }: { targetUserAppId: string }) => {
          try {
            console.log(
              `Socket.IO: Admin ${socket.id} (AppUser: ${socket.data.appUserId}) iniciando llamada privada a ${targetUserAppId}`
            );
            const currentSettingsForCall = await getCachedSiteSettings();
            if (!socket.data.appUserId || !currentSettingsForCall) {
              if (socket.connected)
                socket.emit('private-call-error', {
                  message: 'Server/user data not ready.',
                });
              return;
            }
            if (generalBroadcasterSocketId === socket.id) {
              if (socket.connected)
                socket.emit('private-call-error', {
                  message: 'Stop general stream first.',
                });
              return;
            }
            if (
              adminForPrivateCall &&
              adminForPrivateCall.socketId !== socket.id
            ) {
              if (socket.connected)
                socket.emit('private-call-error', {
                  message: 'Another admin is in a call or waiting.',
                });
              return;
            }
            if (userInPrivateCall) {
              if (socket.connected)
                socket.emit('private-call-error', {
                  message: `User ${userInPrivateCall.appUserId} is already in a call.`,
                });
              return;
            }

            adminForPrivateCall = {
              socketId: socket.id,
              appUserId: socket.data.appUserId!,
            };
            const targetUserSocket = Array.from(
              io.sockets.sockets.values()
            ).find((s) => s.data.appUserId === targetUserAppId);

            if (targetUserSocket && targetUserSocket.connected) {
              console.log(
                `Socket.IO: Target user ${targetUserAppId} conectado (socket ${targetUserSocket.id}). Emitting invite.`
              );
              targetUserSocket.emit('private-call-invite-from-admin', {
                adminSocketId: socket.id,
                adminAppUserId: adminForPrivateCall.appUserId,
              });
              if (socket.connected)
                socket.emit('private-call-invite-sent-to-user', {
                  userSocketId: targetUserSocket.id,
                  userAppUserId: targetUserAppId,
                });
            } else {
              console.log(
                `Socket.IO: Target user ${targetUserAppId} no conectado. Agregando a pending calls.`
              );
              pendingPrivateCalls.set(targetUserAppId, {
                adminSocketId: socket.id,
                adminAppUserId: adminForPrivateCall.appUserId,
              });
              if (socket.connected)
                socket.emit('private-call-user-not-connected', {
                  targetUserAppId,
                });
            }
          } catch (error) {
            console.error(
              `Socket.IO: Error en 'admin-initiate-private-call-request' para ${socket.id}:`,
              error
            );
          }
        }
      );

      socket.on(
        'user-accepts-private-call',
        ({ adminSocketId }: { adminSocketId: string }) => {
          try {
            console.log(
              `Socket.IO: User ${socket.id} (AppUser: ${socket.data.appUserId}) acepta llamada privada de admin ${adminSocketId}`
            );
            if (
              !adminForPrivateCall ||
              adminSocketId !== adminForPrivateCall.socketId ||
              !socket.data.appUserId
            ) {
              if (socket.connected)
                socket.emit('private-call-error', {
                  message: 'Admin not ready or invalid request.',
                });
              return;
            }
            if (
              userInPrivateCall &&
              userInPrivateCall.socketId !== socket.id
            ) {
              if (socket.connected)
                socket.emit('private-call-error', {
                  message: 'Admin in call with another user.',
                });
              return;
            }
            userInPrivateCall = {
              socketId: socket.id,
              appUserId: socket.data.appUserId,
            };
            const adminSock = io.sockets.sockets.get(adminSocketId);
            if (adminSock && adminSock.connected) {
              adminSock.emit('private-call-user-ready-for-offer', {
                userSocketId: socket.id,
                userAppUserId: socket.data.appUserId,
              });
            } else {
              userInPrivateCall = null;
              adminForPrivateCall = null;
              if (socket.connected)
                socket.emit('private-call-error', { message: 'Admin disconnected.' });
            }
          } catch (error) {
            console.error(
              `Socket.IO: Error en 'user-accepts-private-call' para ${socket.id}:`,
              error
            );
          }
        }
      );

      socket.on(
        'private-sdp-offer',
        ({
          targetSocketId,
          offer,
        }: {
          targetSocketId: string;
          offer: RTCSessionDescriptionInit;
        }) => {
          try {
            const targetSocketInstance = io.sockets.sockets.get(targetSocketId);
            if (targetSocketInstance && targetSocketInstance.connected) {
              targetSocketInstance.emit('private-sdp-offer-received', {
                senderSocketId: socket.id,
                offer,
              });
            }
          } catch (error) {
            console.error(
              `Socket.IO: Error en 'private-sdp-offer' para ${socket.id}:`,
              error
            );
          }
        }
      );

      socket.on(
        'private-sdp-answer',
        ({
          targetSocketId,
          answer,
        }: {
          targetSocketId: string;
          answer: RTCSessionDescriptionInit;
        }) => {
          try {
            const targetSocketInstance = io.sockets.sockets.get(targetSocketId);
            if (targetSocketInstance && targetSocketInstance.connected) {
              targetSocketInstance.emit('private-sdp-answer-received', {
                senderSocketId: socket.id,
                answer,
              });
            }
          } catch (error) {
            console.error(
              `Socket.IO: Error en 'private-sdp-answer' para ${socket.id}:`,
              error
            );
          }
        }
      );

      socket.on(
        'private-ice-candidate',
        ({
          targetSocketId,
          candidate,
        }: {
          targetSocketId: string;
          candidate: RTCIceCandidateInit;
        }) => {
          try {
            const targetSocketInstance = io.sockets.sockets.get(targetSocketId);
            if (targetSocketInstance && targetSocketInstance.connected) {
              targetSocketInstance.emit('private-ice-candidate-received', {
                senderSocketId: socket.id,
                candidate,
              });
            }
          } catch (error) {
            console.error(
              `Socket.IO: Error en 'private-ice-candidate' para ${socket.id}:`,
              error
            );
          }
        }
      );

      socket.on(
        'admin-end-private-call',
        ({ userSocketId }: { userSocketId?: string }) => {
          try {
            if (
              adminForPrivateCall &&
              socket.id === adminForPrivateCall.socketId
            ) {
              console.log(`Socket.IO: Admin ${socket.id} finalizando private call.`);
              const targetUserSocketId = userInPrivateCall
                ? userInPrivateCall.socketId
                : userSocketId;
              if (targetUserSocketId) {
                const userSocketInstance = io.sockets.sockets.get(
                  targetUserSocketId
                );
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
            }
          } catch (error) {
            console.error(
              `Socket.IO: Error en 'admin-end-private-call' para ${socket.id}:`,
              error
            );
          }
        }
      );

      socket.on(
        'admin-end-private-call-for-user-app-id',
        ({ targetUserAppId }: { targetUserAppId: string }) => {
          try {
            if (
              adminForPrivateCall &&
              socket.id === adminForPrivateCall.socketId
            ) {
              console.log(
                `Socket.IO: Admin ${socket.id} ending private call for user app ID ${targetUserAppId}.`
              );
              const targetUserSocket = Array.from(
                io.sockets.sockets.values()
              ).find((s) => s.data.appUserId === targetUserAppId);
              if (targetUserSocket && targetUserSocket.connected) {
                targetUserSocket.emit('private-call-terminated-by-admin');
              }
              adminForPrivateCall = null;
              userInPrivateCall = null;
              pendingPrivateCalls.delete(targetUserAppId);
            }
          } catch (error) {
            console.error(
              `Socket.IO: Error en 'admin-end-private-call-for-user-app-id' para ${socket.id}:`,
              error
            );
          }
        }
      );

      socket.on(
        'user-end-private-call',
        ({ adminSocketId }: { adminSocketId?: string }) => {
          try {
            if (
              userInPrivateCall &&
              socket.id === userInPrivateCall.socketId
            ) {
              console.log(`Socket.IO: User ${socket.id} terminó private call.`);
              const targetAdminSocketId = adminForPrivateCall
                ? adminForPrivateCall.socketId
                : adminSocketId;
              if (targetAdminSocketId) {
                const adminSocketInstance = io.sockets.sockets.get(
                  targetAdminSocketId
                );
                if (adminSocketInstance && adminSocketInstance.connected) {
                  adminSocketInstance.emit('private-call-user-disconnected', {
                    userSocketId: socket.id,
                    userAppUserId: socket.data.appUserId,
                  });
                }
              }
              userInPrivateCall = null;
              adminForPrivateCall = null;
            }
          } catch (error) {
            console.error(
              `Socket.IO: Error en 'user-end-private-call' para ${socket.id}:`,
              error
            );
          }
        }
      );
      // ----------- FIN LÓGICA DE LLAMADAS PRIVADAS -----------

    });

    res.socket.server.io = io;
    console.log('Socket.IO: IOServer instance attached to server.');
  } else {
    console.log('Socket.IO: IOServer instance already running.');
  }

  console.log('Socket.IO: SocketHandler API route finalizó respuesta');
  res.end();
}
