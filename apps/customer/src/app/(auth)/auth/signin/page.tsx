import { acceptedReturnPath } from "@/common/helpers/returnPath";
import SignIn from "@/features/auth/SignIn";

type PageProps = {
  searchParams: Promise<{ next?: string }>;
};

const page = async ({ searchParams }: PageProps) => {
  const { next } = await searchParams;

  return <SignIn next={acceptedReturnPath(next)} />;
};

export default page;
