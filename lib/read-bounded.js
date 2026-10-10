'use strict';

async function readBounded(response, maxBytes, message = 'Response too large') {
  if (Number(response.headers.get('content-length')) > maxBytes) throw new Error(message);
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error(message);
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally {
    await reader.cancel();
  }
}

module.exports = { readBounded };
