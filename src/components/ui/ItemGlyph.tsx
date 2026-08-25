import type { CatalogItem } from "@/lib/types";

/** Flat silhouette previews for the shop grid — one per model variant. */
export function ItemGlyph({ item, className = "h-10 w-10" }: { item: CatalogItem; className?: string }) {
  const [a, b] = item.colors;
  const v = item.variant;

  const shape = () => {
    switch (v) {
      case "small":
      case "medium":
        return (
          <>
            <ellipse cx="22" cy="20" rx="11" ry="7" fill={a} />
            <path d="M11 20 L3 14 L4 26 Z" fill={b} />
            <path d="M22 13 L26 8 L28 14 Z" fill={b} />
            <circle cx="27" cy="18" r="1.6" fill="#16222f" />
          </>
        );
      case "tall":
        return (
          <>
            <ellipse cx="21" cy="20" rx="8" ry="10" fill={a} />
            <path d="M21 10 L25 3 L27 11 Z" fill={b} />
            <path d="M21 30 L24 36 L27 29 Z" fill={b} />
            <path d="M13 20 L5 15 L6 25 Z" fill={b} />
            <circle cx="25" cy="17" r="1.6" fill="#16222f" />
          </>
        );
      case "island":
        return (
          <>
            {/* waterline */}
            <path d="M2 27h36" stroke="#7fc9dd" strokeWidth="3" strokeLinecap="round" />
            {/* sandbar */}
            <path d="M8 27c2-7 7-10 12-10s10 3 12 10Z" fill={a} />
            {/* palm */}
            <path d="M20 17V7" stroke="#8d6c4a" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M20 7c-4-3-8-2-9 1M20 7c4-3 8-2 9 1M20 7c-2-4-6-5-8-3M20 7c2-4 6-5 8-3"
              stroke={b} strokeWidth="2.2" strokeLinecap="round" fill="none" />
          </>
        );
      case "seahorse":
        return (
          <>
            <path
              d="M22 7c-5 0-7 4-7 8s3 6 3 10-4 4-4 7c0 2 3 3 5 1"
              fill="none"
              stroke={a}
              strokeWidth="5"
              strokeLinecap="round"
            />
            <path d="M22 7c3 0 5 2 5 4l-5 1Z" fill={b} />
            <circle cx="23" cy="10" r="1.5" fill="#16222f" />
          </>
        );
      case "jelly":
        return (
          <>
            <path d="M9 22a11 11 0 0 1 22 0Z" fill={a} />
            <path d="M13 23c0 6-2 6-2 11M20 23c0 7 2 7 2 12M27 23c0 6 2 6 2 10" stroke={b} strokeWidth="2" fill="none" strokeLinecap="round" />
          </>
        );
      case "ray":
        return (
          <>
            <path d="M20 10c9 0 16 6 16 11 0 3-6 1-16 1S4 24 4 21c0-5 7-11 16-11Z" fill={a} />
            <path d="M20 22c0 6 1 10 1 13" stroke={b} strokeWidth="2" strokeLinecap="round" fill="none" />
            <circle cx="16" cy="16" r="1.5" fill="#16222f" />
            <circle cx="24" cy="16" r="1.5" fill="#16222f" />
          </>
        );
      case "grass":
        return (
          <>
            {[8, 15, 22, 29].map((x, i) => (
              <path
                key={x}
                d={`M${x} 34 C ${x + (i % 2 ? 4 : -4)} 26, ${x} 22, ${x + (i % 2 ? -2 : 2)} 17`}
                stroke={i % 2 ? b : a}
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
              />
            ))}
          </>
        );
      case "kelp":
        return (
          <>
            {[12, 20, 28].map((x, i) => (
              <path
                key={x}
                d={`M${x} 36 C ${x + (i % 2 ? 7 : -7)} 26, ${x - (i % 2 ? 6 : -6)} 16, ${x + (i % 2 ? 3 : -3)} 5`}
                stroke={i % 2 ? b : a}
                strokeWidth="3.4"
                fill="none"
                strokeLinecap="round"
              />
            ))}
          </>
        );
      case "fan":
        return (
          <>
            <path d="M20 34 L20 22" stroke={a} strokeWidth="3" strokeLinecap="round" />
            <path d="M6 22a14 14 0 0 1 28 0Z" fill={b} />
            <path d="M11 22a9 9 0 0 1 18 0Z" fill={a} />
          </>
        );
      case "anemone":
        return (
          <>
            <ellipse cx="20" cy="30" rx="9" ry="5" fill={a} />
            {[-3, -1.5, 0, 1.5, 3].map((k, i) => (
              <path
                key={i}
                d={`M${20 + k * 3} 28 C ${20 + k * 5} 22, ${20 + k * 6} 18, ${20 + k * 6} 13`}
                stroke={b}
                strokeWidth="2.6"
                fill="none"
                strokeLinecap="round"
              />
            ))}
          </>
        );
      case "pebbles":
        return (
          <>
            <ellipse cx="13" cy="28" rx="8" ry="6" fill={a} />
            <ellipse cx="26" cy="30" rx="6" ry="4.5" fill={b} />
            <ellipse cx="21" cy="22" rx="5" ry="4" fill={b} />
          </>
        );
      case "boulder":
        return (
          <>
            <path d="M6 31 L11 15 L26 11 L34 26 L31 31 Z" fill={a} />
            <path d="M26 11 L34 26 L27 27 Z" fill={b} />
          </>
        );
      case "stack":
        return (
          <>
            <ellipse cx="20" cy="30" rx="13" ry="4" fill={a} />
            <ellipse cx="20" cy="24" rx="10" ry="3.4" fill={b} />
            <ellipse cx="20" cy="19" rx="7" ry="2.8" fill={a} />
            <ellipse cx="20" cy="15" rx="4.5" ry="2.2" fill={b} />
          </>
        );
      case "arch":
        return (
          <>
            <path d="M7 32 V22a13 13 0 0 1 26 0v10h-6V23a7 7 0 0 0-14 0v9Z" fill={a} />
            <ellipse cx="9" cy="32" rx="5" ry="3" fill={b} />
            <ellipse cx="31" cy="32" rx="5" ry="3" fill={b} />
          </>
        );
      case "brain":
        return (
          <>
            <path d="M6 30a14 12 0 0 1 28 0Z" fill={a} />
            <path d="M11 27c2-3 6-3 8 0M22 25c2-3 6-2 7 1" stroke={b} strokeWidth="2" fill="none" strokeLinecap="round" />
          </>
        );
      case "staghorn":
        return (
          <>
            <path d="M20 33V20M20 24l-7-7M20 22l7-8M13 17l-2-6M27 14l3-5" stroke={a} strokeWidth="3.2" fill="none" strokeLinecap="round" />
            <circle cx="11" cy="10" r="2.4" fill={b} />
            <circle cx="30" cy="8" r="2.4" fill={b} />
          </>
        );
      case "bubble":
        return (
          <>
            <circle cx="14" cy="27" r="6" fill={a} />
            <circle cx="25" cy="29" r="5" fill={b} />
            <circle cx="21" cy="19" r="5.5" fill={b} />
            <circle cx="30" cy="21" r="3.5" fill={a} />
          </>
        );
      case "tube":
        return (
          <>
            {[11, 19, 27].map((x, i) => (
              <g key={x}>
                <rect x={x - 2} y={16 + i * 3} width="4.5" height={18 - i * 3} rx="2" fill={a} />
                <circle cx={x + 0.2} cy={16 + i * 3} r="3" fill={b} />
              </g>
            ))}
          </>
        );
      case "chest":
        return (
          <>
            <rect x="8" y="20" width="24" height="12" rx="2" fill={a} />
            <path d="M8 20a12 6 0 0 1 24 0Z" fill={a} />
            <rect x="8" y="19" width="24" height="3" fill={b} />
            <rect x="18" y="22" width="4" height="5" rx="1" fill={b} />
          </>
        );
      case "amphora":
        return (
          <>
            <ellipse cx="20" cy="25" rx="9" ry="9" fill={a} />
            <rect x="16" y="8" width="8" height="10" rx="3" fill={a} />
            <rect x="14" y="6" width="12" height="4" rx="2" fill={b} />
          </>
        );
      case "wreck":
        return (
          <>
            <path d="M5 22h30l-5 9H10Z" fill={a} />
            <rect x="4" y="19" width="32" height="3.5" rx="1.5" fill={b} />
            <rect x="18" y="6" width="2.5" height="13" fill={b} />
            <path d="M21 8l8 4-8 4Z" fill={a} />
          </>
        );
      case "sand":
        return (
          <>
            <rect x="4" y="18" width="32" height="14" rx="3" fill={b} />
            <path d="M4 21c6-3 10 1 16-1s10-3 16 0v-1a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3Z" fill={a} />
            <rect x="4" y="18" width="32" height="4" fill={a} />
          </>
        );
      default:
        return <circle cx="20" cy="20" r="10" fill={a} />;
    }
  };

  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      {shape()}
    </svg>
  );
}
