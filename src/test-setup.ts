// jsdom has no Web Animations API — svelte's animate:flip calls
// element.getAnimations() and element.animate() on every keyed-each
// reorder (the comparator slots) and throws without them; stub them so
// the flip is a no-op under vitest (real browsers run the animation).
Element.prototype.getAnimations ??= () => [];
Element.prototype.animate ??= (() =>
  ({ finished: Promise.resolve(), cancel: () => {} }) as unknown as Animation);