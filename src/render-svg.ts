import https from "node:https";

import rough from "roughjs";
import { createSVGWindow } from "svgdom";

import { renderCerts } from "./render-certs.js";
import { renderRankIcon } from "./render-rank.js";

import type { HtbRank } from "./ranks.js";
import type { HtbProfile } from "./types.js";

const HTB_LOGO_URL =
  "https://www.hackthebox.com/hubfs/raw_assets/HackTheBox/44/js_client_assets/assets/nav-logo-3JkQrnNl.svg";

const COLORS = {
  bg: "#0b121f",
  card: "#111927",
  panel: "#151f2e",
  panelAlt: "#1a2332",
  border: "#2f3b52",
  text: "#e6edf3",
  muted: "#a4b1cd",
  subtle: "#6b7894",
  green: "#9fef00",
  progressBg: "#263247",
};

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function imageUrlToDataUri(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        const chunks: Buffer[] = [];

        response.on("data", (chunk) => {
          chunks.push(chunk);
        });

        response.on("end", () => {
          const buffer = Buffer.concat(chunks);
          const contentType = response.headers["content-type"] || "image/png";
          const base64 = buffer.toString("base64");

          resolve(`data:${contentType};base64,${base64}`);
        });
      })
      .on("error", reject);
  });
}

function normalizeRank(rank: string): HtbRank {
  return rank.toLowerCase().replaceAll(" ", "") as HtbRank;
}

function text(
  x: number,
  y: number,
  value: string,
  size = 16,
  weight = 400,
  color = COLORS.text
): string {
  return `
<text
  x="${x}"
  y="${y}"
  font-family="'Inter', 'Segoe UI', system-ui, sans-serif"
  font-size="${size}"
  font-weight="${weight}"
  fill="${color}"
>
  ${escapeXml(value)}
</text>`;
}

function diamond(x: number, y: number, size = 14, color = COLORS.green): string {
  const half = size / 2;

  return `
<polygon
  points="${x},${y - half} ${x + half},${y} ${x},${y + half} ${x - half},${y}"
  fill="${color}"
  stroke="${COLORS.green}"
  stroke-width="1.4"
/>`;
}

function renderGradeDiamonds(
  grade: string | number,
  x: number,
  y: number
): string {
  const count = Math.max(1, Math.min(5, Number(grade) || 1));

  return Array.from({ length: count }, (_, index) =>
    diamond(x + index * 34, y, 22)
  ).join("\n");
}

async function renderAvatar(profile: HtbProfile): Promise<string> {
  if (!profile.avatar) {
    return "";
  }

  const avatarDataUri = await imageUrlToDataUri(profile.avatar);

  return `
<defs>
  <clipPath id="avatarClip">
    <circle cx="86" cy="86" r="30" />
  </clipPath>
</defs>

<circle
  cx="86"
  cy="86"
  r="34"
  fill="${COLORS.green}"
  opacity="0.18"
/>

<image
  href="${avatarDataUri}"
  x="56"
  y="56"
  width="60"
  height="60"
  clip-path="url(#avatarClip)"
  preserveAspectRatio="xMidYMid slice"
/>

<circle
  cx="86"
  cy="86"
  r="31"
  fill="none"
  stroke="${COLORS.green}"
  stroke-width="2"
/>`;
}

async function renderHtbLogo(): Promise<string> {
  const logoDataUri = await imageUrlToDataUri(HTB_LOGO_URL);

  return `
<image
  href="${logoDataUri}"
  x="620"
  y="62"
  width="160"
  height="42"
  preserveAspectRatio="xMidYMid meet"
/>`;
}

export async function renderSvg(profile: HtbProfile): Promise<string> {
  const width = 860;
  const height = 470;

  const window = createSVGWindow();
  const document = window.document;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const roughApi = "default" in rough ? rough.default : rough;
  const rc = roughApi.svg(svg);

  svg.appendChild(
    rc.rectangle(16, 16, width - 32, height - 32, {
      roughness: 1.4,
      bowing: 1,
      stroke: COLORS.border,
      strokeWidth: 2,
      fill: COLORS.card,
      fillStyle: "solid",
    })
  );

  svg.appendChild(
    rc.rectangle(42, 42, 776, 88, {
      roughness: 1.5,
      bowing: 1,
      stroke: COLORS.border,
      strokeWidth: 2,
      fill: COLORS.panel,
      fillStyle: "solid",
    })
  );

  svg.appendChild(
    rc.rectangle(42, 154, 360, 190, {
      roughness: 1.8,
      bowing: 1.2,
      stroke: COLORS.border,
      strokeWidth: 2,
      fill: COLORS.panelAlt,
      fillStyle: "solid",
    })
  );

  svg.appendChild(
    rc.rectangle(430, 154, 388, 190, {
      roughness: 1.6,
      bowing: 1.1,
      stroke: COLORS.border,
      strokeWidth: 2,
      fill: COLORS.panelAlt,
      fillStyle: "solid",
    })
  );

  const certsSvg = renderCerts(profile.certifications, 190, 368, 34, 10);
  const hasCertifications = certsSvg.length > 0;

  if (hasCertifications) {
    svg.appendChild(
      rc.rectangle(42, 360, 776, 48, {
        roughness: 1.5,
        bowing: 1,
        stroke: COLORS.border,
        strokeWidth: 1.5,
        fill: COLORS.panel,
        fillStyle: "solid",
      })
    );
  }

  svg.appendChild(
    rc.rectangle(42, 420, 776, 32, {
      roughness: 1.5,
      bowing: 1,
      stroke: COLORS.border,
      strokeWidth: 1.5,
      fill: COLORS.panel,
      fillStyle: "solid",
    })
  );

  const progress = Math.max(
    0,
    Math.min(1, profile.xpNext > 0 ? profile.xpCurrent / profile.xpNext : 0)
  );

  const progressBarX = 470;
  const progressBarY = 248;
  const progressBarWidth = 300;
  const progressWidth = Math.round(progressBarWidth * progress);

  svg.appendChild(
    rc.rectangle(progressBarX, progressBarY, progressBarWidth, 18, {
      roughness: 1.1,
      stroke: COLORS.border,
      strokeWidth: 1.5,
      fill: COLORS.progressBg,
      fillStyle: "solid",
    })
  );

  svg.appendChild(
    rc.rectangle(progressBarX, progressBarY, progressWidth, 18, {
      roughness: 1.1,
      stroke: COLORS.green,
      strokeWidth: 1.5,
      fill: COLORS.green,
      fillStyle: "solid",
    })
  );

  const rankIcon = await renderRankIcon(normalizeRank(profile.rank), 150);
  const avatarSvg = await renderAvatar(profile);
  const htbLogoSvg = await renderHtbLogo();
  return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${width}"
  height="${height}"
  viewBox="0 0 ${width} ${height}"
>
  <rect width="100%" height="100%" fill="transparent" />

  ${svg.innerHTML}

  ${avatarSvg}

  ${htbLogoSvg}

  ${text(profile.avatar ? 132 : 68, 84, profile.username, 34, 700)}

  ${text(
    profile.avatar ? 134 : 70,
    114,
    profile.country
      ? `@${profile.handle} · ${profile.country}`
      : `@${profile.handle}`,
    17,
    400,
    COLORS.muted
  )}

  <g transform="translate(68 182)">
    ${rankIcon}
  </g>

  ${text(235, 212, profile.rank, 34, 700)}

  ${text(237, 246, "Grade", 20, 500, COLORS.muted)}

  ${renderGradeDiamonds(profile.grade, 252, 280)}

  ${text(237, 326, `Level ${profile.level}`, 30, 700, COLORS.green)}

  ${text(470, 204, "Level XP", 28, 700)}

  ${text(
    470,
    234,
    `${profile.xpCurrent.toLocaleString()} / ${profile.xpNext.toLocaleString()} XP`,
    18,
    500,
    COLORS.muted
  )}

  ${
    hasCertifications
      ? `
  ${text(68, 391, "Certifications", 16, 700, COLORS.muted)}

  ${certsSvg}
`
      : ""
  }

  ${text(
    68,
    442,
    "Generated with jjimenezgarcia/htb-profile-card",
    15,
    400,
    COLORS.subtle
  )}
</svg>
`.trim();
}
