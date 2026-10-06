const taskService = require('./taskService');
const aiService = require('./aiService');

const DEFAULT_SYSTEM_PROMPT =
  'أنت مساعد تخطيط يومي عربي ومنظم. أجب بالعربية فقط. ' +
  'كن عمليًا ومختصرًا، ورتّب المهام حسب الأهمية والاستعجال. ' +
  'عند طلب خطة اليوم أعد JSON صالحًا فقط بدون Markdown.';

function createError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function formatTasks(tasks) {
  if (!tasks.length) return '(لا توجد مهام معلقة)';
  return tasks
    .map((t, i) => {
      const due = t.dueDate ? ` — الاستحقاق: ${t.dueDate}` : '';
      const proj = t.projectId ? ` — المشروع: ${t.projectId}` : '';
      return `${i + 1}. المعرّف: ${t.id} | الأولوية: ${t.priority} | ${t.title}${due}${proj}`;
    })
    .join('\n');
}

function parseJsonResponse(content) {
  if (typeof content !== 'string') return null;
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(cleaned); } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { return null; }
  }
}

function normalizePlan(raw, tasks, date) {
  const plan = raw && typeof raw === 'object' ? raw : {};
  const known = new Map(tasks.map((task) => [task.id, task]));
  const schedule = Array.isArray(plan.schedule) ? plan.schedule : [];
  const later = Array.isArray(plan.later) ? plan.later : [];
  const normalizeItem = (item, index) => {
    const task = known.get(item?.taskId) || tasks.find((candidate) => candidate.title === item?.title);
    return {
      order: Number(item?.order) || index + 1,
      taskId: task?.id || item?.taskId || null,
      title: task?.title || item?.title || 'مهمة غير محددة',
      priority: task?.priority || item?.priority || 'medium',
      start: item?.start || null,
      end: item?.end || null,
      reason: item?.reason || '',
    };
  };
  return {
    date,
    summary: plan.summary || 'خطة يومية عملية حسب الأولوية والوقت المتاح.',
    focus: plan.focus || 'التركيز على أهم المهام أولًا.',
    schedule: schedule.map(normalizeItem),
    later: later.map(normalizeItem),
    tips: Array.isArray(plan.tips) ? plan.tips.filter(Boolean).slice(0, 8) : [],
  };
}

async function generateDailyPlan({ providerId, model, date } = {}) {
  if (!providerId) throw createError(400, 'providerId is required');

  const targetDate = date || new Date().toISOString().slice(0, 10);
  const tasks = taskService.list({ status: 'pending' });

  if (tasks.length === 0) {
    return {
      date: targetDate,
      taskCount: 0,
      plan: normalizePlan({ summary: 'لا توجد مهام معلقة اليوم.', focus: 'أضف مهام جديدة للبدء.' }, tasks, targetDate),
      model: null,
    };
  }

  const prompt = [
    `التاريخ: ${targetDate}.`,
    '',
    'المهام المعلقة:',
    formatTasks(tasks),
    '',
    'أعد JSON فقط بهذا الشكل: {"summary":"ملخص عربي","focus":"أهم تركيز","schedule":[{"order":1,"taskId":"معرف المهمة","title":"العنوان","priority":"high|medium|low","start":"09:00","end":"10:00","reason":"سبب مختصر"}],"later":[{"taskId":"معرف المهمة","title":"العنوان","reason":"السبب"}],"tips":["نصيحة"]}.',
    'ضع بحد أقصى 5 مهام في schedule، وانقل الباقي إلى later. لا تخترع مهام غير موجودة.',
  ].join('\n');

  const response = await aiService.chat({
    providerId,
    model,
    prompt,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    temperature: 0.3,
  });

  return {
    date: targetDate,
    taskCount: tasks.length,
    plan: normalizePlan(parseJsonResponse(response.content), tasks, targetDate),
    model: response.model,
  };
}

async function breakdownTask({ taskId, providerId, model } = {}) {
  if (!taskId) throw createError(400, 'taskId is required');
  if (!providerId) throw createError(400, 'providerId is required');

  const task = taskService.getById(taskId);
  if (!task) throw createError(404, 'Task not found');

  const prompt = [
    `المهمة: ${task.title}`,
    task.description ? `الوصف: ${task.description}` : '',
    `الأولوية: ${task.priority}`,
    task.dueDate ? `الاستحقاق: ${task.dueDate}` : '',
    '',
    'قسّم المهمة إلى 3-7 مهام فرعية عملية. أجب بالعربية في قائمة مرقمة.',
  ]
    .filter(Boolean)
    .join('\n');

  const response = await aiService.chat({
    providerId,
    model,
    prompt,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    temperature: 0.4,
  });

  return {
    taskId,
    title: task.title,
    breakdown: response.content,
    model: response.model,
  };
}

async function suggestPriorities({ providerId, model } = {}) {
  if (!providerId) throw createError(400, 'providerId is required');

  const tasks = taskService.list({ status: 'pending' });
  if (tasks.length === 0) {
    return { suggestions: [], model: null };
  }

  const prompt = [
    'Pending tasks:',
    formatTasks(tasks),
    '',
    'لكل مهمة اقترح أولوية (low/medium/high) وسببًا في سطر واحد. أجب بالعربية وبنفس ترتيب الإدخال.',
  ].join('\n');

  const response = await aiService.chat({
    providerId,
    model,
    prompt,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    temperature: 0.2,
  });

  return {
    taskCount: tasks.length,
    suggestions: response.content,
    model: response.model,
  };
}

module.exports = {
  generateDailyPlan,
  breakdownTask,
  suggestPriorities,
};
