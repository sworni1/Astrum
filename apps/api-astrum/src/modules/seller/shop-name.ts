export {
  SHOP_NAME_MAX_LENGTH,
  SHOP_NAME_MIN_LENGTH,
} from "./constants/shop-name.constants";
export type { ShopNameProblem } from "./helpers/shop-name.helpers";
export {
  normalizeShopName,
  shopNameCodePointLength,
  shopNameProblem,
} from "./helpers/shop-name.helpers";
