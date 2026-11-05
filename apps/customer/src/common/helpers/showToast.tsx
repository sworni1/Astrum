import { toast } from "sonner";

type ToastAction = {
  label: string;
  onClick: () => void;
};

type Props = {
  title: string;
  description?: string;
  type: "error" | "info" | "success" | "warning";
  action?: ToastAction;
};

export const showToast = ({ title, description, type, action }: Props) =>
  toast[type](
    <div>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>,
    action ? { action: { label: action.label, onClick: action.onClick } } : {},
  );
