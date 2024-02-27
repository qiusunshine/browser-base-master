import {BrowserView, app, ipcMain, webFrameMain, dialog} from 'electron';
import {parse as parseUrl} from 'url';
import {getViewMenu} from './menus/view';
import {AppWindow} from './windows';
import {IHistoryItem, IBookmark} from '~/interfaces';
import {
  ERROR_PROTOCOL,
  NETWORK_ERROR_HOST,
  WEBUI_BASE_URL,
} from '~/constants/files';
import {
  ZOOM_FACTOR_MIN,
  ZOOM_FACTOR_MAX,
  ZOOM_FACTOR_INCREMENT,
} from '~/constants/web-contents';
import {TabEvent} from '~/interfaces/tabs';
import {Queue} from '~/utils/queue';
import {Application} from './application';
import {ChromeAppVersion, ChromeUserAgent, getUserAgentForURL} from './user-agent';
import {getWebUIURL} from "~/common/webui-main";
import {getVideoPlayCode, hookClickCode, VideoRequest, watchVideoCode} from "~/main/services/xiu-video";
import {exec} from "child_process";
import {existsSync} from "fs";

interface IAuthInfo {
  url: string;
}

export class View {
  public browserView: BrowserView;

  public isNewTab = false;
  public homeUrl: string;
  public favicon = '';
  public incognito = false;

  public errorURL = '';

  private hasError = false;

  public window: AppWindow;

  public bounds: any;

  public lastHistoryId: string;

  public bookmark: IBookmark;

  public findInfo = {
    occurrences: '0/0',
    text: '',
  };

  public requestedAuth: IAuthInfo;
  public requestedPermission: any;

  private historyQueue = new Queue();

  private lastUrl = '';
  public videoUrls: string[] = [];
  public netVideoUrls: VideoRequest[] = [];
  public requestRecord: Map<string, Record<string, string>> = new Map();
  public framesCache: any[] = [];

  public constructor(window: AppWindow, url: string, incognito: boolean) {
    const preload = `${app.getAppPath()}/build/view-preload.bundle.js`;
    console.log(preload);
    this.browserView = new BrowserView({
      webPreferences: {
        session: incognito ? Application.instance.sessions.viewIncognito : Application.instance.sessions.view,
        preload: preload,
        nodeIntegration: false,
        nodeIntegrationInWorker: false,
        nodeIntegrationInSubFrames: false,
        allowRunningInsecureContent: true,
        contextIsolation: false,
        sandbox: true,
        enableRemoteModule: false,
        partition: incognito ? 'view_incognito' : 'persist:view',
        plugins: true,
        nativeWindowOpen: true,
        webSecurity: false,
        javascript: true,
        worldSafeExecuteJavaScript: true,
      },
    });
    require("@electron/remote/main").enable(this.browserView.webContents);
    Application.instance.sessions.chromeExtensions.addTab(this.webContents, window.win);

    this.incognito = incognito;

    this.webContents.userAgent = getUserAgentForURL(
      this.webContents.userAgent,
      '',
    );

    (this.webContents as any).windowId = window.win.id;

    this.window = window;
    this.homeUrl = url;

    ipcMain.handle(`get-error-url-${this.id}`, async (e) => {
      return this.errorURL;
    });
    ipcMain.on(`xiu-video-created-${this.id}`, async (e, data) => {
      console.log("xiu-video-created", data);
      this.addVideoUrl(data.url);
    });
    ipcMain.on(`show-full-video-dialog-${this.id}`, async (e) => {
      const inject = getVideoPlayCode("full");
      this.webContents.executeJavaScript(inject, true);
      for (let item of this.framesCache) {
        const {frameProcessId, frameRoutingId} = item;
        const frame = webFrameMain.fromId(frameProcessId, frameRoutingId);
        if (frame) {
          frame.executeJavaScript(inject, true);
        }
      }
    });
    ipcMain.on(`show-float-video-dialog-${this.id}`, async (e) => {
      const inject = getVideoPlayCode("float");
      this.webContents.executeJavaScript(inject, true);
      for (let item of this.framesCache) {
        const {frameProcessId, frameRoutingId} = item;
        const frame = webFrameMain.fromId(frameProcessId, frameRoutingId);
        if (frame) {
          frame.executeJavaScript(inject, true);
        }
      }
    });

    function getPotPlayerInstallPath(x64: boolean) {
      const regQueryCommand = 'reg query "HKLM\\SOFTWARE\\DAUM\\PotPlayer' + (x64 ? "64" : "") + '" /v "ProgramPath"';
      return new Promise((resolve, reject) => {
        exec(regQueryCommand, (error, stdout, stderr) => {
          if (error) {
            console.error(`查询注册表时发生错误: ${error.message}`);
            reject(error);
            return;
          }
          if (stderr) {
            console.error(`注册表查询错误: ${stderr}`);
            reject(new Error(stderr));
            return;
          }
          // 解析注册表查询结果，提取Potplayer的安装路径
          const match = stdout.match(/ProgramPath\s+REG_SZ\s+(.+)/i);
          if (!match || match.length < 2) {
            reject(new Error('未找到PotPlayer的安装路径'));
            return;
          }
          const installPath = match[1];
          console.log("PotPlayer installPath: ", installPath)
          resolve(installPath);
        });
      });
    }

    function callPotPlayer(path: string, url: string, headers?: Record<string, string>) {
      let hd = "";
      if (headers) {
        //有些网站带UA也无法播放
        hd = Object.keys(headers).map(it => `${it}: ${headers[it]}`)
          .filter(it => !it.includes('"')
            && !it.startsWith("Accept")
            && !it.startsWith("User-Agent")
            && !it.toLowerCase().startsWith("sec-"))
          .join("\r\n");
        if (hd) {
          hd = ` /headers="${hd}"`;
        }
        console.log("headers", hd);
      }
      const command = `"${path}" "${url}"${hd}`;
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`调用PotPlayer时发生错误: ${error.message}`);
          alert(`调用PotPlayer时发生错误: ${error.message}`)
          return;
        }
        if (stderr) {
          console.error(`PotPlayer输出错误: ${stderr}`);
          return;
        }
        console.log('PotPlayer已成功启动');
      });
    }

    ipcMain.on(`show-other-video-dialog-${this.id}`, async (e) => {
      //暂停播放
      const inject = getVideoPlayCode("other");
      this.webContents.executeJavaScript(inject, true);
      for (let item of this.framesCache) {
        const {frameProcessId, frameRoutingId} = item;
        const frame = webFrameMain.fromId(frameProcessId, frameRoutingId);
        if (frame) {
          frame.executeJavaScript(inject, true);
        }
      }
      const url = this.videoUrls[0];
      let headers = {};
      for (let netVideoUrl of this.netVideoUrls) {
        if (netVideoUrl.url == url) {
          headers = netVideoUrl.requestHeaders;
          break
        }
      }
      //调用PotPlayer打开指定的视频文件
      const callDefaultPath = () => {
        const path = 'C:\\Program Files\\Potplayer\\PotPlayer.exe';
        if (existsSync(path)) {
          callPotPlayer(path, url, headers);
        } else {
          dialog.showMessageBox({
            type: 'warning',
            title: '温馨提示',
            message: '请确认你有安装PotPlayer，安装后才能唤起播放视频',
            buttons: ['确定']
          });
        }
      };
      const callX86 = () => {
        getPotPlayerInstallPath(false)
          .then((path: string) => {
            if (existsSync(path)) {
              callPotPlayer(path, url, headers);
            } else {
              callDefaultPath();
            }
          }).then(err => {
          callDefaultPath();
        });
      };
      getPotPlayerInstallPath(true)
        .then((path: string) => {
          if (existsSync(path)) {
            callPotPlayer(path, url, headers);
          } else {
            callX86();
          }
        }).then(err => {
        callX86();
      });
    });

    this.webContents.on('context-menu', (e, params) => {
      const menu = getViewMenu(this.window, params, this.webContents);
      menu.popup();
    });

    this.webContents.addListener('found-in-page', (e, result) => {
      Application.instance.dialogs
        .getDynamic('find')
        .browserView.webContents.send('found-in-page', result);
    });

    this.webContents.addListener('page-title-updated', (e, title) => {
      this.window.updateTitle();
      this.updateData();

      this.emitEvent('title-updated', title);
      this.updateURL(this.webContents.getURL());
    });

    this.webContents.addListener('did-navigate', async (e, url) => {
      this.emitEvent('did-navigate', url);
      this.videoUrls = [];
      this.framesCache = [];
      this.requestRecord.clear();
      await this.addHistoryItem(url);
      this.updateURL(url);
      this.emitEvent('xiu-video', this.videoUrls);
    });

    this.webContents.addListener(
      'did-navigate-in-page',
      async (e, url, isMainFrame) => {
        if (isMainFrame) {
          this.emitEvent('did-navigate', url);

          await this.addHistoryItem(url, true);
          this.updateURL(url);
        }
      },
    );
    this.webContents.setWindowOpenHandler((details) => {
      console.log("setWindowOpenHandler", details);
      switch (details.disposition) {
        case 'foreground-tab':
        case 'background-tab':
        case 'new-window': {
          // setWindowOpenHandler doesn't yet support creating BrowserViews
          // instead of BrowserWindows. For now, we're opting to break
          // window.open until a fix is available.
          // https://github.com/electron/electron/issues/33383
          if (details.url != null && details.url != "" && details.url != "about:blank") {
            queueMicrotask(() => {
              window.viewManager.create(
                {
                  url: details.url,
                  active: true,
                },
                true,
              );
            });
          }
          return {action: 'deny'}
        }
        default:
          return {action: 'allow'}
      }
    });

    this.webContents.addListener('did-stop-loading', () => {
      this.updateNavigationState();
      this.emitEvent('loading', false);
      this.updateURL(this.webContents.getURL());
    });

    this.webContents.addListener('did-start-loading', () => {
      this.hasError = false;
      this.updateNavigationState();
      this.emitEvent('loading', true);
      this.updateURL(this.webContents.getURL());
      this.webContents.executeJavaScript(hookClickCode, true);
    });

    this.webContents.addListener('did-start-navigation', async (e, ...args) => {
      this.updateNavigationState();

      this.favicon = '';

      this.emitEvent('load-commit', ...args);
      this.updateURL(this.webContents.getURL());
    });

    this.webContents.on(
      'did-start-navigation',
      (e, url, isInPlace, isMainFrame) => {
        if (!isMainFrame) return;
        const newUA = getUserAgentForURL(this.webContents.userAgent, url);
        if (this.webContents.userAgent !== newUA) {
          this.webContents.userAgent = newUA;
        }
      },
    );

    this.webContents.on(
      'did-finish-load',
      () => {
        const pageUrl = this.webContents.getURL();
        if (pageUrl && pageUrl.startsWith("http://localhost:") || pageUrl.startsWith("file://") || pageUrl.startsWith("wexond://")) {
          return
        }
        this.webContents.executeJavaScript(`Object.defineProperty(navigator, 'userAgent', { value: '${ChromeUserAgent}' });Object.defineProperty(navigator, 'appVersion', { value: '${ChromeAppVersion}' });true`)
          .catch(e => {
            console.log("executeJavaScript1", e);
          });
        this.webContents.executeJavaScript(watchVideoCode, true).catch(e => {
          console.log("executeJavaScript2", e);
        });
      },
    );

    this.webContents.on(
      'did-frame-finish-load',
      (event: Event,
       isMainFrame: boolean,
       frameProcessId: number,
       frameRoutingId: number) => {
        console.log("did-frame-finish-load", isMainFrame, frameProcessId, frameRoutingId);
        if (!isMainFrame) {
          const frame = webFrameMain.fromId(frameProcessId, frameRoutingId);
          if (frame) {
            this.framesCache.push({
              frameProcessId, frameRoutingId
            });
            try {
              frame.executeJavaScript(`Object.defineProperty(navigator, 'userAgent', { value: '${ChromeUserAgent}' });Object.defineProperty(navigator, 'appVersion', { value: '${ChromeAppVersion}' });true`).catch(e => {
                console.log("executeJavaScript1", e);
              });
            } catch (e) {
              console.log("executeJavaScript2", e);
            }
            try {
              frame.executeJavaScript(watchVideoCode, true).catch(e => {
                console.log("executeJavaScript", e);
              });
            } catch (e) {
              console.log("executeJavaScript", e);
            }
            frame.executeJavaScript(hookClickCode, true).catch(e => {
              console.log("executeJavaScript", e);
            });
          }
        }
      },
    );
    this.webContents.on('frame-created', (event, details) => {
      console.log('frame-created', details.frame.url);
      details.frame.executeJavaScript(hookClickCode, true);
    });

    this.webContents.addListener(
      'did-fail-load',
      (e, errorCode, errorDescription, validatedURL, isMainFrame) => {
        // ignore -3 (ABORTED) - An operation was aborted (due to user action).
        if (isMainFrame && errorCode !== -3) {
          this.errorURL = validatedURL;

          this.hasError = true;

          this.webContents.loadURL(
            `${ERROR_PROTOCOL}://${NETWORK_ERROR_HOST}/${errorCode}?code=${errorCode}&description=` + encodeURIComponent(errorDescription) + `&validatedURL=` + encodeURIComponent(validatedURL),
          );
        }
      },
    );

    this.webContents.addListener(
      'page-favicon-updated',
      async (e, favicons) => {
        this.favicon = favicons[0];

        this.updateData();

        try {
          let fav = this.favicon;

          if (fav.startsWith('http')) {
            fav = await Application.instance.storage.addFavicon(fav);
          }

          this.emitEvent('favicon-updated', fav);
        } catch (e) {
          this.favicon = '';
          // console.error(e);
        }
      },
    );

    this.webContents.addListener('zoom-changed', (e, zoomDirection) => {
      const newZoomFactor =
        this.webContents.zoomFactor +
        (zoomDirection === 'in'
          ? ZOOM_FACTOR_INCREMENT
          : -ZOOM_FACTOR_INCREMENT);

      if (
        newZoomFactor <= ZOOM_FACTOR_MAX &&
        newZoomFactor >= ZOOM_FACTOR_MIN
      ) {
        this.webContents.zoomFactor = newZoomFactor;
        this.emitEvent('zoom-updated', this.webContents.zoomFactor);
        window.viewManager.emitZoomUpdate();
      } else {
        e.preventDefault();
      }
    });

    this.webContents.addListener(
      'certificate-error',
      (
        event: Electron.Event,
        url: string,
        error: string,
        certificate: Electron.Certificate,
        callback: Function,
      ) => {
        console.log(certificate, error, url);
        // TODO: properly handle insecure websites.
        event.preventDefault();
        callback(true);
      },
    );

    this.webContents.addListener('media-started-playing', () => {
      this.emitEvent('media-playing', true);
    });

    this.webContents.addListener('media-paused', () => {
      this.emitEvent('media-paused', true);
    });

    if (url.startsWith(getWebUIURL("newtab"))) this.isNewTab = true;

    //console.log("view init", url);
    this.webContents.loadURL(url);

    this.browserView.setAutoResize({
      width: true,
      height: true,
      horizontal: false,
      vertical: false,
    });
  }

  public get webContents() {
    return this.browserView.webContents;
  }

  public get url() {
    return this.webContents.getURL();
  }

  public get title() {
    return this.webContents.getTitle();
  }

  public get id() {
    return this.webContents.id;
  }

  public get isSelected() {
    return this.id === this.window.viewManager.selectedId;
  }

  public updateNavigationState() {
    if (this.browserView.webContents.isDestroyed()) return;

    if (this.window.viewManager.selectedId === this.id) {
      this.window.send('update-navigation-state', {
        canGoBack: this.webContents.canGoBack(),
        canGoForward: this.webContents.canGoForward(),
      });
    }
  }

  public destroy() {
    (this.browserView.webContents as any).destroy();
    this.browserView = null;
  }

  public async updateCredentials() {
    if (
      !process.env.ENABLE_AUTOFILL ||
      this.browserView.webContents.isDestroyed()
    )
      return;

    const item = await Application.instance.storage.findOne<any>({
      scope: 'formfill',
      query: {
        url: this.hostname,
      },
    });

    this.emitEvent('credentials', item != null);
  }

  public async addHistoryItem(url: string, inPage = false) {
    if (
      url !== this.lastUrl &&
      !url.startsWith(WEBUI_BASE_URL) &&
      !url.startsWith(`${ERROR_PROTOCOL}://`) &&
      !this.incognito
    ) {
      const historyItem: IHistoryItem = {
        title: this.title,
        url,
        favicon: this.favicon,
        date: new Date().getTime(),
      };

      await this.historyQueue.enqueue(async () => {
        this.lastHistoryId = (
          await Application.instance.storage.insert<IHistoryItem>({
            scope: 'history',
            item: historyItem,
          })
        )._id;

        historyItem._id = this.lastHistoryId;

        Application.instance.storage.addHistory(historyItem);
      });
    } else if (!inPage) {
      await this.historyQueue.enqueue(async () => {
        this.lastHistoryId = '';
      });
    }
  }

  public updateURL = (url: string) => {
    if (this.lastUrl === url) return;

    this.emitEvent('url-updated', this.hasError ? this.errorURL : url);

    this.lastUrl = url;

    this.isNewTab = url.startsWith(getWebUIURL("newtab"));

    this.updateData();

    if (process.env.ENABLE_AUTOFILL) this.updateCredentials();

    this.updateBookmark();
  };

  public updateBookmark() {
    this.bookmark = Application.instance.storage.bookmarks.find(
      (x) => x.url === this.url,
    );

    if (!this.isSelected) return;

    this.window.send('is-bookmarked', !!this.bookmark);
  }

  public async updateData() {
    if (!this.incognito) {
      const id = this.lastHistoryId;
      if (id) {
        const {title, url, favicon} = this;

        this.historyQueue.enqueue(async () => {
          await Application.instance.storage.update({
            scope: 'history',
            query: {
              _id: id,
            },
            value: {
              title,
              url,
              favicon,
            },
            multi: false,
          });

          const item = Application.instance.storage.history.find(
            (x) => x._id === id,
          );

          if (item) {
            item.title = title;
            item.url = url;
            item.favicon = favicon;
          }
        });
      }
    }
  }

  public send(channel: string, ...args: any[]) {
    this.webContents.send(channel, ...args);
  }

  public get hostname() {
    return parseUrl(this.url).hostname;
  }

  public emitEvent(event: TabEvent, ...args: any[]) {
    this.window.send('tab-event', event, this.id, args);
  }

  public addVideoUrl(url: string) {
    if (url.startsWith("blob:")) {
      const host = new URL(url.replace("blob:", "")).hostname;
      //console.log("addVideoUrl", url, host, this.netVideoUrls);
      for (let netVideoUrl of this.netVideoUrls) {
        if (netVideoUrl.referrer && new URL(netVideoUrl.referrer).hostname == host) {
          url = netVideoUrl.url;
        }
      }
      //Origin优先级更高
      for (let netVideoUrl of this.netVideoUrls) {
        if (netVideoUrl.requestHeaders && netVideoUrl.requestHeaders["Origin"]
          && new URL(netVideoUrl.requestHeaders["Origin"]).hostname == host) {
          url = netVideoUrl.url;
        }
      }
      for (let netVideoUrl of this.netVideoUrls) {
        if (netVideoUrl.frameUrl && new URL(netVideoUrl.frameUrl).hostname == host) {
          url = netVideoUrl.url;
        }
      }
    }
    if (!this.videoUrls.includes(url)) {
      this.videoUrls.push(url);
      this.emitEvent('xiu-video', this.videoUrls);
    }
  }

  public addNetVideoRequest(videoRequest: VideoRequest) {
    this.netVideoUrls.push(videoRequest);
    let changed = false;
    for (let i = 0; i < this.videoUrls.length; i++) {
      let url = this.videoUrls[i];
      if (url.startsWith("blob:")) {
        const host = new URL(url.replace("blob:", "")).hostname;
        //console.log("addNetVideoRequest", url, host, videoRequest);
        if (videoRequest.referrer && new URL(videoRequest.referrer).hostname == host) {
          this.videoUrls[i] = videoRequest.url;
          changed = true;
        }
        if (videoRequest.requestHeaders && videoRequest.requestHeaders["Origin"]
          && new URL(videoRequest.requestHeaders["Origin"]).hostname == host) {
          this.videoUrls[i] = videoRequest.url;
          changed = true;
        }
        if (videoRequest.frameUrl && new URL(videoRequest.frameUrl).hostname == host) {
          this.videoUrls[i] = videoRequest.url;
          changed = true;
        }
      }
    }
    if (changed) {
      this.emitEvent('xiu-video', this.videoUrls);
    }
  }
}
