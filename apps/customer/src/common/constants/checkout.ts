/**
 * The one `sessionStorage` key the cart writes and the checkout route reads
 * (spec 0024, AC-2). It holds product ids only, never a price or a quantity.
 */
export const CHECKOUT_SELECTION_KEY = "astrum.checkout.selection";

/** The ticked product ids, in the order the cart renders its rows. */
export type CheckoutSelection = string[];
