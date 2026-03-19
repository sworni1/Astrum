import { toast } from "sonner";

type Props = {
  title: string;
  description?: string;
  type: "error" | "info" | "success" | "warning";
};

export const showToast = ({ title, description, type }: Props) =>
  toast[type](
    <div>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>,
  );
