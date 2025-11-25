import http from "http";
import crypto from "crypto";
import { buffer } from "stream/consumers";

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

const buildFrame = ({ opcode, payload = Buffer.alloc(0), fin = true }) => {
  // first byte
  const first = (fin ? 0x80 : 0x00) | (opcode & 0x0f);
  const len = payload.length;

  /* if payload length < 126, only send 2 byte header and data */
  if (len < 126) {
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

// to send response
const send = (socket, opcode, payload) => {
  console.log("Okay!");
  socket.write(buildFrame({ opcode, payload }));
};

const parseFrames = (buffer, onFrame) => {
  // to iterate through whole buffer byte to byte & capture frames
  let offset = 0;

  // loop through the whole buffer
  while (buffer.length - offset >= 2) {
    // minimum 2 bytes are required to have a frame

    const b0 = buffer[offset]; // retrieve first byte
    const b1 = buffer[offset + 1]; // retrieve second byte

    /*
     * the first byte in 'b0' has 1 bit for fin, 4 bits for opcode and 3 reserved bits
     * the second byte in 'b1' has 1 bit for mask (tells whether data is masked or not) and 7 bits for length of payload data
     */

    const fin = (b0 & 0x80) !== 0; // retrieve first bit and verify if it's the last frame or not
    const opcode = b0 & 0xf; // retrieve opcode
    const masked = (b1 & 0x80) !== 0; // retrieve first bit and verify if the payload is masked or not
    let len = b1 & 0x7f;
    let pos = offset + 2;

    // check length of the payload data
    if (len === 126){
      
      if (buffer.length - pos < 2) break;
      len = buffer.readUInt16BE(pos);
      pos += 2;
    } else if (len === 127) {
      
      if (buffer.length - pos < 8) break;
      const x = buffer.readUInt32BE(pos);
      const y = buffer.readUInt32BE(pos + 4);
      pos += 8;

      if (x!==0) {
        throw new Error("Frame size exceeds 4GB limit!");
      }
      len = x >>> 0;
    }

    let maskKey;
    if (masked) {
      if (buffer.length - pos < 4) break;
      maskKey = buffer.subarray(pos, pos + 4);
      pos += 4;
    }

    if (buffer.length - pos < len) break;

    let payload = buffer.subarray(pos, pos + len); // get payload data
    if (masked) {
      const output = Buffer.allocUnsafe(len);
      for (let i = 0; i < len; i++) {
        output[i] = payload[i] ^ maskKey[i % 4]; // unmask payload data
      }
      payload = output;
    }

    const frame = { fin, opcode, payload } // full frame

    onFrame(frame);
    offset = pos + len;
  }
  return buffer.subarray(offset);
};

/* this function will be executed as soon as upgrade protocol hits the server */
server.on("upgrade", (req, socket, head) => {

  const upgrade = (req.headers.upgrade || "").toLowerCase(); // tells which protocol to upgrade to

  // tells that particular connection is now a request to upgrade it
  const connection = (req.headers.connection || "").toLowerCase(); 

  const key = req.headers["sec-websocket-key"];
  const version = req.headers["sec-websocket-version"];

  // validate if handshake is valid or not
  const ok = upgrade === "websocket" && connection.split(/,\s*/).includes("upgrade") && key && version === "13";

  if(!ok) {
    socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
    socket.destroy();
    return;
  }

  const accept = crypto.createHash("sha1").update(key + WEBSOCKET_GUID).digest("base64"); // complete the upgrade

  const responseHeaders = [ "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${accept}`,
    "\r\n",
  ];

  socket.write(responseHeaders.join("\r\n"));
  socket.setNoDelay(
    true
  ); // bypass the nagle's algorithm

  // <---- upgradation ends here ---->


})