
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

const pendingPrivateCalls = new Map<
  string,
  { adminSocketId: string; adminAppUserId: string }
>();

let siteSettingsCache: SiteSettings | null = null;
let siteSettingsCacheTime: number = 0;
const SITE_SETTINGS_CACHE_DURATION = 3 * 1000; // 3 seconds

async function getRefreshedSiteSettings(): Promise<SiteSettings | null> {
  try {
    siteSettingsCache = await getSiteSettingsLogic();
    siteSettingsCacheTime = Date.now();
    console.log('Socket.IO: Site settings cache refreshed.');
  } catch (error) {
    console.error('Socket.IO: Error refreshing site settings:', error);
    // In case of error, invalidate cache so next attempt tries to refresh
    siteSettingsCache = null;
    siteSettingsCacheTime = 0;
  }
  return siteSettingsCache;
}

async function getCachedSiteSettings(): Promise<SiteSettings | null> {
  const now = Date.now();
  if (!siteSettingsCache || now - siteSettingsCacheTime > SITE_SETTINGS_CACHE_DURATION) {
    console.log('Socket.IO: Cache miss or expired, attempting to refresh site settings.');
    return await getRefreshedSiteSettings();
  }
  console.log('Socket.IO: Using cached site settings.');
  return siteSettingsCache;
}

// Initialize cache immediately at server startup
getRefreshedSiteSettings().catch(err => console.error("Socket.IO: Initial site settings fetch failed on startup:", err));


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
      // Top-level try-catch for the entire connection handler
      try {
        const appUserId = socket.handshake.query.appUserId as string | undefined;
        socket.data.appUserId = appUserId;
        console.log(
          `Socket.IO: Client connected → SocketID: ${socket.id}, AppUserID: ${
            appUserId || 'Anonymous'
          }`
        );

        let currentSettings = await getCachedSiteSettings();
        if (!currentSettings) {
           console.warn('Socket.IO: Site settings not available on new connection for socket:', socket.id);
           // Optionally, you could emit an error to the client or disconnect them
           // For now, proceeding but some features might not work as expected
        }


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

        if (generalBroadcasterSocketId) {
          if (socket.connected) socket.emit('general-broadcaster-ready', {
            broadcasterId: generalBroadcasterSocketId,
            streamTitle: currentGeneralStreamTitle,
            streamSubtitle: currentGeneralStreamSubtitle,
            isLoggedInOnly: currentGeneralStreamIsLoggedInOnly,
          });
        } else {
          if (socket.connected) socket.emit('general-broadcaster-disconnected');
        }
      } catch (connectionError) {
        console.error(
          `Socket.IO: Error during the initial connection setup for socket ${socket.id}:`,
          connectionError
        );
        if (socket.connected) socket.emit('server_error', { message: 'Error during connection setup.' });
      }


      socket.on('check-active-broadcast', async () => {
        try {
            if (generalBroadcasterSocketId) {
              if (socket.connected) socket.emit('active-broadcast-info', {
                broadcasterId: generalBroadcasterSocketId,
                streamTitle: currentGeneralStreamTitle,
                streamSubtitle: currentGeneralStreamSubtitle,
                isLoggedInOnly: currentGeneralStreamIsLoggedInOnly,
              });
            } else {
              if (socket.connected) socket.emit('no-active-broadcast');
            }
        } catch (error) {
            console.error(`Socket.IO: Error in 'check-active-broadcast' for socket ${socket.id}:`, error);
            if (socket.connected) socket.emit('server_error', { message: 'Error processing check-active-broadcast.' });
        }
      });

      socket.on(
        'request-authorized-user-status',
        async ({ targetUserAppId }: { targetUserAppId: string }) => {
          try {
            console.log(
              `Socket.IO: Admin ${socket.id} requesting status for targetUserAppId ${targetUserAppId}`
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
              `Socket.IO: Error in 'request-authorized-user-status' for socket ${socket.id}:`,
              error
            );
            if (socket.connected) socket.emit('server_error', { message: 'Error processing request-authorized-user-status.' });
          }
        }
      );

      socket.on('register-general-viewer', async () => {
        try {
          console.log(
            `Socket.IO: Client ${socket.id} (AppUser: ${socket.data.appUserId ||
              'Anon'}) wants to register as viewer.`
          );
          const settings = await getCachedSiteSettings();
          if (!settings) {
            console.warn('Socket.IO: Site settings not available for register-general-viewer, socket:', socket.id);
            if (socket.connected) socket.emit('general-broadcaster-disconnected'); // Indicate no stream
            return;
          }

          if (generalBroadcasterSocketId) {
            if (currentGeneralStreamIsLoggedInOnly && !socket.data.appUserId) {
              if (socket.connected)
                socket.emit('general-stream-access-denied', {
                  message: 'This live stream is for registered users only.',
                });
              return;
            }
            if (!generalStreamViewers.has(socket.id)) {
              generalStreamViewers.set(socket.id, socket);
              const broadcasterSocket = io.sockets.sockets.get(
                generalBroadcasterSocketId
              );
              if (broadcasterSocket && broadcasterSocket.connected) {
                broadcasterSocket.emit('new-general-viewer', {
                  viewerId: socket.id,
                });
              }
            }
            if (socket.connected) {
              socket.emit('general-broadcaster-ready', {
                broadcasterId: generalBroadcasterSocketId,
                streamTitle: currentGeneralStreamTitle,
                streamSubtitle: currentGeneralStreamSubtitle,
                isLoggedInOnly: currentGeneralStreamIsLoggedInOnly,
              });
            }
          } else {
            if (socket.connected) socket.emit('general-broadcaster-disconnected');
          }
        } catch (error) {
          console.error(
            `Socket.IO: Error in 'register-general-viewer' for ${socket.id}:`,
            error
          );
          if (socket.connected) socket.emit('server_error', { message: 'Error processing register-general-viewer.' });
        }
      });

      socket.on(
        'register-general-broadcaster',
        async (data?: {
          streamTitle?: string;
          streamSubtitle?: string;
          isLoggedInOnly?: boolean;
        }) => {
          try {
            console.log(
              `Socket.IO: Admin ${socket.id} attempts to register as general broadcaster with data:`,
              data
            );
            let settings = await getCachedSiteSettings();
            if (!settings) {
              console.warn('Socket.IO: Site settings not available for register-general-broadcaster, admin socket:', socket.id);
              if (socket.connected)
                socket.emit('general-stream-error', {
                  message: 'Server error: Site settings could not be loaded.',
                });
              return;
            }
            if (
              (adminForPrivateCall &&
                adminForPrivateCall.socketId === socket.id &&
                userInPrivateCall) ||
              (adminForPrivateCall && adminForPrivateCall.socketId !== socket.id)
            ) {
              if (socket.connected)
                socket.emit('general-stream-error', {
                  message: 'Cannot start general stream due to an active or pending private call session.',
                });
              return;
            }
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

            generalBroadcasterSocketId = socket.id;
            currentGeneralStreamTitle =
              data?.streamTitle || settings.liveStreamDefaultTitle || 'Live Stream';
            currentGeneralStreamSubtitle = data?.streamSubtitle || '';
            currentGeneralStreamIsLoggedInOnly =
              data?.isLoggedInOnly ??
              (settings.liveStreamForLoggedInUsersOnly || false);
            socket.data.isGeneralBroadcaster = true;

            console.log(
              `Socket.IO: Admin ${socket.id} registered as general broadcaster. Title: ${currentGeneralStreamTitle}, Subtitle: ${currentGeneralStreamSubtitle}, LoggedInOnly: ${currentGeneralStreamIsLoggedInOnly}`
            );

            io.emit('general-broadcaster-ready', {
              broadcasterId: generalBroadcasterSocketId,
              streamTitle: currentGeneralStreamTitle,
              streamSubtitle: currentGeneralStreamSubtitle,
              isLoggedInOnly: currentGeneralStreamIsLoggedInOnly,
            });
          } catch (error) {
            console.error(
              `Socket.IO: Error in 'register-general-broadcaster' for ${socket.id}:`,
              error
            );
            if (socket.connected)
              socket.emit('general-stream-error', {
                message: 'Server error occurred while registering as broadcaster.',
              });
          }
        }
      );

      socket.on('admin-signals-new-general-stream', async (data: { streamTitle: string, streamSubtitle: string, isLoggedInOnly: boolean }) => {
        try {
            if (socket.id === generalBroadcasterSocketId) { // Ensure only the current broadcaster can do this
                console.log(`Socket.IO: Admin ${socket.id} signals new general stream. Broadcasting 'force-viewers-reconnect'. Data:`, data);
                currentGeneralStreamTitle = data.streamTitle;
                currentGeneralStreamSubtitle = data.streamSubtitle;
                currentGeneralStreamIsLoggedInOnly = data.isLoggedInOnly;

                // Notify all OTHER clients to reconnect/refresh for the new stream details
                socket.broadcast.emit('force-viewers-reconnect', {
                    broadcasterId: generalBroadcasterSocketId,
                    streamTitle: currentGeneralStreamTitle,
                    streamSubtitle: currentGeneralStreamSubtitle,
                    isLoggedInOnly: currentGeneralStreamIsLoggedInOnly,
                });
            } else {
                console.warn(`Socket.IO: Unauthorized attempt to signal new general stream by ${socket.id}`);
            }
        } catch (error) {
            console.error(`Socket.IO: Error in 'admin-signals-new-general-stream' for ${socket.id}:`, error);
        }
      });

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
              `Socket.IO: Broadcaster ${socket.id} sending offer to viewer ${viewerId}`
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
                `Socket.IO: Viewer ${viewerId} not eligible or disconnected for offer. Removing from viewers map.`
              );
              generalStreamViewers.delete(viewerId);
            }
          } catch (error) {
            console.error(
              `Socket.IO: Error in 'general-stream-offer-to-viewer' for ${socket.id}:`,
              error
            );
          }
        }
      );

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
              `Socket.IO: Viewer ${socket.id} sending answer to broadcaster ${broadcasterId}`
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
              `Socket.IO: Error in 'general-stream-answer-to-broadcaster' for ${socket.id}:`,
              error
            );
          }
        }
      );

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
              `Socket.IO: Broadcaster ${socket.id} sending ICE candidate to viewer ${viewerId}`
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
              `Socket.IO: Error in 'general-stream-candidate-to-viewer' for ${socket.id}:`,
              error
            );
          }
        }
      );

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
              `Socket.IO: Viewer ${socket.id} sending ICE candidate to broadcaster ${broadcasterId}`
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
              `Socket.IO: Error in 'general-stream-candidate-to-broadcaster' for ${socket.id}:`,
              error
            );
          }
        }
      );

      socket.on('stop-general-stream', () => {
        try {
          if (socket.id === generalBroadcasterSocketId) {
            console.log(
              `Socket.IO: Admin ${socket.id} stopped the general stream manually.`
            );
            generalBroadcasterSocketId = null;
            currentGeneralStreamTitle = null;
            currentGeneralStreamSubtitle = null;
            currentGeneralStreamIsLoggedInOnly = false;
            generalStreamViewers.forEach(viewerSocket => {
                if (viewerSocket && viewerSocket.connected) {
                    viewerSocket.emit('general-broadcaster-disconnected');
                }
            });
            generalStreamViewers.clear();
            io.emit('general-broadcaster-disconnected'); // Ensure all clients know
          }
        } catch (error) {
          console.error(
            `Socket.IO: Error in 'stop-general-stream' for ${socket.id}:`,
            error
          );
        }
      });

      socket.on('disconnect', async (reason) => {
        try {
          console.log(
            `Socket.IO: Client disconnected → SocketID: ${socket.id}, AppUserID: ${
              socket.data.appUserId || 'Anonymous'
            }, Reason: ${reason}`
          );

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

          if (socket.id === generalBroadcasterSocketId) {
            console.log(
              `Socket.IO: General broadcaster ${socket.id} disconnected. Ending stream.`
            );
            generalBroadcasterSocketId = null;
            currentGeneralStreamTitle = null;
            currentGeneralStreamSubtitle = null;
            currentGeneralStreamIsLoggedInOnly = false;
            generalStreamViewers.forEach(viewerSocket => {
                if (viewerSocket && viewerSocket.connected) {
                    viewerSocket.emit('general-broadcaster-disconnected');
                }
            });
            generalStreamViewers.clear();
            io.emit('general-broadcaster-disconnected');
          }

          if (
            adminForPrivateCall &&
            socket.id === adminForPrivateCall.socketId
          ) {
            console.log(
              `Socket.IO: Admin ${socket.id} for private call disconnected.`
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
              `Socket.IO: User ${socket.id} in private call disconnected.`
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

          const refreshedSettings = await getCachedSiteSettings(); // Use await here
          if (
            socket.data.appUserId &&
            refreshedSettings?.liveStreamAuthorizedUserId ===
              socket.data.appUserId
          ) {
             let adminSocketToNotifyId: string | null = null;
             if (adminForPrivateCall && adminForPrivateCall.appUserId === refreshedSettings.adminAppUserId) { // Assuming adminAppUserId is stored in settings or a known constant
                adminSocketToNotifyId = adminForPrivateCall.socketId;
             } else {
                // Fallback: find an admin socket if adminForPrivateCall is not set or not the one we expect
                const adminSocketFound = Array.from(io.sockets.sockets.values()).find(s => s.data.appUserId === refreshedSettings.adminAppUserId); // Replace with actual admin user ID logic
                if (adminSocketFound) adminSocketToNotifyId = adminSocketFound.id;
             }

             if (adminSocketToNotifyId) {
                const adminSocketInstance = io.sockets.sockets.get(adminSocketToNotifyId);
                if (adminSocketInstance && adminSocketInstance.connected) {
                    adminSocketInstance.emit('authorized-user-status', {
                        userId: socket.data.appUserId,
                        isConnected: false,
                        userSocketId: socket.id,
                    });
                }
             }
          }
        } catch (error) {
          console.error(
            `Socket.IO: Error in 'disconnect' handler for ${socket.id}:`,
            error
          );
        }
      });

      // Private Call Handlers
      socket.on(
        'admin-initiate-private-call-request',
        async ({ targetUserAppId }: { targetUserAppId: string }) => {
          try {
            console.log(
              `Socket.IO: Admin ${socket.id} (AppUser: ${socket.data.appUserId}) initiating private call to ${targetUserAppId}`
            );
            const currentSettingsForCall = await getCachedSiteSettings(); // Use await
            if (!socket.data.appUserId || !currentSettingsForCall) {
              if (socket.connected)
                socket.emit('private-call-error', {
                  message: 'Server/user data not ready for private call.',
                });
              return;
            }
            if (generalBroadcasterSocketId === socket.id) {
              if (socket.connected)
                socket.emit('private-call-error', {
                  message: 'Please stop the general stream before starting a private call.',
                });
              return;
            }
            if (
              adminForPrivateCall &&
              adminForPrivateCall.socketId !== socket.id
            ) {
              if (socket.connected)
                socket.emit('private-call-error', {
                  message: 'Another admin is already in a private call or waiting for one.',
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
                `Socket.IO: Target user ${targetUserAppId} is connected (socket ${targetUserSocket.id}). Emitting private call invite.`
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
                `Socket.IO: Target user ${targetUserAppId} is not connected. Adding to pending private calls.`
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
              `Socket.IO: Error in 'admin-initiate-private-call-request' for ${socket.id}:`,
              error
            );
             if (socket.connected) socket.emit('private-call-error', { message: 'Server error initiating private call.' });
          }
        }
      );

      socket.on(
        'user-accepts-private-call',
        ({ adminSocketId }: { adminSocketId: string }) => {
          try {
            console.log(
              `Socket.IO: User ${socket.id} (AppUser: ${socket.data.appUserId}) accepts private call from admin ${adminSocketId}`
            );
            if (
              !adminForPrivateCall ||
              adminSocketId !== adminForPrivateCall.socketId ||
              !socket.data.appUserId
            ) {
              if (socket.connected)
                socket.emit('private-call-error', {
                  message: 'Admin is not ready or this is an invalid request.',
                });
              return;
            }
            if (
              userInPrivateCall &&
              userInPrivateCall.socketId !== socket.id
            ) {
              if (socket.connected)
                socket.emit('private-call-error', {
                  message: 'Admin is already in a call with another user.',
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
                socket.emit('private-call-error', { message: 'Admin disconnected before call setup.' });
            }
          } catch (error) {
            console.error(
              `Socket.IO: Error in 'user-accepts-private-call' for ${socket.id}:`,
              error
            );
            if (socket.connected) socket.emit('private-call-error', { message: 'Server error accepting private call.' });
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
            } else {
                console.warn(`Socket.IO: Target socket ${targetSocketId} for SDP offer not found or disconnected.`);
            }
          } catch (error) {
            console.error(
              `Socket.IO: Error in 'private-sdp-offer' for ${socket.id} to ${targetSocketId}:`,
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
            } else {
                 console.warn(`Socket.IO: Target socket ${targetSocketId} for SDP answer not found or disconnected.`);
            }
          } catch (error) {
            console.error(
              `Socket.IO: Error in 'private-sdp-answer' for ${socket.id} to ${targetSocketId}:`,
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
            } else {
                console.warn(`Socket.IO: Target socket ${targetSocketId} for ICE candidate not found or disconnected.`);
            }
          } catch (error) {
            console.error(
              `Socket.IO: Error in 'private-ice-candidate' for ${socket.id} to ${targetSocketId}:`,
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
              console.log(
                `Socket.IO: Admin ${socket.id} is ending private call.`
              );
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
              // Clear pending calls initiated by this admin
              for (const [userId, info] of pendingPrivateCalls) {
                if (info.adminSocketId === socket.id) {
                  pendingPrivateCalls.delete(userId);
                }
              }
            }
          } catch (error) {
            console.error(
              `Socket.IO: Error in 'admin-end-private-call' for ${socket.id}:`,
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
              if (userInPrivateCall && userInPrivateCall.appUserId === targetUserAppId) {
                userInPrivateCall = null;
              }
              adminForPrivateCall = null; // Admin is no longer in any call
              pendingPrivateCalls.delete(targetUserAppId);
            }
          } catch (error) {
            console.error(
              `Socket.IO: Error in 'admin-end-private-call-for-user-app-id' for ${socket.id}:`,
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
              console.log(
                `Socket.IO: User ${socket.id} ended the private call.`
              );
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
              `Socket.IO: Error in 'user-end-private-call' for ${socket.id}:`,
              error
            );
          }
        }
      );

    });

    res.socket.server.io = io;
    console.log('Socket.IO: IOServer instance attached to server.');
  } else {
    console.log('Socket.IO: IOServer instance already running.');
  }

  res.end();
}