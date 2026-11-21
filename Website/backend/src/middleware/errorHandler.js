export function notFoundHandler(req, res) {
  res.status(404).json({ detail: `Route ${req.method} ${req.path} not found` });
}

export function errorHandler(err, req, res, next) {
  // eslint-disable-next-line no-console
  console.error('[backend] unhandled error:', err);
  const status = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  res.status(status).json({ detail: 'Internal server error' });
}