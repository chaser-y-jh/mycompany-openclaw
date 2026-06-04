import {
  resolveHostedPluginSurfaceUrl,
  type HostedPluginSurfaceUrlParams,
} from "merclaw/plugin-sdk/gateway-runtime";

type CanvasHostUrlParams = Omit<HostedPluginSurfaceUrlParams, "port"> & {
  canvasPort?: number;
};

export function resolveCanvasHostUrl(params: CanvasHostUrlParams) {
  return resolveHostedPluginSurfaceUrl({
    ...params,
    port: params.canvasPort,
  });
}
