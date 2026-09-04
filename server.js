// Local/traditional-host entry point (not used on Vercel — see api/index.js).
const app = require('./app');
const env = require('./config/env');

app.listen(env.port, () => {
  console.log(`School Management System running at http://localhost:${env.port}`);
});
