interface PickIconProps {
  className?: string;
  gColor?: string;
}

export const PickIcon = ({ className = "w-6 h-6", gColor = "#0ea5e9" }: PickIconProps) => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Guitar pick shape */}
    <path
      d="M32 10 C42 10, 52 18, 52 28 C52 38, 42 54, 32 56 C22 54, 12 38, 12 28 C12 18, 22 10, 32 10Z"
      fill="currentColor"
    />
    {/* G inside */}
    <path
      d="M32 22 C27 22, 24 26, 24 31 C24 36, 27 40, 32 40 C35 40, 37 38, 37 36 L32 36 L32 32 L40 32 L40 38 C40 43, 36 46, 32 46 C25 46, 20 41, 20 31 C20 21, 26 16, 32 16 C37 16, 40 18, 42 22 L38 25 C37 23, 35 22, 32 22Z"
      fill={gColor}
    />
  </svg>
);
