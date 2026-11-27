import type { Product } from "@astrum/db/client";
import { prisma } from "../../../lib/prisma";
import { hasNotFoundCode } from "../../common/helpers/prismaErrors";
import {
  getWishlistItem,
  ownerColumns,
  ownerUniqueKey,
} from "../../common/helpers/getWishlistAndCart";
import {
  cartActionsPublicSelect,
  cartPublicSelect,
} from "../../common/prisma-selects/product.select";
import type { Owner } from "../../common/types/owner";
import { PUBLIC_PRODUCT_WHERE } from "../product/constants/product.constants";
import { ProductService } from "../product/product.service";
import type { AddProductToCartDto } from "./dto/add-product.dto";
import type { ChangeQuantityDto } from "./dto/change-quantity.dto";
import { cartItemNotFound, quantityLimit } from "./helpers/cart.errors";
import { toCartLineJson, toCartProductJson } from "./helpers/cart.helpers";

export class CartService {
  private productService = new ProductService();

  async addProductToCart(owner: Owner, dto: AddProductToCartDto) {
    const { productId } = dto;

    const product = await this.productService.getProduct(owner, productId);

    if (product.quantity <= 0) {
      throw quantityLimit();
    }

    const wishlistItem = await getWishlistItem(owner, productId);

    const cartItem = await prisma.$transaction(async (tx) => {
      const existing = await tx.cartItem.findUnique({
        where: ownerUniqueKey(owner, productId),
      });

      const quantity = Math.min(
        (existing?.quantity ?? 0) + 1,
        product.quantity,
      );

      return await tx.cartItem.upsert({
        where: ownerUniqueKey(owner, productId),
        create: { ...ownerColumns(owner), productId, quantity },
        update: { quantity },
        select: cartActionsPublicSelect,
      });
    });

    return toCartLineJson(cartItem, wishlistItem);
  }

  async changeProductCartQuantity(
    owner: Owner,
    productId: string,
    dto: ChangeQuantityDto,
  ) {
    const product = await this.productService.getProduct(owner, productId);

    if (dto.quantity <= 0) {
      return await this.deleteProductFromCart(owner, productId);
    }

    if (product.quantity < dto.quantity) {
      throw quantityLimit();
    }

    const wishlistItem = await getWishlistItem(owner, productId);

    try {
      const cartItem = await prisma.cartItem.update({
        where: ownerUniqueKey(owner, productId),
        data: { quantity: dto.quantity },
        select: cartActionsPublicSelect,
      });

      return toCartLineJson(cartItem, wishlistItem);
    } catch (error) {
      if (hasNotFoundCode(error)) {
        throw cartItemNotFound();
      }

      throw error;
    }
  }

  async getCart(owner: Owner | null) {
    if (!owner) {
      return [];
    }

    const cartRows = await prisma.cartItem.findMany({
      where: ownerColumns(owner),
      select: { productId: true, quantity: true },
    });

    if (cartRows.length === 0) {
      return [];
    }

    const productIds = cartRows.map((row) => row.productId);

    const [products, wishlistRows] = await Promise.all([
      prisma.product.findMany({
        where: {
          id: { in: productIds },
          ...PUBLIC_PRODUCT_WHERE,
        },
        select: cartPublicSelect,
      }),
      prisma.wishlistItem.findMany({
        where: { ...ownerColumns(owner), productId: { in: productIds } },
        select: { productId: true },
      }),
    ]);

    const quantities = new Map(
      cartRows.map((row) => [row.productId, row.quantity]),
    );
    const wishlisted = new Set(wishlistRows.map((row) => row.productId));

    return products.map((product) =>
      toCartProductJson(
        product,
        wishlisted.has(product.id),
        quantities.get(product.id) ?? 0,
      ),
    );
  }

  async deleteProductFromCart(owner: Owner, productId: Product["id"]) {
    const wishlistItem = await getWishlistItem(owner, productId);

    await prisma.cartItem.deleteMany({
      where: { ...ownerColumns(owner), productId },
    });

    return {
      isWishlisted: !!wishlistItem,
      quantityInCart: 0,
    };
  }
}
