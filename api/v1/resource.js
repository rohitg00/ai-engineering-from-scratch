const { readResource, InputError } = require('../../lib/agent-content');
const { quality, send, problem, apiHeaders, createLimiter } = require('../../lib/agent-http');

function createHandler({ read = readResource, limit = createLimiter() } = {}) {
  return (req, res) => {
    apiHeaders(res);
    if (!limit(req, res)) return;
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      return problem(req, res, 405, 'method_not_allowed', 'Use GET or HEAD.');
    }
    if (!quality(req.headers.accept, 'application/json')) return problem(req, res, 406, 'representation_not_supported', 'Request application/json.');
    try {
      if (Object.keys(req.query || {}).some(key => key !== 'path')) throw new InputError('Only the path query parameter is supported.');
      const entry = read(req.query?.path);
      if (!entry) return problem(req, res, 404, 'resource_not_found', 'No published resource matches this path.', 'Search /api/v1/catalog and use a returned path.');
      send(req, res, 200, 'application/json', JSON.stringify(entry) + '\n');
    } catch (error) {
      if (error instanceof InputError) return problem(req, res, 400, 'invalid_parameter', error.message);
      problem(req, res, 503, 'content_unavailable', 'The resource is temporarily unavailable.', 'Retry later or use the linked GitHub source from /docs.');
    }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
