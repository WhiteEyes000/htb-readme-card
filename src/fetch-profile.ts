import https from "node:https";

import * as cheerio from "cheerio";

import type { HtbCertification, HtbProfile } from "./types.js";

const HTB_PROFILE_BASE = "https://profile.hackthebox.com";

const USER_AGENT =
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:150.0) Gecko/20100101 Firefox/150.0";

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

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractProfileUuid(value: string): string {
  const match = value.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  );

  if (!match) {
    throw new Error(`Could not find HTB profile UUID in: ${value}`);
  }

  return match[0];
}

function extractIdentityFromHtml(html: string): ProfileIdentity {
  const match = html.match(
    /"id":\d+,"account_id":\d+,"name":\d+,"full_name":\d+[^]*?"([0-9a-f-]{36})","([0-9a-f-]{36})","([^"]+)","([^"]+)"[^]*?"(https:\\u002F\\u002F[^"]+avatar\.png)","(https:\\u002F\\u002F[^"]+avatar_thumb\.png)"/i
  );

  if (!match) {
    throw new Error("Could not extract HTB identity block");
  }

  return {
    profileUuid: match[1],
    accountUuid: match[2],
    username: match[3],
    fullName: match[4],
    avatar: match[5].replaceAll("\\u002F", "/"),
    avatarThumb: match[6].replaceAll("\\u002F", "/"),
  };
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

function extractCertificationsFromHtml(html: string): HtbCertification[] {
  const $ = cheerio.load(html);

  return $("li.internal-certification, .internal-certification")
    .map((_, element): HtbCertification | null => {
      const $element = $(element);
      const svg =
        $element.find(".icon-container svg").first().toString() ||
        $element.find("svg").first().toString();

      if (!svg) {
        return null;
      }

      const fullText = clean($element.text());
      const code = clean(fullText.match(/HTB[A-Z0-9-]+/i)?.[0] ?? "");
      const date =
        clean(fullText.match(/\d{1,2}\s+[A-Za-z]+\s+\d{4}/)?.[0] ?? "") ||
        clean(fullText.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? "");
      const name =
        clean(
          $element
            .find(
              ".htb-font-size-16, .htb-font-weight-500, .htb-text-white, h3, h4, h5, h6"
            )
            .first()
            .text()
        ) || clean(fullText.replace(code, "").replace(date, ""));

      return {
        name,
        code,
        date,
        verified: true,
        svg,
      };
    })
    .get()
    .filter((cert): cert is HtbCertification => Boolean(cert));
}

export async function fetchProfile(
  profileUrlOrUuid: string
): Promise<HtbProfile> {
  const profileUuid = extractProfileUuid(profileUrlOrUuid);
  const htmlUrl = `${HTB_PROFILE_BASE}/profile/${profileUuid}`;

  const { body: html, cookie } = await fetchTextWithCookie(htmlUrl, {
    accept: "text/html,application/xhtml+xml",
  });

  const identity = extractIdentityFromHtml(html);
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
    certifications: extractCertificationsFromHtml(html),
  };
}
