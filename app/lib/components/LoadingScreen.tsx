import dynamic from "next/dynamic";
import loadingAnimation from "../../../public/animations/loading.json";

// Dynamic import for Lottie to avoid SSR issues
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

export default function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#fdf9f6]">
      <div className="h-[250px] w-[250px] max-[768px]:h-[200px] max-[768px]:w-[200px]">
        <Lottie animationData={loadingAnimation} />
      </div>
    </div>
  );
}
