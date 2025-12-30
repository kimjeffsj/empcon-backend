import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL,
  jwt: {
    secret: process.env.JWT_SECRET || "your-secret-key",
    expiresIn: process.env.JWT_EXPIRES_IN || "30m",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "your-refresh-secret",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
  },
  email: {
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT,
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    emailFrom: process.env.EMAIL_FROM,
    accountantEmail: process.env.ACCOUNTANT_EMAIL,
  },
  frontend: {
    url: process.env.FRONTEND_URL || "http://localhost:3000",
  },
};

// ========================================
// Environment Variable Validation
// ========================================

const isProduction = process.env.NODE_ENV === "production";
const isDevelopment = process.env.NODE_ENV === "development";

// Always required variables (all environments)
const alwaysRequiredEnvVars = ["DATABASE_URL", "JWT_SECRET", "JWT_REFRESH_SECRET"];

// Production-only required variables
const productionRequiredEnvVars = [
  "CLIENT_URL",
  "FRONTEND_URL",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "EMAIL_FROM",
];

// Validate always required variables
for (const envVar of alwaysRequiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`❌ Missing required environment variable: ${envVar}`);
  }
}

// Validate production-specific variables
if (isProduction) {
  console.log("🔍 Running production environment validation...");

  // Check production-required variables
  for (const envVar of productionRequiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(
        `❌ Missing required production environment variable: ${envVar}\n` +
          `   Please check your .env.production file and ensure all required variables are set.`
      );
    }
  }

  // Validate JWT secret strength (production should not use weak defaults)
  const weakSecrets = [
    "your-secret-key",
    "your-refresh-secret",
    "SupErScercet",
    "MechaSRefshre",
  ];

  if (
    process.env.JWT_SECRET &&
    weakSecrets.includes(process.env.JWT_SECRET)
  ) {
    throw new Error(
      `❌ Production environment detected with weak JWT_SECRET!\n` +
        `   Please generate a strong secret using: openssl rand -base64 64\n` +
        `   Current value appears to be a development default.`
    );
  }

  if (
    process.env.JWT_REFRESH_SECRET &&
    weakSecrets.includes(process.env.JWT_REFRESH_SECRET)
  ) {
    throw new Error(
      `❌ Production environment detected with weak JWT_REFRESH_SECRET!\n` +
        `   Please generate a strong secret using: openssl rand -base64 64\n` +
        `   Current value appears to be a development default.`
    );
  }

  // Validate DATABASE_URL is not using localhost or default credentials
  if (process.env.DATABASE_URL) {
    const dbUrl = process.env.DATABASE_URL;
    if (
      dbUrl.includes("localhost") ||
      dbUrl.includes("127.0.0.1") ||
      dbUrl.includes("postgres:postgres")
    ) {
      throw new Error(
        `❌ Production DATABASE_URL appears to use localhost or default credentials!\n` +
          `   Please use a production database URL (AWS RDS recommended).`
      );
    }
  }

  // Validate CORS origin is not localhost
  if (
    process.env.CLIENT_URL &&
    process.env.CLIENT_URL.includes("localhost")
  ) {
    console.warn(
      `⚠️  Warning: Production CLIENT_URL is set to localhost.\n` +
        `   Make sure to update this to your production frontend domain.`
    );
  }

  console.log("✅ Production environment validation passed!");
}

// Development environment warnings
if (isDevelopment) {
  console.log("🔧 Running in development mode");
  console.log("   - Rate limiting: DISABLED");
  console.log("   - Weak secrets: ALLOWED (for development only)");
}

// Log configuration summary (hide sensitive values)
console.log("\n📋 Configuration Summary:");
console.log(`   Environment: ${config.nodeEnv}`);
console.log(`   Port: ${config.port}`);
console.log(`   Database: ${config.databaseUrl ? "✅ Configured" : "❌ Missing"}`);
console.log(`   JWT Secret: ${config.jwt.secret ? "✅ Set" : "❌ Missing"}`);
console.log(`   JWT Refresh Secret: ${config.jwt.refreshSecret ? "✅ Set" : "❌ Missing"}`);
console.log(`   CORS Origin: ${config.cors.origin}`);
console.log(`   SMTP: ${config.email.smtpHost ? "✅ Configured" : "⚠️  Not configured"}`);
console.log(`   Frontend URL: ${config.frontend.url}\n`);
