const services = require('../services');
const { asyncHandler, createError } = require('../middleware');

function validateGenerationOptions({ temperature, maxTokens }) {
  if (temperature !== undefined && (!Number.isFinite(temperature) || temperature < 0 || temperature > 2)) {
    throw createError(400, 'temperature must be between 0 and 2');
  }
  if (maxTokens !== undefined && (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 100000)) {
    throw createError(400, 'maxTokens must be a positive integer');
  }
}

const chat = asyncHandler(async (req, res) => {
  const { providerId, model, messages, prompt, systemPrompt, temperature, maxTokens } =
    req.body || {};

  if (!providerId) throw createError(400, 'providerId is required');
  validateGenerationOptions({ temperature, maxTokens });

  const result = await services.aiChat({
    providerId,
    model,
    messages,
    prompt,
    systemPrompt,
    temperature,
    maxTokens,
  });

  res.json({ result });
});

const fallback = asyncHandler(async (req, res) => {
  const { attempts, messages, prompt, systemPrompt, temperature, maxTokens } =
    req.body || {};

  const result = await services.aiFallback({
    attempts,
    messages,
    prompt,
    systemPrompt,
    temperature,
    maxTokens,
  });

  res.json(result);
});

const parallel = asyncHandler(async (req, res) => {
  const { tasks } = req.body || {};
  const result = await services.aiParallel({ tasks });
  res.json(result);
});

module.exports = {
  chat,
  fallback,
  parallel,
};
