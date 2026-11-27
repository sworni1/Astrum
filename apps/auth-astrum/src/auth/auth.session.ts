import { Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { User } from "@astrum/db/client";
import { describeError } from "../events/describe-error";
import { SESSION_TTL_SECONDS } from "../redis/constants/redis.constants";
import { loggedSid, sessionKey } from "../redis/helpers/session.helpers";
import { RedisService } from "../redis/redis.service";
import {
  JWT_EXPIRES_IN,
  JWT_SECRET_KEY,
  SESSION_STORE_UNAVAILABLE_CODE,
  SESSION_UNAVAILABLE,
} from "./constants/auth.constants";
import { buildSessionRecord, createSessionId } from "./helpers/session.helpers";

type SessionDeps = {
  jwt: JwtService;
  config: ConfigService;
  sessions: RedisService;
  logger: Logger;
};

const verifiedSid = async (
  config: ConfigService,
  jwt: JwtService,
  token: string | undefined,
): Promise<string | undefined> => {
  if (!token) {
    return undefined;
  }

  try {
    const secret = await config.get(JWT_SECRET_KEY);
    const payload = await jwt.verifyAsync<{ sid?: string }>(token, {
      secret: secret,
    });

    return payload.sid;
  } catch {
    return undefined;
  }
};

export const signSessionToken = async (
  { config, jwt, logger, sessions }: SessionDeps,
  userId: User["id"],
  userAgent?: string | null,
  writeFailureMessage: string = SESSION_UNAVAILABLE,
): Promise<{ token: string; expiresIn: string }> => {
  const sid = createSessionId();

  try {
    await sessions.set(
      sessionKey(sid),
      buildSessionRecord(userId, userAgent),
      SESSION_TTL_SECONDS,
    );
  } catch (error) {
    logger.error(
      JSON.stringify({
        event: "session.write.failed",
        userId,
        reason: describeError(error),
      }),
    );

    throw new ServiceUnavailableException({
      code: SESSION_STORE_UNAVAILABLE_CODE,
      message: writeFailureMessage,
    });
  }

  const payload = {
    userId: userId,
    sid: sid,
  };

  const secret = await config.get(JWT_SECRET_KEY);

  const token = await jwt.signAsync(payload, {
    expiresIn: JWT_EXPIRES_IN,
    secret: secret,
  });

  return { token: token, expiresIn: JWT_EXPIRES_IN };
};

export const revokeSession = async (
  { config, jwt, logger, sessions }: SessionDeps,
  token: string | undefined,
): Promise<void> => {
  const sid = await verifiedSid(config, jwt, token);

  if (!sid) {
    return;
  }

  try {
    const removed = await sessions.del(sessionKey(sid));

    if (removed > 0) {
      logger.log(
        JSON.stringify({ event: "session.revoked", sid: loggedSid(sid) }),
      );
    }
  } catch (error) {
    logger.error(
      JSON.stringify({
        event: "session.revoke.failed",
        sid: loggedSid(sid),
        reason: describeError(error),
      }),
    );
  }
};
