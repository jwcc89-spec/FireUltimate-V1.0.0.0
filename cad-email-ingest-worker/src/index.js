/**
 * CAD Email Ingest Worker
 * - email(): Receives email from Cloudflare Email Routing (cifpdil@cad.fireultimate.app), pushes to queue.
 * - queue(): Consumes from queue, POSTs each message to FireUltimate API (env.CAD_INGEST_API_URL).
 */

const MAX_RAW_BYTES = 100 * 1024; // 100 KB to stay under queue message limit (128 KB) with JSON overhead

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export default {
  async email(message, env, ctx) {
    const headers = {};
    try {
      message.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } catch (_) {
      // ignore
    }

    let rawBase64;
    try {
      const rawStream = message.raw;
      const buf = await new Response(rawStream).arrayBuffer();
      if (buf.byteLength > MAX_RAW_BYTES) {
        const truncated = buf.slice(0, MAX_RAW_BYTES);
        rawBase64 = arrayBufferToBase64(truncated) + "[TRUNCATED]";
      } else {
        rawBase64 = arrayBufferToBase64(buf);
      }
    } catch (e) {
      rawBase64 = "";
    }

    const payload = {
      from: message.from ?? "",
      to: message.to ?? "",
      headers,
      raw: rawBase64,
    };

    await env.CAD_EMAIL_QUEUE.send(payload);
  },

  async queue(batch, env, ctx) {
    const apiUrl = env.CAD_INGEST_API_URL;
    if (!apiUrl || typeof apiUrl !== "string") {
      for (const msg of batch.messages) {
        msg.retry();
      }
      return;
    }

    for (const message of batch.messages) {
      try {
        const body = message.body;
        const res = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(env.CAD_INGEST_SECRET
              ? { "X-CAD-Ingest-Secret": env.CAD_INGEST_SECRET }
              : {}),
          },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          message.ack();
        } else {
          message.retry();
        }
      } catch (_) {
        message.retry();
      }
    }
  },
};
