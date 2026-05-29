interface Props {
  size?: number;
  className?: string;
}

export function SharprCashIcon({ size = 20, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer coin circle */}
      <circle cx="12" cy="12" r="11" fill="#22c55e" />
      {/* Inner ring */}
      <circle cx="12" cy="12" r="9" fill="none" stroke="#16a34a" strokeWidth="1" />
      {/* S letter */}
      <text
        x="12"
        y="16.5"
        textAnchor="middle"
        fontSize="12"
        fontWeight="900"
        fontFamily="system-ui, -apple-system, sans-serif"
        fill="white"
      >
        S
      </text>
    </svg>
  );
}
