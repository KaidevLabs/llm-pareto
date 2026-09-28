// Typed scroll targets (plan 039 step 4, 030 F10): the two manual scroll
// reaches — send-to-compare → the comparator section, open-full → the
// details drawer — live here once; component call sites carry no document
// reaches and no frame-wait dance of their own.

export function scrollToCompare(): void {
  document.getElementById("compare")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function scrollToDrawer(): void {
  // the drawer mounts with the state flush — the selector would miss
  // inside the click handler, so the scroll waits a frame
  requestAnimationFrame(() =>
    document.querySelector(".drawer")?.scrollIntoView({ behavior: "smooth", block: "start" })
  );
}
