const aiService = require('./aiService');

/**
 * Orchestration = التنسيق بين أكتر من مزوّد/موديل.
 *
 * بيوفّر طريقتين:
 *  1) fallback: جرّب مزوّد، لو فشل، جرّب اللي بعده... لحد ما واحد ينجح.
 *  2) parallel: ابعت نفس المهمة (أو مهام مختلفة) لأكتر من مزوّد في نفس الوقت.
 *
 * مش بيتعامل مع محادثات ولا حفظ — ده شغل conversationService.
 */

function createError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function validateAttempts(attempts) {
  if (!Array.isArray(attempts) || attempts.length === 0) {
    throw createError(400, 'attempts must be a non-empty array');
  }
  for (const a of attempts) {
    if (!a || !a.providerId) {
      throw createError(400, 'each attempt must have providerId');
    }
  }
}

/**
 * Fallback chain:
 *   aiService.chat → فشل → التالي → فشل → التالي...
 *
 * @param {object} params
 * @param {Array<{providerId:string, model?:string}>} params.attempts
 * @param {object} params.chatArgs — نفس اللي aiService.chat بياخده (messages/prompt/...)
 */
async function fallback({ attempts, ...chatArgs }) {
  validateAttempts(attempts);

  const tried = [];
  let lastError = null;

  for (const attempt of attempts) {
    try {
      const result = await aiService.chat({
        providerId: attempt.providerId,
        model: attempt.model,
        ...chatArgs,
      });

      return {
        ok: true,
        result,
        usedProviderId: attempt.providerId,
        usedModel: attempt.model || null,
        tried,
      };
    } catch (err) {
      lastError = err;
      tried.push({
        providerId: attempt.providerId,
        model: attempt.model || null,
        error: err.message,
        statusCode: err.statusCode || null,
      });
    }
  }

  throw createError(
    lastError?.statusCode || 500,
    `All providers failed. Last error: ${lastError?.message || 'unknown'}`
  );
}

/**
 * Parallel: كل task بتتنفذ بشكل مستقل، وبترجع كلها مع بعض.
 *
 * @param {object} params
 * @param {Array<{label:string, providerId:string, model?:string, prompt?:string, messages?:Array, systemPrompt?:string, temperature?:number, maxTokens?:number}>} params.tasks
 */
async function parallel({ tasks }) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    throw createError(400, 'tasks must be a non-empty array');
  }
  for (const t of tasks) {
    if (!t || !t.providerId) {
      throw createError(400, 'each task must have providerId');
    }
    if (!t.label || typeof t.label !== 'string') {
      throw createError(400, 'each task must have a label');
    }
  }

  const settled = await Promise.allSettled(
    tasks.map((task) =>
      aiService.chat({
        providerId: task.providerId,
        model: task.model,
        prompt: task.prompt,
        messages: task.messages,
        systemPrompt: task.systemPrompt,
        temperature: task.temperature,
        maxTokens: task.maxTokens,
      })
    )
  );

  return {
    tasks: tasks.map((task, i) => {
      const s = settled[i];
      if (s.status === 'fulfilled') {
        return {
          label: task.label,
          providerId: task.providerId,
          model: task.model || null,
          ok: true,
          result: s.value,
        };
      }
      return {
        label: task.label,
        providerId: task.providerId,
        model: task.model || null,
        ok: false,
        error: s.reason?.message || 'unknown error',
        statusCode: s.reason?.statusCode || null,
      };
    }),
  };
}

module.exports = {
  fallback,
  parallel,
};