import type { ReactNode } from "react";
import { LuCircleAlert, LuCircleCheck, LuInfo, LuTriangleAlert } from "react-icons/lu";

const ICONS = {
  info: <LuInfo size={16} />,
  warning: <LuTriangleAlert size={16} />,
  danger: <LuCircleAlert size={16} />,
  success: <LuCircleCheck size={16} />,
};

interface CalloutProps {
  tone?: keyof typeof ICONS;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}

const Callout = ({ tone = "info", title, children, action, icon }: CalloutProps) => (
  <div className={`callout callout-${tone}`} role={tone === "danger" ? "alert" : undefined}>
    <span className="callout-icon">{icon ?? ICONS[tone]}</span>
    <div className="callout-body">
      {title && <p className="callout-title">{title}</p>}
      {children && <div>{children}</div>}
    </div>
    {action}
  </div>
);

export default Callout;
