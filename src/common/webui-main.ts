import {WEBUI_BASE_URL, WEBUI_URL_SUFFIX} from '~/constants/files';
import {Application} from "~/main/application";

export const getWebUIURL = (hostname: string) => {
  if (hostname == "boke") {
    return "https://haikuoshijie.cn/";
  }
  if (hostname == "newtab" && process.env.ENABLE_EXTENSIONS) {
    const newtabUrl = Application.instance.settings.object.newtab;
    console.log("newtab", newtabUrl);
    if (newtabUrl && newtabUrl != "") {
      if(Application.instance.tempTabUrl) {
        return Application.instance.tempTabUrl;
      }
      return newtabUrl.split("\n")[0];
    }
  }
  return `${WEBUI_BASE_URL}${hostname}${WEBUI_URL_SUFFIX}`;
}
