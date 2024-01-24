import {BrowserView, app, ipcMain, session, webFrameMain, BrowserWindow} from 'electron';
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
import {filterCount} from "~/main/services/adblock";

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
  public framesCache: any[] = [];

  public constructor(window: AppWindow, url: string, incognito: boolean) {
    this.browserView = new BrowserView({
      webPreferences: {
        session: incognito ? Application.instance.sessions.viewIncognito : Application.instance.sessions.view,
        preload: `${app.getAppPath()}/build/view-preload.bundle.js`,
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

    this.webContents.session.webRequest.onBeforeSendHeaders(
      (details, callback) => {
        const {object: settings} = Application.instance.settings;
        if (settings.doNotTrack) details.requestHeaders['DNT'] = '1';
        callback({requestHeaders: details.requestHeaders});
      },
    );

    ipcMain.handle(`get-error-url-${this.id}`, async (e) => {
      return this.errorURL;
    });
    ipcMain.on(`xiu-video-created-${this.id}`, async (e, data) => {
      console.log("xiu-video-created", data);
      if (!this.videoUrls.includes(data.url)) {
        this.videoUrls.push(data.url);
        this.emitEvent('xiu-video', this.videoUrls);
      }
    });

    const getInjectJS = (method: string) => {
      const find = `
          function findLargestPlayingVideo() {
            const videos = Array.from(document.querySelectorAll('video'))
              .filter(video => video.readyState != 0)
              .filter(video => video.disablePictureInPicture == false)
              .sort((v1, v2) => {
                const v1Rect = v1.getClientRects()[0]||{width:0,height:0};
                const v2Rect = v2.getClientRects()[0]||{width:0,height:0};
                return ((v2Rect.width * v2Rect.height) - (v1Rect.width * v1Rect.height));
              });
            if (videos.length === 0) {
              return;
            }
            return videos[0];
          }
      `
      if (method == "full") {
        return `
    (() => {
          ${find}
          (async () => {
            const video = findLargestPlayingVideo();
            if (!video) {
              return;
            }
            if (video.requestFullscreen) {
              video.requestFullscreen();
            } else if (video.mozRequestFullScreen) {
              video.mozRequestFullScreen();
            } else if (video.webkitRequestFullscreen) {
              video.webkitRequestFullscreen();
            } else if (video.msRequestFullscreen) {
              video.msRequestFullscreen();
            }
          })();
    })();
      `;
      }
      return `
    (() => {
          ${find}
          async function requestPictureInPicture(video) {
            await video.requestPictureInPicture();
            video.setAttribute('__pip__', true);
            video.addEventListener('leavepictureinpicture', event => {
              video.removeAttribute('__pip__');
            }, { once: true });
            new ResizeObserver(maybeUpdatePictureInPictureVideo).observe(video);
          }
          function maybeUpdatePictureInPictureVideo(entries, observer) {
            const observedVideo = entries[0].target;
            if (!document.querySelector('[__pip__]')) {
              observer.unobserve(observedVideo);
              return;
            }
            const video = findLargestPlayingVideo();
            if (video && !video.hasAttribute('__pip__')) {
              observer.unobserve(observedVideo);
              requestPictureInPicture(video);
            }
          }
          (async () => {
            const video = findLargestPlayingVideo();
            if (!video) {
              return;
            }
            if (video.hasAttribute('__pip__')) {
              document.exitPictureInPicture();
              return;
            }
            await requestPictureInPicture(video);
          })();
    })();
      `;
    };
    ipcMain.on(`show-full-video-dialog-${this.id}`, async (e) => {
      const inject = getInjectJS("full");
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
      const inject = getInjectJS("float");
      this.webContents.executeJavaScript(inject, true);
      for (let item of this.framesCache) {
        const {frameProcessId, frameRoutingId} = item;
        const frame = webFrameMain.fromId(frameProcessId, frameRoutingId);
        if (frame) {
          frame.executeJavaScript(inject, true);
        }
      }
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
      await this.addHistoryItem(url);
      this.updateURL(url);
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

    const watch = `
    (() => {
        const urls = Array.from(document.getElementsByTagName('video')).map((video) => video.src);
        //console.log(document.getElementsByTagName('video'));
        //console.log(urls);
        function getParentWindow00(w) {
          // 如果当前窗口是最顶层窗口，则停止递归
          if (w === w.parent) {
            return w;
          }
          if(w.parent) {
            return getParentWindow00(w.parent);
          } else {
            return w;
          }
        }
        if(urls) {
          for (let v of urls) {
            v && getParentWindow00(window).postMessage({ type: 'xiu-video-created', src: v }, '*');
          }
        }
        const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
          if (mutation.type === 'childList') {
            for (const addedNode of mutation.addedNodes) {
              if (addedNode instanceof HTMLVideoElement) {
                const src = addedNode.getAttribute('src');
                getParentWindow00(window).postMessage({ type: 'xiu-video-created', src }, '*');
              }
            }
          }
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    })();
      `

    this.webContents.on(
      'did-finish-load',
      () => {
        this.webContents.executeJavaScript(`Object.defineProperty(navigator, 'userAgent', { value: '${ChromeUserAgent}' });Object.defineProperty(navigator, 'appVersion', { value: '${ChromeAppVersion}' })`);
        this.webContents.executeJavaScript(watch, true);
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
            frame.executeJavaScript(`Object.defineProperty(navigator, 'userAgent', { value: '${ChromeUserAgent}' });Object.defineProperty(navigator, 'appVersion', { value: '${ChromeAppVersion}' })`);
            frame.executeJavaScript(watch, true);
          }
        }
      },
    );

    this.webContents.addListener(
      'new-window',
      (e, url, frameName, disposition) => {
        if (url != null && url != "" && url != "about:blank") {
          if (disposition === 'new-window') {
            if (frameName === '_self') {
              e.preventDefault();
              this.window.viewManager.selected.webContents.loadURL(url);
            } else if (frameName === '_blank') {
              e.preventDefault();
              this.window.viewManager.create(
                {
                  url,
                  active: true,
                },
                true,
              );
            }
          } else if (disposition === 'foreground-tab') {
            e.preventDefault();
            this.window.viewManager.create({url, active: true}, true);
          } else if (disposition === 'background-tab') {
            e.preventDefault();
            this.window.viewManager.create({url, active: false}, true);
          }
        }
      },
    );

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
}
