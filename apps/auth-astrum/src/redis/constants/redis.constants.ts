export const SESSION_TTL_SECONDS = 86_400;

export const SESSION_KEY_PREFIX = "session:";

export const LOGGED_SID_LENGTH = 8;

export const REDIS_URL_VARIABLE = "REDIS_URL";

export const REDIS_COMMAND_TIMEOUT_MS = 1_000;

export const REDIS_MAX_RETRIES_PER_REQUEST = 1;

export const REDIS_CLIENT_OPTIONS = {
  commandTimeout: REDIS_COMMAND_TIMEOUT_MS,
  enableOfflineQueue: false,
  maxRetriesPerRequest: REDIS_MAX_RETRIES_PER_REQUEST,
};

export const INCREMENT_WITH_TTL_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
return count
`;
