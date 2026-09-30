const { search, InputError } = require('../../lib/agent-content');
const { quality, send, problem, apiHeaders, createLimiter } = require('../../lib/agent-http');

function createHandler({ queryCatalog = search, limit = createLimiter() } = {}) {
  return (req, res) => {
    apiHeaders(res);
    if (!limit(req, res)) return;
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      return problem(req, res, 405, 'method_not_allowed', 'Use GET or HEAD.');
    }
    if (!quality(req.headers.accept, 'application/json')) return problem(req, res, 406, 'representation_not_supported', 'Request application/json.');
    try {
      const args = { ...req.query };
      for (const key of ['limit', 'offset']) {
        if (key in args) {
          if (typeof args[key] !== 'string' || !/^\d+$/.test(args[key])) throw new InputError(`${key} must be an integer query parameter.`);
          args[key] = Number(args[key]);
        }
      }
      send(req, res, 200, 'application/json', JSON.stringify(queryCatalog(args)) + '\n');
    } catch (error) {
      if (error instanceof InputError) return problem(req, res, 400, 'invalid_parameter', error.message);
      problem(req, res, 503, 'content_unavailable', 'The curriculum catalog is temporarily unavailable.', 'Retry later or use the linked GitHub source from /docs.');
    }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
