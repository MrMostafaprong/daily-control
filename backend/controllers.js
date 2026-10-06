const projectController = require('./controllers/projectController');
const githubController = require('./controllers/githubController');
const fileController = require('./controllers/fileController');
const providerController = require('./controllers/providerController');
const modelController = require('./controllers/modelController');
const aiController = require('./controllers/aiController');
const terminalController = require('./controllers/terminalController');
const taskController = require('./controllers/taskController');
const { asyncHandler } = require('./middleware');

// ─── Core ─────────────────────────────────────────────

const getAppInfo = asyncHandler((req, res) => {
  res.json({
    name: 'Daily Control',
    version: '1.0.0',
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

const getHealth = asyncHandler((req, res) => {
  res.json({
    status: 'ok',
    service: 'daily-control-backend',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ─── Exports ──────────────────────────────────────────

module.exports = {
  // Core
  getAppInfo,
  getHealth,

  // Projects
  listProjects: projectController.listProjects,
  discoverProjects: projectController.discoverProjects,
  getProject: projectController.getProject,
  createProject: projectController.createProject,
  updateProject: projectController.updateProject,
  removeProject: projectController.removeProject,
  scanProject: projectController.scanProject,
  getProjectTree: projectController.getProjectTree,

  // GitHub
  githubStatus: githubController.githubStatus,
  githubConnect: githubController.githubConnect,
  githubDisconnect: githubController.githubDisconnect,
  githubListRepos: githubController.githubListRepos,
  githubCreateRepo: githubController.githubCreateRepo,
  githubPushProject: githubController.githubPushProject,
  githubListContents: githubController.githubListContents,
  githubWriteFile: githubController.githubWriteFile,
  githubDeleteFile: githubController.githubDeleteFile,
  githubDeleteRepo: githubController.githubDeleteRepo,
  githubCreateIssue: githubController.githubCreateIssue,
  githubCommentIssue: githubController.githubCommentIssue,

  // Files
  getFileTree: fileController.getFileTree,
  readFile: fileController.readFile,
  writeFile: fileController.writeFile,
  detectModels: fileController.detectModels,

  // Providers
  listProviders: providerController.listProviders,
  getProvider: providerController.getProvider,
  createProvider: providerController.createProvider,
  updateProvider: providerController.updateProvider,
  removeProvider: providerController.removeProvider,
  getProviderDefaults: providerController.getProviderDefaults,

  // Models
  listModels: modelController.listModels,
  getModel: modelController.getModel,
  refreshModels: modelController.refreshModels,

  // AI
  aiChat: aiController.chat,
  aiFallback: aiController.fallback,
  aiParallel: aiController.parallel,

  // Terminal
  runTerminalCommand: terminalController.runCommand,
  listAllowedCommands: terminalController.listAllowedCommands,

  // Tasks
  listTasks: taskController.listTasks,
  getTask: taskController.getTask,
  createTask: taskController.createTask,
  updateTask: taskController.updateTask,
  removeTask: taskController.removeTask,
  completeTask: taskController.completeTask,
  taskStats: taskController.taskStats,

  // Planner
  generatePlan: taskController.generatePlan,
  breakdownTask: taskController.breakdownTask,
  suggestPriorities: taskController.suggestPriorities,
};
