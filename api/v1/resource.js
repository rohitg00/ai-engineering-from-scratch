const { readResource, readTranslatedResource, InputError } = require('../../lib/agent-content');
const { quality, send, problem, apiHeaders, cacheable, createLimiter } = require('../../lib/agent-http');

function createHandler({ read = readResource, readTranslated = readTranslatedResource, limit = createLimiter() } = {}) {
  return async (req, res) => {
    apiHeaders(res);
    if (!limit(req, res)) return;
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      return problem(req, res, 405, 'method_not_allowed', 'Use GET or HEAD.');
    }
    if (!quality(req.headers.accept, 'application/json')) return problem(req, res, 406, 'representation_not_supported', 'Request application/json.');
    try {
      const query = req.query || {};
      if (Object.keys(query).some(key => key !== 'path' && key !== 'lang')) throw new InputError('Only the path and lang query parameters are supported.');
      const entry = await readTranslated(query.path, query.lang, { read });
      if (!entry && query.lang !== undefined && query.lang !== 'en') return problem(req, res, 404, 'resource_not_found', 'No published translation matches this path and lang.', 'Use a language from the resource translations, or omit lang for the English original.');
      if (!entry) return problem(req, res, 404, 'resource_not_found', 'No published resource matches this path.', 'Search /api/v1/catalog and use a returned path.');
      cacheable(res);
      send(req, res, 200, 'application/json', JSON.stringify(entry) + '\n');
    } catch (error) {
      if (error instanceof InputError) return problem(req, res, 400, 'invalid_parameter', error.message);
      problem(req, res, 503, 'content_unavailable', 'The resource is temporarily unavailable.', 'Retry later or use the linked GitHub source from /docs.');
    }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
