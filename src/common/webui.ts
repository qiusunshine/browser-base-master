import {WEBUI_BASE_URL, WEBUI_URL_SUFFIX} from '~/constants/files';

let storeNewTab = "";
let storeNewTabTemp = "";

export const updateStoreNewTab = (url: string) => {
  storeNewTab = url;
  if (!url) {
    storeNewTabTemp = url;
  }
}

export const updateStoreNewTabTemp = (url: string) => {
  storeNewTabTemp = url;
}

export const getWebUIURL = (hostname: string) => {
  if (hostname == "boke") {
    return "https://haikuoshijie.cn/";
  }
  if ("newtab" == hostname) {
    if (storeNewTabTemp) {
      return storeNewTabTemp;
    }
    if (storeNewTab) {
      return storeNewTab.split("\n")[0];
    }
  }
  return `${WEBUI_BASE_URL}${hostname}${WEBUI_URL_SUFFIX}`;
}
