import { engineInfo } from "./engines";

/** Pastille du moteur (monogramme coloré). */
const EngineIcon = ({ type, size = 32 }: { type: string; size?: number }) => {
  const info = engineInfo(type);
  return (
    <span
      className="engine-icon"
      style={{ width: size, height: size, color: info.color, borderColor: `color-mix(in srgb, ${info.color} 25%, transparent)` }}
      aria-hidden
    >
      {info.short}
    </span>
  );
};

export default EngineIcon;
