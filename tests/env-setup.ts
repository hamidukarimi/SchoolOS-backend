process.env.NODE_ENV ??= "test";
process.env.MONGO_URI ??= "mongodb://127.0.0.1:27017/schoolos-notification-test";
process.env.JWT_ACCESS_SECRET ??= "test-access-secret-value";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-value";
process.env.JWT_ACCESS_EXPIRES_IN ??= "15m";
process.env.JWT_REFRESH_EXPIRES_IN ??= "7d";
process.env.CLIENT_URL ??= "http://localhost:5173";
