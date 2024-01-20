import {BrowserWindow, app, dialog} from 'electron';
import {writeFileSync, promises} from 'fs';
import {resolve, join} from 'path';

import {getPath} from '~/utils';
import {runMessagingService} from '../services';
import {Application} from '../application';
import {isNightly} from '..';
import {ViewManager} from '../view-manager';

export class AppWindow {
  public win: BrowserWindow;

  public viewManager: ViewManager;

  public incognito: boolean;

  public constructor(incognito: boolean) {
    this.win = new BrowserWindow({
      frame: false,
      minWidth: 800,
      minHeight: 450,
      width: 900,
      height: 600,
      titleBarStyle: 'hiddenInset',
      backgroundColor: '#ffffff',
      webPreferences: {
        plugins: true,
        // TODO: enable sandbox, contextIsolation and disable nodeIntegration to improve security
        nodeIntegration: true,
        allowRunningInsecureContent: true,
        webSecurity: false,
        nodeIntegrationInWorker: true,
        nodeIntegrationInSubFrames: true,
        enableWebSQL: true,
        contextIsolation: false,
        javascript: true,
        //sandbox: false,
        // TODO: get rid of the remote module in renderers
        enableRemoteModule: true,
        worldSafeExecuteJavaScript: true,
      },
      icon: resolve(
        app.getAppPath(),
        `static/${isNightly ? 'nightly-icons' : 'icons'}/icon.png`,
      ),
      show: false,
    });
    require("@electron/remote/main").enable(this.win.webContents);

    this.incognito = incognito;

    this.viewManager = new ViewManager(this, incognito);

    runMessagingService(this);

    const windowDataPath = getPath('window-data.json');

    let windowState: any = {};

    (async () => {
      try {
        // Read the last window state from file.
        windowState = JSON.parse(
          await promises.readFile(windowDataPath, 'utf8'),
        );
      } catch (e) {
        await promises.writeFile(windowDataPath, JSON.stringify({}));
      }

      // Merge bounds from the last window state to the current window options.
      if (windowState) {
        this.win.setBounds({...windowState.bounds});
      }

      if (windowState) {
        if (windowState.maximized) {
          this.win.maximize();
        }
        if (windowState.fullscreen) {
          this.win.setFullScreen(true);
        }
      }
      this.initWin(windowState, windowDataPath, incognito);
    })();
  }
    
  public initWin = (windowState: any, windowDataPath: string, incognito: boolean) => {
    this.win.show();
    // Update window bounds on resize and on move when window is not maximized.
    this.win.on('resize', () => {
      if (!this.win.isMaximized()) {
        windowState.bounds = this.win.getBounds();
      }
    });

    this.win.on('move', () => {
      if (!this.win.isMaximized()) {
        windowState.bounds = this.win.getBounds();
      }
    });

    const resize = () => {
      setTimeout(() => {
        if (process.platform === 'linux') {
          this.viewManager.select(this.viewManager.selectedId, false, true);
        } else {
          this.viewManager.fixBounds();
        }
      });

      setTimeout(() => {
        this.webContents.send('tabs-resize');
      }, 500);

      this.webContents.send('tabs-resize');
    };

    this.win.on('maximize', resize);
    this.win.on('restore', resize);
    this.win.on('unmaximize', resize);

    this.win.on('close', (event: Electron.Event) => {
      const {object: settings} = Application.instance.settings;

      if (settings.warnOnQuit && this.viewManager.views.size > 1) {
        const answer = dialog.showMessageBoxSync(null, {
          type: 'question',
          title: `退出 ${app.name}?`,
          message: `退出 ${app.name}?`,
          detail: `有 ${this.viewManager.views.size} 打开的标签页.`,
          buttons: ['关闭', '取消'],
        });

        if (answer === 1) {
          event.preventDefault();
          return;
        }
      }

      // Save current window state to a file.
      windowState.maximized = this.win.isMaximized();
      windowState.fullscreen = this.win.isFullScreen();
      writeFileSync(windowDataPath, JSON.stringify(windowState));

      this.win.setBrowserView(null);

      this.viewManager.clear();

      if (Application.instance.windows.list.length === 1) {
        Application.instance.dialogs.destroy();
      }

      if (
        incognito &&
        Application.instance.windows.list.filter((x) => x.incognito).length ===
        1
      ) {
        Application.instance.sessions.clearCache('incognito');
        Application.instance.sessions.unloadIncognitoExtensions();
      }

      Application.instance.windows.list = Application.instance.windows.list.filter(
        (x) => x.win.id !== this.win.id,
      );
    });

    // this.webContents.openDevTools({ mode: 'detach' });

    if (process.env.NODE_ENV === 'development') {
      this.webContents.openDevTools({mode: 'detach'});
      this.win.loadURL('http://localhost:4444/app.html');
    } else {
      this.win.loadURL(join('file://', app.getAppPath(), 'build/app.html'));
    }
    this.win.on('ready-to-show', () => {
      // 等初始化完成后再显示
      this.win.show();
    })
    

    this.win.on('enter-full-screen', () => {
      this.send('fullscreen', true);
      this.viewManager.fixBounds();
    });

    this.win.on('leave-full-screen', () => {
      this.send('fullscreen', false);
      this.viewManager.fixBounds();
    });

    this.win.on('enter-html-full-screen', () => {
      this.viewManager.fullscreen = true;
      this.send('html-fullscreen', true);
    });

    this.win.on('leave-html-full-screen', () => {
      this.viewManager.fullscreen = false;
      this.send('html-fullscreen', false);
    });

    this.win.on('scroll-touch-begin', () => {
      this.send('scroll-touch-begin');
    });

    this.win.on('scroll-touch-end', () => {
      this.viewManager.selected.send('scroll-touch-end');
      this.send('scroll-touch-end');
    });

    this.win.on('focus', () => {
      Application.instance.windows.current = this;
    });
  }

  public get id() {
    return this.win.id;
  }

  public get webContents() {
    return this.win.webContents;
  }

  public fixDragging() {
    const bounds = this.win.getBounds();
    this.win.setBounds({
      height: bounds.height + 1,
    });
    this.win.setBounds(bounds);
  }

  public send(channel: string, ...args: any[]) {
    this.webContents.send(channel, ...args);
  }

  public updateTitle() {
    const {selected} = this.viewManager;
    if (!selected) return;

    this.win.setTitle(
      selected.title.trim() === ''
        ? app.name
        : `${selected.title} - ${app.name}`,
    );
  }
}
