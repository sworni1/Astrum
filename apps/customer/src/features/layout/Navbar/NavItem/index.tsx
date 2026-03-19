import Link from "next/link";
import { ReactElement } from "react";

type Props = {
  icon: ReactElement;
  count?: number;
  href: string;
  loading?: boolean;
};

const NavItem = ({ icon, count, href, loading }: Props) => {
  return (
    <Link href={href} color="foreground">
      <div className="relative inline-flex align-middle">
        {icon}
        {loading
          ? null
          : count !== undefined &&
            count > 0 && (
              <div className="absolute -top-1 -right-1 rounded-full h-2 w-2 bg-red-600" />
            )}
      </div>
    </Link>
  );
};

export default NavItem;
