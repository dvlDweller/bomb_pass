    const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const apiRoutes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const AppError = require('./utils/AppError');
const errorCodes = require('./utils/errorCodes');

function createApp() {
  const app = express();

  // CORS: hub address only (env HUB_ORIGIN), plus localhost in development.
  const allowed = [];
  if (config.hubOrigin) {
    allowed.push(...config.hubOrigin.split(',').map((o) => o.trim()).filter(Boolean));
  }
  if (config.allowLocalhostCors) {
    allowed.push('http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000');
  }
  app.use(cors(allowed.length > 0 ? { origin: allowed } : false));

  app.use(express.json({ limit: '1mb' }));

  // Hub Contract thumbnail (Rule 1).
  const publicDir = path.join(__dirname, '..', 'public');
  app.get(['/games/bomb-pass/thumbnail.png', '/thumbnail.png'], (req, res) => {
    res.sendFile(path.join(publicDir, 'thumbnail.png'));
  });

  // The same router is mounted at BOTH prefixes (the hub may or may not
  // strip /games/bomb-pass).
  app.use('/api/v1', apiRoutes);
  app.use('/games/bomb-pass/api/v1', apiRoutes);

  // Unknown API routes use the same single error format.
  app.use('/api/v1', (req, res, next) => {
    next(new AppError(404, errorCodes.SESSION_NOT_FOUND, 'That API endpoint does not exist.'));
  });

  app.use(errorHandler);

  return app;
}

module.exports = createApp;
