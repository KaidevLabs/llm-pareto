// Per-panel render status, set by the imperative chart seam
// (charts.ts renderPanel/renderSpeedPanel) and read reactively by the
// Panel component chrome (badge visibility + count line).

export interface PanelStatus {
  count: string;
  badgeHidden: boolean;
}

export type PanelKey = "blend" | "in" | "out" | "speed" | "3d";

export const panelStatus = $state<Record<PanelKey, PanelStatus>>({
  blend: { count: "", badgeHidden: false },
  in: { count: "", badgeHidden: false },
  out: { count: "", badgeHidden: false },
  speed: { count: "", badgeHidden: false },
  "3d": { count: "", badgeHidden: false },
});
