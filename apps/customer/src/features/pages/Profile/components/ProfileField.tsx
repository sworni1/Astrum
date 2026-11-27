import type { ReactNode } from "react";
import {
  FIELD,
  FIELD_HINT,
  FIELD_LABEL,
} from "@/features/pages/Profile/lib/styles";

type Props = {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
};

const ProfileField = ({ label, htmlFor, hint, children }: Props) => (
  <div className={FIELD}>
    <label className={FIELD_LABEL} htmlFor={htmlFor}>
      {label}
    </label>
    {children}
    {hint === undefined ? null : <p className={FIELD_HINT}>{hint}</p>}
  </div>
);

export default ProfileField;
