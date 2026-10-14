const config = require('./src/config');
const createApp = require('./src/app');

const app = createApp();

app.listen(config.port, () => {
  console.log(`Bomb Pass API listening on port ${config.port} (${config.env})`);
});
