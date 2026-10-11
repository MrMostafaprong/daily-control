const express = require('express');
const c = require('../controllers');

const router = express.Router();

router.get('/status', c.githubStatus);
router.post('/connect', c.githubConnect);
router.delete('/disconnect', c.githubDisconnect);
router.get('/repos', c.githubListRepos);
router.post('/repos', c.githubCreateRepo);
router.post('/push/:projectId', c.githubPushProject);
router.post('/sync/:projectId', c.githubSyncProject);
router.get('/repos/:owner/:repo/contents', c.githubListContents);
router.put('/repos/:owner/:repo/contents', c.githubWriteFile);
router.delete('/repos/:owner/:repo/contents', c.githubDeleteFile);
router.delete('/repos/:owner/:repo', c.githubDeleteRepo);
router.patch('/repos/:owner/:repo', c.githubUpdateVisibility);
router.post('/repos/:owner/:repo/issues', c.githubCreateIssue);
router.post('/repos/:owner/:repo/issues/:issueNumber/comments', c.githubCommentIssue);

module.exports = router;
