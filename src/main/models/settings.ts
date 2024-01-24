import {ipcMain, nativeTheme, dialog} from 'electron';

import {DEFAULT_SETTINGS, DEFAULT_SEARCH_ENGINES} from '~/constants';

import {promises} from 'fs';

import {getPath, makeId} from '~/utils';
import {EventEmitter} from 'events';
import {runAdblockService, stopAdblockService} from '../services/adblock';
import {Application} from '../application';
import {WEBUI_BASE_URL} from '~/constants/files';
import {ISettings} from '~/interfaces';
import {resolve} from "path";
import {deletePath, pathExists, readFileAsText} from "~/utils/files";
import {ChromeUserAgent} from "~/main/user-agent";
import IpcMainEvent = Electron.IpcMainEvent;
import {filterVideo, recordUrlRequest} from "~/main/services/xiu-video";

export class Settings extends EventEmitter {
  public object = DEFAULT_SETTINGS;

  private queue: string[] = [];

  private loaded = false;

  public crxListenerMap = new Map<string, any[]>();

  public constructor() {
    super();

    ipcMain.on(
      'save-settings',
      (e, {settings}: { settings: string; incognito: boolean }) => {
        this.updateSettings(JSON.parse(settings));
      },
    );

    ipcMain.on('get-settings-sync', async (e) => {
      await this.onLoad();
      this.update();
      e.returnValue = this.object;
    });

    ipcMain.on('get-settings', async (e) => {
      await this.onLoad();
      this.update();
      e.sender.send('update-settings', this.object);
    });

    ipcMain.on('downloads-path-change', async () => {
      const {canceled, filePaths} = await dialog.showOpenDialog({
        defaultPath: this.object.downloadsPath,
        properties: ['openDirectory'],
      });

      if (canceled) return;

      this.object.downloadsPath = filePaths[0];

      this.addToQueue();
    });

    nativeTheme.on('updated', () => {
      this.update();
    });
    ipcMain.handle('hiker-crx-msg', async (event, extensionId, fnName, ...args) => {
      try {
        const extensions = Application.instance.sessions.extensions;
        const ext = (extensions || []).find(it => it.id == extensionId);
        if (ext && ext.manifest && ext.manifest.commands) {
          const commands = [];
          for (let key of Object.keys(ext.manifest.commands)) {
            commands.push({
              name: key,
              description: ext.manifest.commands[key].description,
              shortcut: (ext.manifest.commands[key].suggested_key || {}).default
            })
          }
          return commands;
        }
        const extensionsPath = getPath('extensions');
        const path = resolve(extensionsPath, extensionId);
        const manifestPath = resolve(path, 'manifest.json');
        const manifest = JSON.parse(
          await promises.readFile(manifestPath, 'utf8'),
        );
        if (manifest && manifest.commands) {
          const commands = [];
          for (let key of Object.keys(manifest.commands)) {
            commands.push({
              name: key,
              description: manifest.commands[key].description,
              shortcut: (manifest.commands[key].suggested_key || {}).default
            })
          }
          return commands;
        }
      } catch (e) {
        console.log(e);
      }
      return [];
    });

    // ipcMain.on('xiu-crx-add-listener', async (event: IpcMainEvent, extensionId, name, ...opts) => {
    //   if (this.crxListenerMap.has(name)) {
    //     this.crxListenerMap.get(name).push([extensionId, ...opts]);
    //   } else {
    //     this.crxListenerMap.set(name, [extensionId, ...opts]);
    //   }
    //   const contexts = [
    //     Application.instance.sessions.view,
    //     Application.instance.sessions.viewIncognito,
    //   ];
    //   contexts.forEach((e) => {
    //     if (name == "xiu.onBeforeRequest") {
    //       e.webRequest.onBeforeSendHeaders(opts[0], (details: Electron.OnBeforeSendHeadersListenerDetails, callback: any) => {
    //         callback({});
    //         if (this.crxListenerMap.has(name)) {
    //           let arr = this.crxListenerMap.get(name);
    //           arr = arr.filter(it => it[0] == extensionId);
    //           if(arr.length == 0) {
    //             return
    //           }
    //         }
    //         event.sender.send("crx-" + name, details);
    //       });
    //     } else if (name == "xiu.onBeforeRedirect") {
    //       e.webRequest.onBeforeRedirect(opts[0], (details: Electron.OnBeforeRedirectListenerDetails) => {
    //         if (this.crxListenerMap.has(name)) {
    //           let arr = this.crxListenerMap.get(name);
    //           arr = arr.filter(it => it[0] == extensionId);
    //           if(arr.length == 0) {
    //             return
    //           }
    //         }
    //         event.sender.send("crx-" + name, details);
    //       });
    //     } else if (name == "xiu.onBeforeSendHeaders") {
    //       e.webRequest.onBeforeSendHeaders(opts[0], (details: Electron.OnBeforeSendHeadersListenerDetails, callback: any) => {
    //         callback({});
    //         if (this.crxListenerMap.has(name)) {
    //           let arr = this.crxListenerMap.get(name);
    //           arr = arr.filter(it => it[0] == extensionId);
    //           if(arr.length == 0) {
    //             return
    //           }
    //         }
    //         event.sender.send("crx-" + name, details);
    //       });
    //     } else if (name == "xiu.onResponseStarted") {
    //       e.webRequest.onResponseStarted(opts[0], (details: Electron.OnResponseStartedListenerDetails) => {
    //         if (this.crxListenerMap.has(name)) {
    //           let arr = this.crxListenerMap.get(name);
    //           arr = arr.filter(it => it[0] == extensionId);
    //           if(arr.length == 0) {
    //             return
    //           }
    //         }
    //         event.sender.send("crx-" + name, details);
    //       });
    //     }
    //   });
    // });
    //
    // ipcMain.on('xiu-crx-remove-listener', async (e, extensionId, name, ...opts) => {
    //   if (this.crxListenerMap.has(name)) {
    //     let arr = this.crxListenerMap.get(name);
    //     arr = arr.filter(it => it[0] != extensionId);
    //     this.crxListenerMap.set(name, arr);
    //   }
    // });

    this.load();
  }

  private onLoad = async (): Promise<void> => {
    return new Promise((resolve) => {
      if (!this.loaded) {
        this.once('load', () => {
          resolve();
        });
      } else {
        resolve();
      }
    });
  };

  public update = () => {
    let themeSource = 'system';

    if (this.object.themeAuto) {
      this.object.theme = nativeTheme.shouldUseDarkColors
        ? 'wexond-dark'
        : 'wexond-light';
    } else {
      themeSource = this.object.theme === 'wexond-dark' ? 'dark' : 'light';
    }

    if (themeSource !== nativeTheme.themeSource) {
      nativeTheme.themeSource = themeSource as any;
    }

    Application.instance.dialogs.sendToAll('update-settings', this.object);

    for (const window of Application.instance.windows.list) {
      window.send('update-settings', this.object);

      window.viewManager.views.forEach(async (v) => {
        if (v.webContents.getURL().startsWith(WEBUI_BASE_URL)) {
          v.webContents.send('update-settings', this.object);
        }
      });
    }

    const contexts = [
      Application.instance.sessions.view,
      Application.instance.sessions.viewIncognito,
    ];

    contexts.forEach((e) => {
      e.webRequest.onBeforeSendHeaders({urls: ['<all_urls>']}, (details: Electron.OnBeforeSendHeadersListenerDetails, callback: any) => {
        const obj: { requestHeaders?: Record<string, string> } = {};
        const ua = details.requestHeaders["User-Agent"];
        if (ua && ua.includes("Electron")) {
          details.requestHeaders["User-Agent"] = ChromeUserAgent;
          obj.requestHeaders = details.requestHeaders;
        }
        const al = details.requestHeaders["Accept-Language"];
        if (al == "zh-CN") {
          details.requestHeaders["Accept-Language"] = "zh-CN,zh;q=0.9";
          obj.requestHeaders = details.requestHeaders;
        }
        recordUrlRequest(details);
        callback(obj);
      });
      e.webRequest.onHeadersReceived({urls: ['<all_urls>']}, (details,callback) => {
        filterVideo(details);
        callback({});
      });
      if (this.object.shield) {
        runAdblockService(e);
      } else {
        stopAdblockService(e);
      }
    });
  };

  private async load() {
    try {
      const file = await promises.readFile(getPath('settings.json'), 'utf8');
      const json = JSON.parse(file);

      if (typeof json.version === 'string') {
        // Migrate from 3.1.0
        Application.instance.storage.remove({
          scope: 'startupTabs',
          query: {},
          multi: true,
        });
      }

      if (typeof json.version === 'string' || json.version === 1) {
        json.searchEngines = DEFAULT_SEARCH_ENGINES;
      }

      if (json.themeAuto === undefined) {
        json.themeAuto = true;
      }

      if (json.overlayBookmarks !== undefined) {
        delete json.overlayBookmarks;
      }

      if (json.darkTheme !== undefined) {
        delete json.darkTheme;
      }

      this.object = {
        ...this.object,
        ...json,
        version: DEFAULT_SETTINGS.version,
      };

      this.loaded = true;

      this.addToQueue();
      this.emit('load');
    } catch (e) {
      this.loaded = true;
      this.emit('load');
    }

    this.update();
  }

  private async save() {
    try {
      await promises.writeFile(
        getPath('settings.json'),
        JSON.stringify({...this.object, version: DEFAULT_SETTINGS.version}),
      );

      if (this.queue.length >= 3) {
        for (let i = this.queue.length - 1; i > 0; i--) {
          this.removeAllListeners(this.queue[i]);
          this.queue.splice(i, 1);
        }
      } else {
        this.queue.splice(0, 1);
      }

      if (this.queue[0]) {
        this.emit(this.queue[0]);
      }
    } catch (e) {
      console.error(e);
    }
  }

  public async addToQueue() {
    const id = makeId(32);

    this.queue.push(id);

    this.update();

    if (this.queue.length === 1) {
      this.save();
    } else {
      this.once(id, () => {
        this.save();
      });
    }
  }

  public updateSettings(settings: Partial<ISettings>) {
    this.object = {...this.object, ...settings};

    this.addToQueue();
  }
}
