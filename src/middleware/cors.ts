import cors from "cors";
import { config } from "../config/env";

export const corsMiddleware = cors({
  origin: config.cors.origin,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});
