export const productPreviewPublicSelect = {
  id: true,
  name: true,
  previewImage: true,
  images: true,
  quantity: true,
  price: true,
  discount: true,
  stars: true,
  currency: true,
  _count: {
    select: {
      impressions: true,
    },
  },
};

export const productPublicSelect = {
  id: true,
  businessId: true,
  createdAt: true,
  name: true,
  quantity: true,
  description: true,
  price: true,
  discount: true,
  stars: true,
  popularity: true,
  category: true,
  currency: true,
  isDeleted: true,
  isOutOfStock: true,
  visibility: true,
  status: true,
  images: true,
  previewImage: true,
  sales: true,
  views: true,
  impressions: true,
  properties: true,
  _count: {
    select: {
      impressions: true,
    },
  },
};

export const cartActionsPublicSelect = {
  id: true,
  productId: true,
  quantity: true,
};

export const cartPublicSelect = {
  id: true,
  quantity: true,
  price: true,
  previewImage: true,
  name: true,
};
