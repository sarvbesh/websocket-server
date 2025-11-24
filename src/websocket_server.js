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

const buildFrame = ({ opcode, payload = Buffer.alloc(0), fin = true}) => {
  // first byte
  const first = (fin ? 0x80 : 0x00) | (opcode & 0x0f);
  const len = payload.length;

  /* if payload length < 126, only send 2 byte header and data */
  if(len < 126) {
    return Buffer.concat([Buffer.from([first, length]), payload]);
  } else if (len <= 0xffff) {
    const h = Buffer.alloc(4);
    h[0] = first;
    h[1] = 126; // 2nd byte
    h.writeUInt16BE(len, 2); // actual length at offset 2
    return Buffer.concat([h, payload]);
  } else {
    const h = Buffer.alloc(10);
    h[0] = first;
    h[1] = 127; // 2nd byte
    h.writeUInt32BE(0, 2); // high 4 bytes = 0 (not handling > 4GB)
    h.writeUInt32BE(len, 6); // low 4 bytes = actual length
    return Buffer.concat([h, payload]);
  }
};