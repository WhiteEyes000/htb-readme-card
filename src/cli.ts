import fs from "node:fs/promises";

import { fetchProfile } from "./fetch-profile.js";
import { renderSvg } from "./render-svg.js";

const profileId = process.argv[2];

if (!profileId) {
  console.error("Usage: npm run generate -- <profile-id>");
  process.exit(1);
}

const profileUrl = profileId.startsWith("http")
  ? profileId
  : `https://profile.hackthebox.com/profile/${profileId}`;

const profile = await fetchProfile(profileUrl);
const svg = await renderSvg(profile);

await fs.mkdir("dist", { recursive: true });

const outputPath = "dist/htb-card.svg";

await fs.writeFile(outputPath, svg);

console.log(`generated ${outputPath}`);
