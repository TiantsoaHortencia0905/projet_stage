import { useState, type InputHTMLAttributes } from "react";
import { LuEye, LuEyeOff } from "react-icons/lu";
import Button from "./Button";

/** Champ mot de passe avec bouton afficher/masquer. Les attributs (id, aria-*) vont sur l'input. */
const PasswordInput = (props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="input-group">
      <input {...props} className="input" type={visible ? "text" : "password"} />
      <span className="input-addon">
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          onClick={() => setVisible((v) => !v)}
          icon={visible ? <LuEyeOff size={16} /> : <LuEye size={16} />}
        />
      </span>
    </div>
  );
};

export default PasswordInput;
