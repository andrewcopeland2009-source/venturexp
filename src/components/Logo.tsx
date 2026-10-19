export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="vxp-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#38BDF8" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#vxp-g)" />
      <path d="M17 19h9l6 17 6-17h9L36 46h-8z" fill="#fff" />
      <circle cx="47" cy="45" r="5" fill="#22C55E" />
    </svg>
  );
}

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      <span className="font-display text-xl font-extrabold tracking-tight">
        Venture<span className="text-violet">XP</span>
      </span>
    </div>
  );
}
