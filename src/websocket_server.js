import http from "http";
import crypto from "crypto";

// opcodes for websockets
const OP_CODES = {
  CONT: 0x0,
  TEXT: 0x1,
  BIN: 0x2,
  CLOSE: 0x8,
  PING: 0x9,
  PONG: 0xa,
};

// constant GUID defined in the websocket rfc
const WEBSOCKET_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

/* when client tries to connect with the server, send a response header to upgrade the protocol to websocket */
const server = http.createServer((req, res) => {
  res.writeHead(404);
  res.end("Please upgrade the websocket!");
});