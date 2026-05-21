import { RANK_SVG_URLS, type HtbRank } from "./ranks.js";
import { sketchify } from "./sketchify.js";

export async function renderRankIcon(
  rank: HtbRank,
  size = 200
): Promise<string> {
  const response = await fetch(RANK_SVG_URLS[rank]);

  if (!response.ok) {
    throw new Error(`Failed to fetch rank SVG: ${rank}`);
  }

  const svg = (await response.text())
    .replace(/width="[^"]+"/, `width="${size}"`)
    .replace(/height="[^"]+"/, `height="${size}"`);

  return sketchify(svg, {
    seed: rank.length * 13,
  });
}
