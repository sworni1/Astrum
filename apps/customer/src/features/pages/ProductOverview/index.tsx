'use client';

import { Star } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AddToCartWithQuantity,
  ToggleWishlistItemButton,
} from '../../general/ProductCard/actions';
import ProductGallery from './ProductGallery';
import ProductOverviewSkeleton from '../../../components/skeletons/ProductOverviewSkeleton';
import { getCurrencyEmoji, showToast } from '../../../common';
import { useGetProduct } from '../../../hooks/product/useProducts';
import Reviews from './Reviews';

export default function ProductOverview() {
  const params = useParams<{ productId: string }>();
  const productId = params.productId;

  const { product, productIsLoading, productError } = useGetProduct(productId);
  if (productIsLoading) {
    return <ProductOverviewSkeleton />;
  }

  if (productError) {
    showToast({
      title: 'Error!',
      type: 'error',
      description: 'Failed to load product details',
    });
  }

  return (
    <>
      <div className='container mx-auto px-4 py-8'>
        <div className='grid gap-8 lg:grid-cols-2'>
          <ProductGallery images={product!.images} />
          <div className='flex flex-col gap-4'>
            <h1 className='text-2xl font-bold sm:text-3xl'>{product?.name}</h1>

            <div className='flex items-center gap-4'>
              <span className='text-3xl font-bold'>
                {product?.price} {getCurrencyEmoji(product!.currency)}
              </span>
              <div className='flex items-center gap-1'>
                {Array(5)
                  .fill(null)
                  .map((_, i) => (
                    <Star
                      key={i}
                      className='h-5 w-5 fill-primary text-primary'
                    />
                  ))}
                <Link
                  href='#reviews'
                  className='ml-2 text-sm text-muted-foreground hover:text-primary'
                >
                  ({product?._count ? product?._count.impressions : 0} Reviews)
                </Link>
              </div>
            </div>

            <div className='flex gap-4'>
              <ToggleWishlistItemButton
                productId={productId}
                isWishlisted={product!.isWishlisted}
                size='lg'
              />

              <AddToCartWithQuantity
                quantity={product!.quantity}
                size='sm'
                quantityInCart={product!.quantityInCart}
                productId={productId}
              />
            </div>

            <Separator className='my-4' />

            <div className='space-y-4 text-muted-foreground'>
              <p>{product?.description}</p>
            </div>

            <Accordion type='single' collapsible className='w-full'>
              <AccordionItem value='specifications'>
                <AccordionTrigger>Specifications</AccordionTrigger>
                <AccordionContent>
                  <div className='grid gap-4'>
                    {product?.properties.map((property) => (
                      <div key={property.id} className='grid grid-cols-2'>
                        <span className='font-medium'>{property.label}</span>
                        <span>{property.value}</span>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value='shipping'>
                <AccordionTrigger>Shipping & Returns</AccordionTrigger>
                <AccordionContent>
                  <div className='space-y-4'>
                    <p>Free shipping on orders over $100</p>
                    <p>30-day return policy</p>
                    <p>2-5 business days delivery</p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </div>
      <Reviews />
    </>
  );
}
