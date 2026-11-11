import OrderPage from "@/features/pages/Orders/OrderPage";

type Props = {
  params: Promise<{
    orderId: string;
  }>;
};

const page = async ({ params }: Props) => {
  const { orderId } = await params;
  return <OrderPage orderId={orderId} />;
};

export default page;
