const projectService = require('./services/projectService');
const githubService = require('./services/githubService');
const fileService = require('./services/fileService');
const providerService = require('./services/providerService');
const modelService = require('./services/modelService');
const aiService = require('./services/aiService');
const orchestrationService = require('./services/orchestrationService');
const terminalService = require('./services/terminalService');
const taskService = require('./services/taskService');
const plannerService = require('./services/plannerService');

module.exports = {
  // ─── Projects ─────────────────────────────────────
  listProjects: projectService.listProjects,
  discoverProjects: projectService.discoverProjects,
  browseDirectories: projectService.browseDirectories,
  getProject: projectService.getProject,
  createProject: projectService.createProject,
  updateProject: projectService.updateProject,
  removeProject: projectService.removeProject,
  scanProject: projectService.scanProject,
  getProjectTree: projectService.getProjectTree,

  // ─── GitHub ───────────────────────────────────────
  githubStatus: githubService.githubStatus,
  githubConnect: githubService.githubConnect,
  githubDisconnect: githubService.githubDisconnect,
  githubListRepos: githubService.githubListRepos,
  githubCreateRepo: githubService.githubCreateRepo,
  githubPushProject: githubService.githubPushProject,
  githubSyncProject: githubService.githubSyncProject,
  githubListContents: githubService.githubListContents,
  githubWriteFile: githubService.githubWriteFile,
  githubDeleteFile: githubService.githubDeleteFile,
  githubDeleteRepo: githubService.githubDeleteRepo,
  githubUpdateVisibility: githubService.githubUpdateVisibility,
  githubCreateIssue: githubService.githubCreateIssue,
  githubCommentIssue: githubService.githubCommentIssue,

  // ─── Files ────────────────────────────────────────
  getFileTree: fileService.getFileTree,
  readFile: fileService.readFile,
  writeFile: fileService.writeFile,
  detectModels: fileService.detectModels,

  // ─── Providers ────────────────────────────────────
  listProviders: providerService.list,
  getProvider: providerService.getPublic,
  createProvider: providerService.create,
  updateProvider: providerService.update,
  removeProvider: providerService.remove,
  getProviderDefaults: providerService.getDefaults,

  // ─── Models ───────────────────────────────────────
  listModels: modelService.listAll,
  getModel: modelService.getModel,
  clearModelsCache: modelService.clearCache,

  // ─── AI ───────────────────────────────────────────
  aiChat: aiService.chat,

  // ─── Orchestration ────────────────────────────────
  aiFallback: orchestrationService.fallback,
  aiParallel: orchestrationService.parallel,

  // ─── Terminal ─────────────────────────────────────
  runTerminalCommand: terminalService.run,
  listAllowedCommands: terminalService.listAllowed,
  upsertTerminalCommand: terminalService.upsertCommand,
  removeTerminalCommand: terminalService.removeCommand,
  reloadTerminalCommands: terminalService.reloadCommands,

  // ─── Tasks ────────────────────────────────────────
  listTasks: taskService.list,
  getTask: taskService.getById,
  createTask: taskService.create,
  updateTask: taskService.update,
  removeTask: taskService.remove,
  completeTask: taskService.complete,
  taskStats: taskService.stats,

  // ─── Planner ──────────────────────────────────────
  generatePlan: plannerService.generateDailyPlan,
  breakdownTask: plannerService.breakdownTask,
  suggestPriorities: plannerService.suggestPriorities,
};
