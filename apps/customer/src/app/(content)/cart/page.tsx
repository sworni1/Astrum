import { readSessionUserId } from "@/common/helpers/session";
import Cart from "@/features/pages/Cart";

const page = async () => {
  const guest = (await readSessionUserId()) === null;

  return <Cart guest={guest} />;
};

export default page;
