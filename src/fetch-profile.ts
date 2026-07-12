import https from "node:https";

import type { HtbCertification, HtbProfile } from "./types.js";

const HTB_PROFILE_BASE = "https://profile.hackthebox.com";

const USER_AGENT =
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:150.0) Gecko/20100101 Firefox/150.0";

const PROFILE_SCHEMA_KEYS = [
  "id",
  "account_id",
  "name",
  "full_name",
  "avatar",
  "avatar_thumb",
] as const;

type AnyRecord = Record<string, unknown>;

type FetchResult = {
  body: string;
  cookie: string;
};

type ProfileIdentity = {
  profileUuid: string;
  accountUuid: string;
  username: string;
  fullName: string;
  avatar: string;
  avatarThumb: string;
};

type HtbExperienceResponse = {
  level: number;
  levelTitle: string;
  levelGrade: string;
  levelExperiencePoints: number;
  experienceUntilNextLevel: number;
};

function extractProfileUuid(value: string): string {
  const match = value.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  );

  if (!match) {
    throw new Error(`Could not find HTB profile UUID in: ${value}`);
  }

  return match[0];
}

function parseNuxtPayload(html: string): unknown[] | null {
  const match = html.match(
    /<script[^>]*>\s*(\[[\s\S]*?\])\s*<\/script>/
  );

  if (!match) {
    return null;
  }

  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function resolveNuxtRef(data: unknown[], ref: unknown): unknown {
  if (typeof ref === "number" && ref >= 0 && ref < data.length) {
    const resolved = data[ref];

    if (Array.isArray(resolved) && resolved.length === 2 && typeof resolved[0] === "string") {
      return resolveNuxtRef(data, resolved[1]);
    }

    if (resolved && typeof resolved === "object" && !Array.isArray(resolved)) {
      return resolveNuxtObject(data, resolved as AnyRecord);
    }

    return resolved;
  }

  if (Array.isArray(ref)) {
    return ref.map((item) => resolveNuxtRef(data, item));
  }

  return ref;
}

function resolveNuxtObject(data: unknown[], obj: AnyRecord): AnyRecord {
  const result: AnyRecord = {};

  for (const [key, value] of Object.entries(obj)) {
    result[key] = resolveNuxtRef(data, value);
  }

  return result;
}

function isProfileSchema(obj: unknown): obj is AnyRecord {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return false;
  }

  return PROFILE_SCHEMA_KEYS.every((key) => key in obj);
}

function findProfileSchema(payload: unknown[]): AnyRecord | null {
  for (const item of payload) {
    if (isProfileSchema(item)) {
      return item;
    }
  }

  return null;
}

function extractIdentityFromPayload(payload: unknown[]): ProfileIdentity {
  const schema = findProfileSchema(payload);

  if (!schema) {
    throw new Error("Could not find profile schema in Nuxt payload");
  }

  const profile = resolveNuxtObject(payload, schema);

  const accountUuid = String(profile.account_id ?? "");
  const profileUuid = String(profile.id ?? "");
  const username = String(profile.name ?? "");
  const fullName = String(profile.full_name ?? "");
  const avatar = profile.avatar ? String(profile.avatar) : "";
  const avatarThumb = profile.avatar_thumb ? String(profile.avatar_thumb) : "";

  if (!accountUuid || !username) {
    throw new Error("Could not extract HTB identity from Nuxt payload");
  }

  return { profileUuid, accountUuid, username, fullName, avatar, avatarThumb };
}

function extractCertificationsFromPayload(
  payload: unknown[]
): HtbCertification[] {
  const dataMap = payload[3];

  if (!dataMap || typeof dataMap !== "object" || Array.isArray(dataMap)) {
    return [];
  }

  const certIndex = (dataMap as AnyRecord)["$sprofile-internal-certifications"];

  if (typeof certIndex !== "number" || certIndex >= payload.length) {
    return [];
  }

  const certList = resolveNuxtRef(payload, certIndex);

  if (!Array.isArray(certList) || certList.length === 0) {
    return [];
  }

  return certList
    .map((item): HtbCertification | null => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const cert = item as AnyRecord;
      const name = String(cert.name ?? "");
      const code = String(cert.code ?? cert.id ?? "");
      const date = String(cert.awarded_at ?? cert.date ?? "");
      const svg = cert.svg ? String(cert.svg) : undefined;

      return {
        name,
        code,
        date: date.split("T")[0],
        verified: true,
        svg,
      };
    })
    .filter((cert): cert is HtbCertification => cert !== null);
}

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as AnyRecord)
    : {};
}

function pickExperiencePayload(response: unknown): HtbExperienceResponse {
  const root = asRecord(response);
  const data = asRecord(root.data);
  const payload = Object.keys(data).length > 0 ? data : root;

  return payload as unknown as HtbExperienceResponse;
}

function fetchTextWithCookie(
  url: string,
  headers: Record<string, string> = {}
): Promise<FetchResult> {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            "user-agent": USER_AGENT,
            ...headers,
          },
        },
        (response) => {
          const statusCode = response.statusCode ?? 0;

          if (statusCode < 200 || statusCode >= 300) {
            reject(new Error(`Failed to fetch ${url}: ${statusCode}`));
            response.resume();
            return;
          }

          const cookie = (response.headers["set-cookie"] ?? [])
            .map((value) => value.split(";")[0])
            .join("; ");

          let body = "";

          response.setEncoding("utf8");

          response.on("data", (chunk) => {
            body += chunk;
          });

          response.on("end", () => {
            resolve({ body, cookie });
          });
        }
      )
      .on("error", reject);
  });
}

export async function fetchProfile(
  profileUrlOrUuid: string
): Promise<HtbProfile> {
  const profileUuid = extractProfileUuid(profileUrlOrUuid);
  const htmlUrl = `${HTB_PROFILE_BASE}/profile/${profileUuid}`;

  const { body: html, cookie } = await fetchTextWithCookie(htmlUrl, {
    accept: "text/html,application/xhtml+xml",
  });

  const payload = parseNuxtPayload(html);

  if (!payload) {
    throw new Error("Could not parse Nuxt payload from profile page");
  }

  const identity = extractIdentityFromPayload(payload);
  const experienceUrl = `${HTB_PROFILE_BASE}/api/experience/v1/account/${identity.accountUuid}`;

  const { body: jsonText } = await fetchTextWithCookie(experienceUrl, {
    accept: "application/json",
    referer: htmlUrl,
    ...(cookie ? { cookie } : {}),
  });

  const experience = pickExperiencePayload(JSON.parse(jsonText));
  const xpCurrent = experience.levelExperiencePoints ?? 0;
  const xpNext = xpCurrent + (experience.experienceUntilNextLevel ?? 0);

  return {
    username: identity.fullName,
    handle: identity.username,
    avatar: identity.avatarThumb || identity.avatar,
    country: "",
    level: experience.level ?? 0,
    xpCurrent,
    xpNext,
    rank: experience.levelTitle ?? "Beginner",
    grade: experience.levelGrade ?? "1",
    certifications: extractCertificationsFromPayload(payload),
  };
}
