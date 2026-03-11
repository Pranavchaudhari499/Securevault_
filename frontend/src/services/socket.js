import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';
let socket = null;

export const connectSocket = (userId, role) => {
  if (socket) socket.disconnect();
  socket = io(SOCKET_URL, { transports: ['websocket'], reconnection: true, reconnectionAttempts: 5 });
  socket.on('connect', () => {
    if (role === 'gateway_admin') socket.emit('join-room', 'gateway-room');
    else if (role === 'bank_officer') socket.emit('join-room', 'bank-room');
    else if (userId) socket.emit('join-room', `user-${userId}`);
  });
  return socket;
};

export const getSocket = () => socket;
export const disconnectSocket = () => { if (socket) { socket.disconnect(); socket = null; } };