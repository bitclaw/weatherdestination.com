export const IconBitbucket = ({ className }: { className?: string }) => (
  <svg
    aria-label="bitbucket"
    className={className}
    viewBox="-2 -2 65 59"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient
        id="bb-gradient"
        x1="104.953%"
        x2="46.569%"
        y1="21.921%"
        y2="75.234%"
      >
        <stop offset="7%" stopColor="currentColor" stopOpacity=".4" />
        <stop offset="100%" stopColor="currentColor" />
      </linearGradient>
    </defs>
    <path
      d="M59.696 18.86h-18.77l-3.15 18.39h-13L9.426 55.47a2.71 2.71 0 001.75.66h40.74a2 2 0 002-1.68l5.78-35.59z"
      fill="url(#bb-gradient)"
      fillRule="nonzero"
      transform="translate(-.026 .82)"
    />
    <path
      d="M2 .82a2 2 0 00-2 2.32l8.49 51.54a2.7 2.7 0 00.91 1.61 2.71 2.71 0 001.75.66l15.76-18.88H24.7l-3.47-18.39h38.44l2.7-16.53a2 2 0 00-2-2.32L2 .82z"
      fill="currentColor"
      fillRule="nonzero"
    />
  </svg>
);
