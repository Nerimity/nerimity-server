export default {
  PORT: parseInt(process.env.PORT as string),
  JWT_SECRET: process.env.JWT_SECRET as string,
  MONGODB_URI: process.env.MONGODB_URI as string,
  REDIS_HOST: process.env.REDIS_HOST as string,
  REDIS_PORT: parseInt(process.env.REDIS_PORT as string),
  REDIS_PASS: process.env.REDIS_PASS as string,
};