const services = require('../services');
const { asyncHandler, createError } = require('../middleware');

const githubStatus = asyncHandler(async (req, res) => {
  res.json({ status: await services.githubStatus() });
});

const githubConnect = asyncHandler(async (req, res) => {
  const { token } = req.body || {};
  if (!token) throw createError(400, 'token is required');
  res.json({ account: await services.githubConnect(token) });
});

const githubDisconnect = asyncHandler((req, res) => {
  services.githubDisconnect();
  res.status(204).end();
});

const githubListRepos = asyncHandler(async (req, res) => {
  res.json({ repos: await services.githubListRepos() });
});

const githubCreateRepo = asyncHandler(async (req, res) => {
  const { name, description, isPrivate } = req.body || {};
  if (!name) throw createError(400, 'name is required');
  const repo = await services.githubCreateRepo({ name, description, isPrivate });
  res.status(201).json({ repo });
});

const githubPushProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { repoName, commitMessage } = req.body || {};
  if (!repoName) throw createError(400, 'repoName is required');
  const result = await services.githubPushProject(projectId, { repoName, commitMessage });
  res.json({ result });
});

const githubListContents = asyncHandler(async (req, res) => {
  const { owner, repo } = req.params;
  const contents = await services.githubListContents(owner, repo, req.query.path || '', req.query.ref);
  res.json({ contents });
});

const githubWriteFile = asyncHandler(async (req, res) => {
  const { owner, repo } = req.params;
  const result = await services.githubWriteFile(owner, repo, req.body || {});
  res.json({ result });
});

const githubDeleteFile = asyncHandler(async (req, res) => {
  const { owner, repo } = req.params;
  const result = await services.githubDeleteFile(owner, repo, req.body || {});
  res.json({ result });
});

const githubDeleteRepo = asyncHandler(async (req, res) => {
  const result = await services.githubDeleteRepo(req.params.owner, req.params.repo);
  res.json({ result });
});
const githubUpdateVisibility = asyncHandler(async (req, res) => { const result = await services.githubUpdateVisibility(req.params.owner, req.params.repo, req.body?.isPrivate); res.json({ result }); });

const githubCreateIssue = asyncHandler(async (req, res) => {
  const result = await services.githubCreateIssue(req.params.owner, req.params.repo, req.body || {});
  res.status(201).json({ result });
});

const githubCommentIssue = asyncHandler(async (req, res) => {
  const result = await services.githubCommentIssue(req.params.owner, req.params.repo, req.params.issueNumber, req.body?.body);
  res.status(201).json({ result });
});

module.exports = {
  githubStatus,
  githubConnect,
  githubDisconnect,
  githubListRepos,
  githubCreateRepo,
  githubPushProject,
  githubListContents,
  githubWriteFile,
  githubDeleteFile,
  githubDeleteRepo,
  githubUpdateVisibility,
  githubCreateIssue,
  githubCommentIssue,
};
