'use client';

import { Loader2, Minus, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { showToast } from '@/common/helpers/showToast';
import { Button } from '@/components/ui/button';
import { useAddProductToCart } from '@/hooks/product/useCart/useAddProductToCart';
import { useChangeProductCartQuantity } from '@/hooks/product/useCart/useChangeProductCartQuantity';
import { useDeleteProductFromCart } from '@/hooks/product/useCart/useDeleteProductFromCart';
import { type StepperSize, stepperWidth } from './lib/styles';

type Props = {
  isOutOfStock: boolean;
  productId: string;
  quantity: number;
  quantityInCart: number;
  size?: StepperSize;
  allowAdd?: boolean;
};

const AddToCartWithQuantity = ({
  productId,
  quantity,
  quantityInCart,
  isOutOfStock,
  size = 'full',
  allowAdd = true,
}: Props) => {
  const t = useTranslations('cart');
  const widthClass = stepperWidth({ size });

  const { addProductToCartTrigger } = useAddProductToCart();
  const { changeProductCartQuantityTrigger } =
    useChangeProductCartQuantity(productId);
  const { deleteProductFromCartTrigger } = useDeleteProductFromCart(productId);

  const [localQuantity, setLocalQuantity] = useState(quantityInCart || 0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLocalQuantity(quantityInCart);
  }, [quantityInCart]);

  const handleAddToCart = async () => {
    try {
      setLoading(true);
      const res = await addProductToCartTrigger({ productId });
      setLocalQuantity(res.quantityInCart);
    } catch (error) {
      console.error('addToCart error', error);
      showToast({ title: t('addFailed'), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleMinusProduct = async () => {
    try {
      setLoading(true);
      const newQuantity = localQuantity - 1;
      if (newQuantity > 0) {
        const res = await changeProductCartQuantityTrigger({
          quantity: newQuantity,
        });
        setLocalQuantity(res.quantityInCart);
      } else {
        await deleteProductFromCartTrigger();
        setLocalQuantity(0);
      }
    } catch (error) {
      console.error('minusProduct error', error);
      showToast({ title: t('quantityFailed'), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handlePlusProduct = async () => {
    try {
      setLoading(true);
      const res = await changeProductCartQuantityTrigger({
        quantity: localQuantity + 1,
      });
      setLocalQuantity(res.quantityInCart);
    } catch (error) {
      console.error('plusProduct error', error);
      showToast({ title: t('quantityFailed'), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (!allowAdd && localQuantity === 0) {
    return null;
  }

  if (isOutOfStock) {
    return (
      <div className='flex-1 content-center'>
        <Button
          className={widthClass}
          onClick={handleAddToCart}
          disabled={loading || isOutOfStock}
        >
          Нет в наличии
        </Button>
      </div>
    );
  }

  return (
    <div className='flex-1 content-center'>
      {localQuantity > 0 ? (
        <div
          className={`inline-flex justify-around ${widthClass} items-center`}
        >
          {loading ? (
            <Loader2 className='h-4 w-4 animate-spin' />
          ) : (
            <>
              <Button
                variant='secondary'
                size='icon'
                onClick={handleMinusProduct}
                disabled={loading}
              >
                <Minus className='h-4 w-4' />
              </Button>

              <div className='min-w-[30px] text-center'>{localQuantity}</div>

              <Button
                variant='secondary'
                size='icon'
                onClick={handlePlusProduct}
                disabled={loading || localQuantity >= quantity}
              >
                <Plus className='h-4 w-4' />
              </Button>
            </>
          )}
        </div>
      ) : (
        <Button
          className={widthClass}
          onClick={handleAddToCart}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className='h-4 w-4 animate-spin' />
          ) : (
            t('addToCart')
          )}
        </Button>
      )}
    </div>
  );
};

export default AddToCartWithQuantity;
