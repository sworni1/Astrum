# 0024. Checkout on its own route — rationale

## Context

> ⚠️ Premise note: `sessionStorage` solves the selection handoff for one tab in one browser and nothing more. A customer who opens the checkout in a second tab after ticking lines in the first, or on another device, is sent back to the cart and ticks again. The deeper fix is a selection the server owns (a `selected` flag on the cart row, or a checkpointed cart), which no feature in the scope has asked for and which would touch the gateway and the schema. This spec takes the cheaper path deliberately, and the cost is written into Consequences so a later reader does not read it as an oversight.

The checkout is not a page. `apps/customer/src/features/pages/Cart/index.tsx:18` holds a `showCheckout` boolean and swaps the whole cart body for `CheckoutScreen`, so the checkout has no address: a refresh throws the customer back to the cart, the browser back button leaves the flow entirely, nothing can be linked, and the state lives in one component's memory. The selected lines travel as a React prop from the cart's `useCartSelection` state, which is also the reason the checkout cannot be reached except through that button.

The mockup in `C:/Users/ADMIN/Downloads/Оформление заказа-html/Checkout.dc.html` draws the screen as a page: a 1080px wrapper, a title block, two columns with the summary sticky on the right, one card for the selected items with an image tile per line, one card for the receipt (point or address, shipping method as radio cards, delivery date), one card for payment as a radio card, and a submit button inside the summary with a hint under it. It also draws controls the project forbids: a native `select` for the pickup point and an `input[type=date]` for the delivery date, both of which slice 3 of the customer scope replaced with Radix `Select` and `Popover` plus `Calendar`.

The form itself is one 199 line file, `apps/customer/src/features/pages/Cart/components/CheckoutForm/index.tsx`, doing orchestration, five fields, the summary and the submit at once, which is customer scope row 6. Slice 3 recorded that row 13 absorbs it, because the checkout leaves the cart page in one and the same change.

Two facts about the data bound the design. The `/cart` read answers `id`, `name`, `previewImage`, `price` and `quantity`, plus the per user `quantityInCart`, and it selects no `description` and no `currency`, so the row cannot print the mockup's size line and the amounts cannot take their currency from the cart. And `ProductCartProps` declares `isOutOfStock` while `cartPublicSelect` never sends it, so the screen cannot honestly badge a line that went out of stock between the cart and the checkout.

## Options considered

### Option 1: own route, ids only handoff, reconcile against the live cart

The cart writes the ticked product ids into one `sessionStorage` key and links to `/checkout`. The route reads the live cart, keeps the rows that still exist, and takes price, quantity and image from the server answer. Money is recomputed on live numbers.

**Pros**:
- The address is real: refresh, link and back button all behave, because the state that matters is derived from the server read.
- The browser still cannot decide money or stock, and the handoff cannot go stale in a way that matters, because only ids travel.
- One small, testable helper owns the reconcile, and the cart and the checkout share one exported key.

**Cons**:
- The selection lives in one tab of one browser, and the failure is silent to the customer until the redirect fires.
- The route depends on a client side read, so its first paint waits for the cart request before it can decide between the form and the redirect.

### Option 2: own route, all cart lines selected by default

`/checkout` reads the whole cart and treats every row as selected. No handoff at all.

**Pros**:
- No storage, no reconcile, no redirect, and a direct link always works.
- The cart page loses nothing it needs.

**Cons**:
- The customer's ticks stop meaning anything: the checkout orders lines they deliberately left out of the selection, which is worse than the current behaviour.
- The cart's whole point today is choosing a subset, and the summary already prints "selected N of M".

### Option 3: own route, ids in the query string

`/checkout?ids=a,b,c`, the way a filter or a page number travels.

**Pros**:
- No storage and no state left behind, and the address carries the selection, so it can be bookmarked or sent.

**Cons**:
- The address grows with the cart, and a long cart produces a URL that is ugly and near the length limits once the ids are cuids.
- A bookmark of an order intent is a stale artefact that looks valid a month later, which is exactly the case the redirect branch exists to catch.

### Option 4: keep the boolean, only redraw the screen in place

Leave the checkout where it is and apply the mockup geometry to the existing card.

**Pros**:
- The smallest change: no route, no handoff, no reconcile, no cart page edit.
- Nothing can regress in the cart.

**Cons**:
- The two failures the scope row names stay: no address, and no back button.
- The summary cannot be sticky beside the form while the checkout is a swap inside a page that already owns a grid.
- Scope row 13 asks for the route in its `Done when:` line, so this option answers a different feature.

## Decision

Option 1 wins on the forces that actually bind here. The customer's selection is the only thing the cart has that the checkout needs, and it is expressible as a list of ids, while everything else on the screen is a server answer. Sending ids only keeps the browser out of the money path, which is what spec 0001 and spec 0003 spent two features establishing, and it makes the reconcile a pure function with one input from storage and one from the cache, so the empty and partial cases become test cases instead of states discovered in production.

Option 2 was rejected because it silently overrides the customer's ticks, and Option 3 because an address carrying order intent invites a stale bookmark that the redirect branch would then have to explain. Option 4 was rejected on the scope row itself, not on a technical ground: the feature exists to give the checkout an address.

The redraw keeps the project primitives where the mockup draws native controls. A native `select` would regress the keyboard and screen reader behaviour slice 3 standardised, and a `type="date"` input cannot print the project's date format, so both triggers take the mockup's geometry (`h-10`, `rounded-md`, 14px text) while staying Radix.

The recomputed subtotal is deliberate even though the server recomputes the order anyway. The screen shows what the customer is about to be charged, and a snapshot taken on the cart page would show a price that stopped being true.

## Consequences

The checkout becomes a page with a real address, the selection survives the round trip to the cart, and the form file splits along the boundaries the standard already names. The accepted costs are the one tab scope of `sessionStorage`, one extra effect on the cart page, a row that reads thinner than the mockup because no description field travels, and two controls that keep their Radix behaviour instead of the drawing's native ones. There is no server change, no schema change and no new configuration, so the whole feature reverts with one storefront commit.

References: none. The stack is settled, the sources that shaped this decision are the existing specs and the code they describe: 0001 and 0003 for the server decided price, the idempotency key and the cart clearing the checkout reuses as it stands; 0009 and 0013 for the shipping methods, the pickup points and their refusal codes; 0023 for the palette and the radius ladder the redraw prints instead of new hex values; plus `apps/customer/AGENTS.md` for the placement and file rules the split follows. The reasoning stays here rather than in a citation list, following the shape specs 0011, 0012, 0013 and 0022 already use for the same call.
