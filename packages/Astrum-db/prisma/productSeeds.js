import { products } from './prisma_seed_products';
import { prisma } from '../lib/prisma';

async function main() {
  for (const p of products) {
    const { properties, createdAt, ...productData } = p;

    await prisma.product.create({
      data: {
        ...productData,
        properties: {
          create: properties,
        },
      },
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
