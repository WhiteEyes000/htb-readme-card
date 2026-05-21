import type { HtbCertification } from "./types.js";

function prepareInlineSvg(svg: string, size: number): string {
  return svg
    .replace(/\swidth="[^"]*"/, "")
    .replace(/\sheight="[^"]*"/, "")
    .replace("<svg", `<svg width="${size}" height="${size}"`);
}

export function renderCerts(
  certifications: HtbCertification[],
  x: number,
  y: number,
  size = 34,
  gap = 10
): string {
  return certifications
    .filter((cert) => cert.svg)
    .map((cert, index) => {
      const certX = x + index * (size + gap);
      const svg = prepareInlineSvg(cert.svg!, size);

      return `
<g transform="translate(${certX} ${y})">
  ${svg}
</g>`;
    })
    .join("\n");
}
