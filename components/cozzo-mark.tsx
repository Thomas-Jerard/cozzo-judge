export function CozzoMark({ size = 28 }: { size?: number }) {
  const id = `cozzo-mark-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8B5CF6" />
          <stop offset=".5" stopColor="#6D28D9" />
          <stop offset="1" stopColor="#4F46E5" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#${id})`} />
      <path
        d="M27.6 13.4A10 10 0 1 0 27.6 26.6"
        fill="none"
        stroke="#fff"
        strokeWidth="4.2"
        strokeLinecap="round"
      />
      <path
        d="M23.4 17.2a4.6 4.6 0 1 0 0 5.6"
        fill="none"
        stroke="#fff"
        strokeOpacity=".55"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
