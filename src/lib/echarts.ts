// The echarts seam (040 D1/D4): npm echarts 5.6.0 (exact pin, lockfile
// integrity hashes — 019's byte-pin audit, amended mechanism), treeshaken
// to exactly the feature set the app uses: custom/line/scatter charts +
// grid/tooltip/inside-zoom components + canvas renderer. The probe
// (.tmp/echarts-probe) measured this set at 505,771 B / 166 KB gz eager
// vs the vendored full build's 1,034,102 B / 335 KB gz (−50%).
// Everything echarts-touching imports the configured namespace from here,
// never from "echarts" directly; echarts-gl registers onto the same core
// through its dynamic import (gl.ts, 040 D2).
import * as echarts from "echarts/core";
import { CustomChart, LineChart, ScatterChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  DataZoomInsideComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  CustomChart,
  LineChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  DataZoomInsideComponent,
  CanvasRenderer,
]);

export { echarts };
