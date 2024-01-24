import OnHeadersReceivedListenerDetails = Electron.OnHeadersReceivedListenerDetails;
import {Application} from "~/main/application";

const m3u8Types = ["application/vnd.apple.mpegurl", "application/mpegurl", "application/x-mpegurl", "audio/mpegurl", "audio/x-mpegurl", "application/x-mpeg"]

export interface VideoRequest {
  url: string,
  requestHeaders?: Record<string, string>,
  referrer: string,
  frameUrl?: string
}

export const recordUrlRequest = (details: Electron.OnBeforeSendHeadersListenerDetails) => {
  const {webContentsId, url, requestHeaders} = details;
  if (webContentsId) {
    const view = Application.instance.windows.current.viewManager.getById(webContentsId);
    if (view) {
      view.requestRecord.set(url, requestHeaders);
    }
  }
}
export const filterVideo = (details: OnHeadersReceivedListenerDetails) => {
  const {webContentsId, url, frame, referrer, resourceType, responseHeaders} = details;
  if (resourceType == 'xhr' || resourceType == "object" || resourceType == "media" || resourceType == "other") {
    if (url.includes(".m3u8") || (responseHeaders && responseHeaders["Content-Type"] && m3u8Types.includes(responseHeaders["Content-Type"][0]))) {
      const view = Application.instance.windows.current.viewManager.getById(webContentsId);
      if (!view) {
        return
      }
      const request: VideoRequest = {
        url,
        referrer,
        frameUrl: (frame || {}).url,
        requestHeaders: view.requestRecord.get(url)
      };
      console.log(url, referrer, request.requestHeaders);
      view.addNetVideoRequest(request);
    }
  }
}