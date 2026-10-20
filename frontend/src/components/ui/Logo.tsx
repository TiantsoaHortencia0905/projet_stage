/** Marque ArchiCloud : trois couches (stockage, données, déploiement). */
export const LogoMark = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
    <rect width="32" height="32" rx="8" fill="var(--accent)" />
    <rect x="7" y="8" width="18" height="4" rx="2" fill="#fff" fillOpacity=".55" />
    <rect x="7" y="14" width="18" height="4" rx="2" fill="#fff" fillOpacity=".8" />
    <rect x="7" y="20" width="18" height="4" rx="2" fill="#fff" />
  </svg>
);

const Logo = ({ size = 28 }: { size?: number }) => (
  <span className="logo">
    <LogoMark size={size} />
    <span className="logo-text">ArchiCloud</span>
  </span>
);

export default Logo;
