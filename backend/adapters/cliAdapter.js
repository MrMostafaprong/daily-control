const executionManager = require('../utils/executionManager');

/**
 * تعريف كل CLI مدعوم:
 *  - command: اسم الأمر في PATH
 *  - buildArgs: كيف نبني args من { prompt, model }
 *
 * لأي CLI جديد، أضف سطر هنا. لكن لازم كمان تضيف command في
 * config.terminal.allowedCommands عشان executionManager يقبله.
 */
const CLI_SPECS = {
  claude: {
    command: 'claude',
    buildArgs: ({ prompt }) => ['-p', prompt],
  },
  codex: {
    command: 'codex',
    buildArgs: ({ prompt }) => ['exec', prompt],
  },
  ollama: {
    command: 'ollama',
    buildArgs: ({ prompt, model }) => ['run', model || 'llama2', prompt],
  },
  llm: {
    command: 'llm',
    buildArgs: ({ prompt, model }) => (model ? ['-m', model, prompt] : [prompt]),
  },
};

function adapterError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function getSpec(command) {
  const spec = CLI_SPECS[command];
  if (!spec) {
    throw adapterError(
      400,
      `Unknown CLI "${command}". Add it to CLI_SPECS in cliAdapter.js`
    );
  }
  return spec;
}

function supports(command) {
  return Object.prototype.hasOwnProperty.call(CLI_SPECS, command);
}

function listSupported() {
  return Object.keys(CLI_SPECS).map((name) => ({
    name,
    command: CLI_SPECS[name].command,
  }));
}

async function chat({ command, prompt, model, cwd, timeout }) {
  if (!command || typeof command !== 'string') {
    throw adapterError(400, 'command is required');
  }
  if (!prompt || typeof prompt !== 'string') {
    throw adapterError(400, 'prompt is required');
  }
  if (!cwd || typeof cwd !== 'string') {
    throw adapterError(400, 'cwd is required');
  }

  const spec = getSpec(command);
  const args = spec.buildArgs({ prompt, model });

  const result = await executionManager.execute({
    command: spec.command,
    args,
    cwd,
    timeout,
  });

  return {
    ok: result.ok,
    content: result.ok ? result.stdout.trim() : '',
    stderr: result.stderr,
    code: result.code,
    duration: result.duration,
    timedOut: result.timedOut,
  };
}

module.exports = {
  chat,
  supports,
  listSupported,
};