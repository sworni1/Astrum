import { Loader2 } from "lucide-react";

const LoadingScreen = () => (
  <div className="min-h-screen flex justify-center items-center">
    <Loader2 className="h-8 w-8 animate-spin" />
  </div>
);

export default LoadingScreen;
