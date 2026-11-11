import { Loader2 } from "lucide-react";

/** The screen before the order answers: nothing to read yet. */
const LoadingScreen = () => (
  <div className="min-h-screen flex justify-center items-center">
    <Loader2 className="h-8 w-8 animate-spin" />
  </div>
);

export default LoadingScreen;
