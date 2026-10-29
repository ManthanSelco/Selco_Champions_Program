// Vercel serverless function: every /api/* request is handled by the same Express app
// as the local server. Data and photos live in MongoDB (set MONGODB_URI in Vercel → Settings
// → Environment Variables). The website itself is served by Vercel from client/dist.
import { createApp, errorHandler } from '../server/app.js';

const app = createApp();
app.use(errorHandler);

export default app;
