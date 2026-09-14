// Tests must never inherit the development database from server/.env.
process.env.NODE_ENV = "test";
process.env.DATABASE_MODE = "mongo";
process.env.MONGO_URI = process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27017/skillswap_test";
process.env.CLIENT_URL = process.env.TEST_CLIENT_URL || "https://skillswap-nine-jet.vercel.app";
process.env.CRON_SECRET = "test-cron-secret-value";
process.env.VERCEL_URL = "skillswap-preview-example.vercel.app";
