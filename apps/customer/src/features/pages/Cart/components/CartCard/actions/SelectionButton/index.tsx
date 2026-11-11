import { PackageMinus, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  onSelectionChange?: (checked: boolean) => void;
  isSelected: boolean;
};

const SelectionButton = ({ onSelectionChange, isSelected }: Props) => {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => onSelectionChange?.(!isSelected)}
    >
      {isSelected ? (
        <PackageMinus className="h-4 w-4" />
      ) : (
        <PackagePlus className="h-4 w-4" />
      )}
    </Button>
  );
};

export default SelectionButton;
