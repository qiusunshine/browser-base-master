import {existsSync, promises as fs, createWriteStream} from 'fs';
import {resolve, join} from 'path';
import {fetch} from 'cross-fetch';

import {BlockingResponse, ElectronBlocker, Request} from '@cliqz/adblocker-electron';
import {getPath} from '~/utils';
import {Application} from '../application';
import {ipcMain} from 'electron';
import {deletePath, isExpire, readFileAsText, writeFileText} from "~/utils/files";

export let engine: ElectronBlocker;

//const PRELOAD_PATH = join(__dirname, './preload.js');

const emitBlockedEvent = (request: Request, result: BlockingResponse) => {
  const win = Application.instance.windows.findByBrowserView(request.tabId);
  if (!win) return;
  win.viewManager.views.get(request.tabId).emitEvent('blocked-ad', request.url, result.filter.filter || result.filter.toString(), filterCount);
};

let adblockRunning = false;
let adblockInitialized = false;

interface IAdblockInfo {
  headersReceivedId?: number;
  beforeRequestId?: number;
}

// const adsLists = [
//   "https://filters.adtidy.org/extension/chromium/filters/224.txt",
//   "https://adrules.top/adblock_lite.txt",
//   "https://hub.gitmirror.com/https://raw.githubusercontent.com/xun404/adblock/main/ad.txt"
// ];
const adsLists: string[] = [
];
export let filterCount = 0;

interface CustomRequestInit extends RequestInit {
  timeout?: number;
}

const customFetch0 = (url: string, options: CustomRequestInit = {}): Promise<Response> => {
  const {timeout = 10000, ...rest} = options;

  const controller = new AbortController();
  const signal = controller.signal;

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);

  return fetch(url, {signal, ...rest})
    .finally(() => {
      clearTimeout(timeoutId);
    });
};
const customFetch = (url: string) => {
  console.log(`Sending request to: ${url}`);
  return customFetch0(url, {timeout: 10000})
    .then(response => {
      console.log(`Received response from: ${url}`);
      return response;
    })
    .catch(error => {
      console.error(`Error while fetching ${url}: ${error}`);
      return new Response('', {status: 200, headers: {'Content-Type': 'text/plain'}});
    });
}

let whiteList = [
  "qq.com",
  "iqiyi.com",
  "youku.com"
];
const loadFilters = async () => {
  console.log("loadFilters");
  //订阅地址
  const listPath = resolve(getPath('adblock/lists.txt'));
  const list = readFileAsText(listPath);
  let ads = adsLists;
  if (list == "empty") {
    ads = [];
  } else if (list) {
    ads = list.split("\n").filter(it => it && it.trim() != "");
  } else {
    writeFileText(listPath, adsLists.join("\n"));
  }
  //白名单
  const whitePath = resolve(getPath('adblock/whiteList.txt'));
  const white = readFileAsText(whitePath);
  if (white) {
    whiteList = white.split("\n").filter(it => it && it.trim() != "");
  } else {
    writeFileText(whitePath, whiteList.join("\n"));
  }
  //缓存
  const path = resolve(getPath('adblock/cache.bin'));
  const shouldDelete = await isExpire(path, process.env.NODE_ENV === 'development' ? 1 : 24);
  if (shouldDelete) {
    //过期了，重新下载
    await deletePath(path);
  }
  engine = await ElectronBlocker.fromLists(customFetch, ads, {
    loadCosmeticFilters: false,
    enableHtmlFiltering: false
  }, {
    path: path,
    read: fs.readFile,
    write: fs.writeFile,
  });
  try {
    filterCount = engine.filters.getFilters().length;
    console.log("loadFilters end, filterCount = ", filterCount);
  } catch (e) {
    console.error(e);
  }
};

export const runAdblockService = async (ses: any) => {
  console.log("runAdblockService");
  if (!adblockInitialized) {
    adblockInitialized = true;
    await loadFilters();
  }
  if (adblockInitialized && !engine) {
    return;
  }
  engine.enableBlockingInSession(ses);
  const onBeforeRequest = engine.onBeforeRequest;
  (engine as any).onBeforeRequest = (details: Electron.OnBeforeRequestListenerDetails, callback: any) => {
    if (details.referrer) {
      for (let s of whiteList) {
        if (details.referrer.includes(s)) {
          callback({});
          return
        }
      }
    }
    onBeforeRequest(details, callback);
  };
  //ses.setPreloads(ses.getPreloads().concat([PRELOAD_PATH]));
  if (adblockRunning) return;
  adblockRunning = true;
  engine.on('request-blocked', emitBlockedEvent);
  engine.on('request-redirected', emitBlockedEvent);
};

export const stopAdblockService = (ses: any) => {
  if (!adblockRunning) return;
  adblockRunning = false;
  adblockInitialized = false;
  try {
    engine.disableBlockingInSession(ses);
    //ses.setPreloads(ses.getPreloads().filter((p: string) => p !== PRELOAD_PATH));
  } catch (e) {
    console.error(e);
  }
};
export const getAdLists = () => {
  console.log("getAdLists1");
  const listPath = resolve(getPath('adblock/lists.txt'));
  const list = readFileAsText(listPath);
  let ads = adsLists;
  if (list == "empty") {
    ads = [];
  } else if (list) {
    ads = list.split("\n").filter(it => it && it.trim() != "");
  }
  console.log("getAdLists2", ads);
  return ads;
}
export const updateAdLists = async (lists: string, ses: Electron.Session[]) => {
  const listPath = resolve(getPath('adblock/lists.txt'));
  let ads = adsLists;
  if (lists) {
    ads = lists.split("\n").filter(it => it && it.trim() != "");
  } else {
    ads = [];
  }
  console.log("updateAdLists2", ads);
  let str = ads.join("\n");
  if ("" == str.trim()) {
    str = "empty";
  }
  const exist = readFileAsText(listPath);
  if (str == exist) {
    return false;
  }
  writeFileText(listPath, str);
  const path = resolve(getPath('adblock/cache.bin'));
  //重新下载
  await deletePath(path);
  for (let i = 0; i < ses.length; i++) {
    stopAdblockService(ses[i]);
    await runAdblockService(ses[i]);
  }
  return true;
}
