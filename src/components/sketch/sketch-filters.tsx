export function SketchFilters() {
  return (
    <svg
      style={{ position: "absolute", width: 0, height: 0 }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Turbulence filter for wobbly hand-drawn effect - subtle */}
        <filter id="sketchy" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.02"
            numOctaves="2"
            result="noise"
            seed="2"
          />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1" />
        </filter>

        {/* Medium sketch effect - gentle wobble */}
        <filter
          id="sketchy-medium"
          x="-15%"
          y="-15%"
          width="130%"
          height="130%"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.03"
            numOctaves="3"
            result="noise"
            seed="3"
          />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.5" />
        </filter>

        {/* Heavy sketch effect - noticeable but not extreme */}
        <filter id="sketchy-heavy" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.04"
            numOctaves="3"
            result="noise"
            seed="5"
          />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" />
        </filter>

        {/* Pencil sketch texture */}
        <filter id="pencil-sketch" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="2"
            numOctaves="5"
            result="noise"
          />
          <feDiffuseLighting
            in="noise"
            lightingColor="white"
            surfaceScale="1"
            result="light"
          >
            <feDistantLight azimuth="45" elevation="60" />
          </feDiffuseLighting>
          <feComposite in="SourceGraphic" in2="light" operator="multiply" />
        </filter>

        {/* Rough border path for hand-drawn borders - softened */}
        <filter id="rough-border">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.06 0.03"
            numOctaves="2"
            result="turbulence"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="turbulence"
            scale="1.5"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}
