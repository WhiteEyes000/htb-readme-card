type SketchifyOptions = {
  seed?: number;
  stroke?: string;
};

function jitter(index: number, amount: number): string {
  const value = Math.sin(index * 12.9898) * 43758.5453;
  const normalized = value - Math.floor(value);

  return ((normalized - 0.5) * amount).toFixed(2);
}

export function sketchify(
  svg: string,
  options: SketchifyOptions = {}
): string {
  const seed = options.seed ?? 8;
  const stroke = options.stroke ?? "#111827";
  const pathRegex = /<path\b[^>]*\sd="([^"]+)"[^>]*>/g;

  const outlinePaths = [...svg.matchAll(pathRegex)]
    .map((match, index) => {
      const d = match[1];
      const mainOpacity = index % 3 === 0 ? 0.38 : 0.26;
      const secondOpacity = index % 4 === 0 ? 0.22 : 0.14;

      return `
        <path d="${d}" stroke="${stroke}" stroke-width="1.25" opacity="${mainOpacity}" />
        <path d="${d}" stroke="${stroke}" stroke-width="0.65" opacity="${secondOpacity}" transform="translate(${jitter(
          index,
          0.55
        )} ${jitter(index + 7, 0.55)})" />
      `;
    })
    .join("\n");

  const sketchLayer = `
  <defs>
    <filter id="sketch-jitter-${seed}">
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.026"
        numOctaves="2"
        seed="${seed}"
        result="noise"
      />
      <feDisplacementMap
        in="SourceGraphic"
        in2="noise"
        scale="0.55"
        xChannelSelector="R"
        yChannelSelector="G"
      />
    </filter>
  </defs>

  <g
    filter="url(#sketch-jitter-${seed})"
    fill="none"
    stroke-linecap="round"
    stroke-linejoin="round"
    pointer-events="none"
  >
    ${outlinePaths}
  </g>

  <g
    stroke="${stroke}"
    stroke-width="0.65"
    stroke-linecap="round"
    opacity="0.16"
    fill="none"
    pointer-events="none"
  >
    <path d="M44 101 L92 145" />
    <path d="M54 102 L96 150" />
    <path d="M145 101 L106 143" />
    <path d="M154 100 L107 153" />

    <path d="M72 79 L93 91" />
    <path d="M82 86 L98 96" />
    <path d="M128 79 L107 91" />
    <path d="M118 86 L102 96" />
  </g>
`;

  return svg.replace("</svg>", `${sketchLayer}\n</svg>`);
}
