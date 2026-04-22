import { buildApp } from '../app.js';

const app = buildApp();

export default app;

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
  maxDuration: 60,
};
