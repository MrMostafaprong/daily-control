const streamService = require('../services/streamService');

function setupSSE(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

function writeEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function streamChat(req, res) {
  const body = req.body || {};

  if (!body.providerId) {
    return res.status(400).json({ error: 'providerId is required' });
  }
  if (body.temperature !== undefined && (!Number.isFinite(body.temperature) || body.temperature < 0 || body.temperature > 2)) {
    return res.status(400).json({ error: 'temperature must be between 0 and 2' });
  }
  if (body.maxTokens !== undefined && (!Number.isInteger(body.maxTokens) || body.maxTokens < 1 || body.maxTokens > 100000)) {
    return res.status(400).json({ error: 'maxTokens must be a positive integer' });
  }

  const controller = new AbortController();
  let aborted = false;

  // req 'close' بيتطلع بعد قراءة الـ body، المهم نراقب الـ response
  res.on('close', () => {
    if (!res.writableEnded) {
      aborted = true;
      controller.abort();
    }
  });

  setupSSE(res);

  try {
    for await (const chunk of streamService.streamChat({
      ...body,
      signal: controller.signal,
    })) {
      if (aborted) break;
      writeEvent(res, 'chunk', { content: chunk });
    }

    if (!aborted) {
      writeEvent(res, 'done', { ok: true });
    }
  } catch (err) {
    if (!aborted) {
      writeEvent(res, 'error', {
        message: err.message || 'stream failed',
        statusCode: err.statusCode || 500,
      });
    }
  } finally {
    res.end();
  }
}

module.exports = {
  streamChat,
};
