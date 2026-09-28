// echarts-gl 2.1.0 ships no usable ESM types (its type surface is the UMD
// dist build), and nothing here consumes its exports: the dynamic import in
// gl.ts is a pure side effect — the module's evaluation registers
// grid3D/scatter3D/lines3D onto the shared echarts core. A bare declaration
// keeps tsc strict-clean without a types-only dependency (040 D2).
declare module "echarts-gl";
