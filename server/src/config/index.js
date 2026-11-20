require('dotenv').config();
const { z } = require('zod');
const schema = z.object({
  NODE_ENV: z.enum(['development','test','production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().url(), GEMINI_API_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().startsWith('sk_'), CLERK_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
  CLIENT_URL: z.string().url().refine(v => new URL(v).origin === v, 'Use an origin without a trailing slash'),
  DAILY_ANALYSIS_LIMIT: z.coerce.number().int().positive().default(10),
  USER_CONCURRENCY: z.coerce.number().int().positive().default(2),
  QUEUE_CONCURRENCY: z.coerce.number().int().positive().default(2),
  QUEUE_CAPACITY: z.coerce.number().int().positive().default(20),
  GEMINI_CONCURRENCY: z.coerce.number().int().positive().default(2),
  UNKNOWN_THRESHOLD: z.coerce.number().min(0).max(1).default(0.60),
  MAX_CLAUSES: z.coerce.number().int().positive().default(300),
  MAX_TEXT_CHARACTERS: z.coerce.number().int().positive().default(250000),
  LOG_LEVEL: z.enum(['debug','info','warn','error','fatal','silent']).default('info'),
});
function loadConfig(env = process.env) {
  const result = schema.safeParse(env);
  if (!result.success) throw new Error(`Invalid environment: ${result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  return result.data;
}
module.exports = { loadConfig };
