import jwt from "jsonwebtoken";
import { config } from "@/config/env.config";
import { StringValue } from "ms";
import { TokenPayload } from "@empcon/types";

export const generateTokens = (payload: Omit<TokenPayload, "iat" | "exp">) => {
  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as StringValue,
  });

  const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn as StringValue,
  });

  return { accessToken, refreshToken };
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, config.jwt.secret) as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, config.jwt.refreshSecret) as TokenPayload;
};

export const decodeToken = (token: string) => {
  return jwt.decode(token);
};
