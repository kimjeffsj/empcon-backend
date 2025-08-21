import morgan from "morgan";
import { config } from "../config/env";

const format = config.nodeEnv === "production" ? "combined" : "dev";

export const loggerMiddleware = morgan(format);
