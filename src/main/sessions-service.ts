import {session, ipcMain, app, dialog} from 'electron';
import {getPath, makeId} from '~/utils';
import {promises, existsSync} from 'fs';
import {resolve, basename, parse, extname} from 'path';
import {Application} from './application';
import {registerProtocol} from './models/protocol';
import * as url from 'url';
import {
  IDownloadItem,
  BrowserActionChangeType,
  IElectronDownloadItem,
} from '~/interfaces';
import {getCrxIdByKey, parseCrx} from '~/utils/crx';
import {pathExists, deletePath} from '~/utils/files';
import {extractZip} from '~/utils/zip';
import {requestPermission} from './dialogs/permissions';
import * as rimraf from 'rimraf';
import {promisify} from 'util';
import {ElectronChromeExtensions} from "electron-chrome-extensions";
import * as Electron from "electron";
import tab from "~/renderer/views/app/components/Tab";

const rf = promisify(rimraf);

// TODO: sessions should be separate.  This structure actually doesn't make sense.
export class SessionsService {
  public view = session.fromPartition('persist:view');
  public viewIncognito = session.fromPartition('view_incognito');

  public incognitoExtensionsLoaded = false;
  public extensionsLoaded = false;

  public extensions: Electron.Extension[] = [];

  public chromeExtensions: ElectronChromeExtensions;

  public constructor() {
    registerProtocol(this.view);
    registerProtocol(this.viewIncognito);

    this.clearCache('incognito');

    if (process.env.ENABLE_EXTENSIONS) {
      // extensions.initializeSession(
      //   this.view,
      //   `${app.getAppPath()}/build/extensions-preload.bundle.js`,
      // );

      ipcMain.on('load-extensions', () => {
        this.loadExtensions();
      });

      ipcMain.handle('get-extensions', () => {
        return this.extensions;
      });
      let modulePath;
      if (process.env.NODE_ENV === 'development') {
        modulePath = require('path').join(require('path').dirname(__dirname), 'node_modules/electron-chrome-extensions');
      } else {
        modulePath = require('path').join(__dirname, 'node_modules/electron-chrome-extensions');
      }
      this.chromeExtensions = new ElectronChromeExtensions({
        modulePath: modulePath,
        session: this.view,
        assignTabDetails(details: chrome.tabs.Tab, tab: Electron.WebContents) {

        },
        createTab(details) {
          return new Promise(resolve1 => {
            const view = (Application.instance.windows.list
              .find((x) => x.win.id === details.windowId) || Application.instance.windows.current)
              .viewManager.create(details, true, true);
            return [view.webContents, view.window.win];
          })
        },
        selectTab(tab, browserWindow) {
          (Application.instance.windows.list
            .find((x) => x.win.id === browserWindow.id) || Application.instance.windows.current)
            .viewManager.select(tab.id, true, false)
        },
        removeTab(tab, browserWindow) {
          (Application.instance.windows.list
            .find((x) => x.win.id === browserWindow.id) || Application.instance.windows.current)
            .viewManager.removeByTabId(tab.id);
        },
        createWindow(details) {
          return new Promise(resolve1 => {
            const win = Application.instance.windows.open(details.incognito);
            if (details.url) {
              if (typeof details.url === "string") {
                win.win.loadURL(details.url);
              } else {
                win.win.loadURL(details.url[0]);
              }
            }
            return win;
          })
        },
        removeWindow(window: Electron.BrowserWindow) {
          window.close();
        }
      });
      // if(this.view.getPreloads()) {
      //   this.view.setPreloads(this.view.getPreloads().reverse());
      // }
    }

    /*
    // TODO:
    ipcMain.handle(`inspect-extension`, (e, incognito, id) => {
      const context = incognito ? this.extensionsIncognito : this.extensions;
      context.extensions[id].backgroundPage.webContents.openDevTools();
    });
    */

    this.view.setPermissionRequestHandler(
      async (webContents, permission, callback, details) => {
        const window = Application.instance.windows.findByBrowserView(
          webContents.id,
        );

        if (webContents.id !== window.viewManager.selectedId) return;

        if (permission === 'fullscreen') {
          callback(true);
        } else {
          try {
            const {hostname} = url.parse(details.requestingUrl);
            const perm: any = await Application.instance.storage.findOne({
              scope: 'permissions',
              query: {
                url: hostname,
                permission,
                mediaTypes: JSON.stringify(details.mediaTypes) || '',
              },
            });

            if (!perm) {
              const response = await requestPermission(
                window.win,
                permission,
                webContents.getURL(),
                details,
                webContents.id,
              );

              callback(response);

              await Application.instance.storage.insert({
                scope: 'permissions',
                item: {
                  url: hostname,
                  permission,
                  type: response ? 1 : 2,
                  mediaTypes: JSON.stringify(details.mediaTypes) || '',
                },
              });
            } else {
              callback(perm.type === 1);
            }
          } catch (e) {
            callback(false);
          }
        }
      },
    );

    const getDownloadItem = (
      item: Electron.DownloadItem,
      id: string,
    ): IDownloadItem => ({
      fileName: basename(item.savePath),
      receivedBytes: item.getReceivedBytes(),
      totalBytes: item.getTotalBytes(),
      savePath: item.savePath,
      url: item.getURL(),
      paused: item.isPaused(),
      id,
    });

    const getElectronDownloadItem = (
      item: Electron.DownloadItem,
      webContents: Electron.WebContents,
      id: string,
    ): IElectronDownloadItem => ({
      item,
      webContents,
      id,
    });

    const downloadsDialog = () =>
      Application.instance.dialogs.getDynamic('downloads-dialog')?.browserView
        ?.webContents;

    const downloads: IDownloadItem[] = [];
    const electronDownloads: IElectronDownloadItem[] = [];

    ipcMain.on('download-pause', (e, id) => {
      const {item} = electronDownloads.find((x) => x.id === id);
      item.pause();
    });

    ipcMain.on('download-resume', (e, id) => {
      const {item} = electronDownloads.find((x) => x.id === id);
      item.resume();
    });

    ipcMain.on('download-cancel', (e, id) => {
      const {item} = electronDownloads.find((x) => x.id === id);
      item.cancel();
    });

    ipcMain.handle('load-extension-from-crx', async (e, id) => {
      const dialogRes = await dialog.showOpenDialog({
        filters: [{name: '选择crx扩展程序文件', extensions: ['crx', 'zip']}]
      });
      try {
        let ex;
        const item = {savePath: dialogRes.filePaths[0]};
        if (dialogRes.filePaths[0].endsWith(".crx")) {
          ex = await installItem(item as any, true);
        } else {
          const crxBuf = await promises.readFile(item.savePath);
          const dir = item.savePath.replace(".zip", "");
          await extractZip(crxBuf, dir);
          const manifestPath = resolve(dir, 'manifest.json');
          const manifest = JSON.parse(
            await promises.readFile(manifestPath, 'utf8'),
          );
          if (manifest && manifest.key) {
            const crx = {zip: crxBuf, id: getCrxIdByKey(manifest.key)};
            ex = await installItemByCrxInfo(crx, true);
          } else {
            ex = await installItem(item as any, true);
          }
        }
        if (ex) {
          for (const window of Application.instance.windows.list) {
            window.send('load-browserAction', ex);
          }
        }
        return ex;
      } catch (err) {
        console.error(err);
      }
      return null;
    });

    const saveNewTabUrl = (id: string, manifest: any, extension: Electron.Extension) => {
      if (extension && manifest.chrome_url_overrides) {
        let newtab = manifest.chrome_url_overrides.newtab;
        if (newtab) {
          newtab = "chrome-extension://" + id + "/" + newtab;
          let tabs0 = Application.instance.settings.object.newtab;
          if (tabs0) {
            let tabs1 = tabs0.split("\n");
            tabs1.unshift(newtab);
            tabs0 = tabs1.join("\n");
          } else {
            tabs0 = newtab;
          }
          //这里加载的url和记忆的不一样，不知道为什么重启软件和这里得到的id和url不一样
          let nowTabUrl = "chrome-extension://" + extension.id + "/" + manifest.chrome_url_overrides.newtab;
          console.log('update-newtab-url', newtab, nowTabUrl);
          Application.instance.settings.updateSettings({newtab: tabs0});
          Application.instance.windows.broadcast('update-newtab-url', tabs0, nowTabUrl);
          Application.instance.tempTabUrl = nowTabUrl;
        }
      }
    }

    ipcMain.handle('load-extension-from-dir', async (e, id) => {
      const dialogRes = await dialog.showOpenDialog({
        filters: [{name: '选择扩展程序文件夹', extensions: []}],
        properties: ["openDirectory"]
      });
      try {
        const item = {savePath: dialogRes.filePaths[0]};
        const dir = item.savePath;
        const manifestPath1 = resolve(dir, 'manifest.json');
        const manifest = JSON.parse(
          await promises.readFile(manifestPath1, 'utf8'),
        );
        if (manifest && manifest.key) {
          const id = getCrxIdByKey(manifest.key);
          const extensionsPath = getPath('extensions');
          const path = resolve(extensionsPath, id);
          if (await pathExists(path)) {
            await deletePath(path);
          }
          await require('fs-extra').copy(dir, path);
          const extension = await this.view.loadExtension(path, {allowFileAccess: true});
          console.log(extension);
          saveNewTabUrl(id, manifest, extension);
          if (extension) {
            for (const window of Application.instance.windows.list) {
              window.send('load-browserAction', extension);
            }
          }
          this.extensions = this.extensions.filter(it => it.id != extension.id);
          this.extensions.push(extension);
          return extension
        }
      } catch (err) {
        console.error(err);
      }
      return null;
    });

    const installItem = async (item: Electron.DownloadItem, force: Boolean = false): Promise<Electron.Extension> => {
      const crxBuf = await promises.readFile(item.savePath);
      const crxInfo = parseCrx(crxBuf);
      return installItemByCrxInfo(crxInfo, force);
    }

    const installItemByCrxInfo = async (crxInfo: any, force: Boolean = false): Promise<Electron.Extension> => {
      const extensionsPath = getPath('extensions');
      const path = resolve(extensionsPath, crxInfo.id);
      const manifestPath = resolve(path, 'manifest.json');

      if (await pathExists(path)) {
        if (force) {
          await deletePath(path);
        } else {
          console.log('Extension is already installed');
          return null;
        }
      }

      await extractZip(crxInfo.zip, path);
      const manifest = JSON.parse(
        await promises.readFile(manifestPath, 'utf8'),
      );
      if (manifest) {
        if (crxInfo.publicKey) {
          manifest.key = crxInfo.publicKey.toString('base64');
          await promises.writeFile(
            manifestPath,
            JSON.stringify(manifest, null, 2),
          );
        }
      }

      const extension = await this.view.loadExtension(path, {allowFileAccess: true});
      console.log(extension);
      if (manifest) {
        saveNewTabUrl(crxInfo.id, manifest, extension);
      }
      this.extensions = this.extensions.filter(it => it.id != extension.id);
      this.extensions.push(extension);
      return extension;
    }

    ipcMain.on('download-remove', (e, id) => {
      const electronDownloadsIndex = electronDownloads.findIndex(
        (x) => x.id === id,
      );

      const window = Application.instance.windows.findByBrowserView(
        electronDownloads[electronDownloadsIndex]?.webContents.id,
      );

      if (electronDownloadsIndex > -1) {
        electronDownloads.splice(electronDownloadsIndex, 1);
      }

      const downloadsIndex = downloads.findIndex((x) => x.id === id);
      if (downloadsIndex > -1) {
        downloads.splice(downloadsIndex, 1);
      }

      downloadsDialog()?.send('download-removed', id);
      window?.send('download-removed', id);

      if (electronDownloads.length === 0 && downloads.length === 0) {
        Application.instance.dialogs.getDynamic('downloads-dialog').hide();
      }
    });

    ipcMain.on('download-open-when-done', (e, id) => {
      const index = downloads.indexOf(downloads.find((x) => x.id === id));

      downloads[index].openWhenDone = !downloads[index].openWhenDone;

      downloadsDialog()?.send(
        'download-open-when-done-change',
        downloads[index],
      );
    });

    ipcMain.handle('get-downloads', () => {
      return downloads;
    });

    // TODO(sentialx): clean up the download listeners
    this.view.on('will-download', (event, item, webContents) => {
      const fileName = item.getFilename();
      const id = makeId(32);
      const window = Application.instance.windows.findByBrowserView(
        webContents.id,
      );

      if (!Application.instance.settings.object.downloadsDialog) {
        const downloadsPath =
          Application.instance.settings.object.downloadsPath;
        let i = 1;
        let savePath = resolve(downloadsPath, fileName);

        while (existsSync(savePath)) {
          const {name, ext} = parse(fileName);
          savePath = resolve(downloadsPath, `${name} (${i})${ext}`);
          i++;
        }

        item.savePath = savePath;
      }

      const downloadItem = getDownloadItem(item, id);
      downloads.push(downloadItem);

      const electronDownloadItem = getElectronDownloadItem(
        item,
        webContents,
        id,
      );
      electronDownloads.push(electronDownloadItem);

      downloadsDialog()?.send('download-started', downloadItem);
      window.send('download-started', downloadItem);
      window.send('show-download-dialog');

      item.on('updated', (event, state) => {
        if (state === 'interrupted') {
          downloadsDialog()?.send('download-paused', id);
          window.send('download-paused', id);
          console.log('Download is interrupted but can be resumed');
        } else if (state === 'progressing') {
          if (item.isPaused()) {
            downloadsDialog()?.send('download-paused', id);
            window.send('download-paused', id);
            console.log('Download is paused');
          }
        }

        const data = getDownloadItem(item, id);

        downloadsDialog()?.send('download-progress', data);
        window.send('download-progress', data);

        Object.assign(downloadItem, data);
        if (webContents.getURL() == item.getURL()) {
          webContents.goBack();
        }
      });
      item.once('done', async (event, state) => {
        if (state === 'completed') {
          const dialog = downloadsDialog();
          dialog?.send('download-completed', id);
          window.send('download-completed', id, !!dialog);

          downloadItem.completed = true;

          if (process.env.ENABLE_EXTENSIONS && extname(fileName) === '.crx') {
            const extension = await installItem(item, true);
            if (extension != null) {
              window.send('load-browserAction', extension);
            }
          }
        } else {
          downloadItem.completed = false;
          downloadItem.canceled = true;
          downloadsDialog()?.send('download-canceled', id);
          window.send('download-canceled', id);
          console.log(`Download failed: ${state}`);
        }
      });
    });

    session.defaultSession.on('will-download', (event, item, webContents) => {
      const id = makeId(32);
      const window = Application.instance.windows.list.find(
        (x) => x && x.webContents.id === webContents.id,
      );

      const downloadItem = getDownloadItem(item, id);
      downloads.push(downloadItem);

      const electronDownloadItem = getElectronDownloadItem(
        item,
        webContents,
        id,
      );
      electronDownloads.push(electronDownloadItem);

      downloadsDialog()?.send('download-started', downloadItem);
      window.send('download-started', downloadItem);
      window.send('show-download-dialog');

      item.on('updated', (event, state) => {
        if (state === 'interrupted') {
          downloadsDialog()?.send('download-paused', id);
          window.send('download-paused', id);
          console.log('Download is interrupted but can be resumed');
        } else if (state === 'progressing') {
          if (item.isPaused()) {
            downloadsDialog()?.send('download-paused', id);
            window.send('download-paused', id);
            console.log('Download is paused');
          }
        }

        const data = getDownloadItem(item, id);

        Object.assign(downloadItem, data);

        downloadsDialog()?.send('download-progress', data);
        window.send('download-progress', data);
      });
      item.once('done', async (event, state) => {
        const dialog = downloadsDialog();
        if (state === 'completed') {
          dialog?.send('download-completed', id);
          window.send('download-completed', id, !!dialog);

          downloadItem.completed = true;
        } else {
          downloadItem.completed = false;
          downloadItem.canceled = true;
          downloadsDialog()?.send('download-canceled', id);
          window.send('download-canceled', id);
          console.log(`Download failed: ${state}`);
        }
      });
    });

    ipcMain.on('clear-browsing-data', () => {
      this.clearCache('normal');
      this.clearCache('incognito');
    });
  }

  public clearCache(session: 'normal' | 'incognito') {
    const ses = session === 'incognito' ? this.viewIncognito : this.view;

    ses.clearCache().catch((err) => {
      console.error(err);
    });

    ses.clearStorageData({
      storages: [
        'appcache',
        'cookies',
        'filesystem',
        'indexdb',
        'localstorage',
        'shadercache',
        'websql',
        'serviceworkers',
        'cachestorage',
      ],
    });
  }

  public unloadIncognitoExtensions() {
    /*
    TODO(sentialx): unload incognito extensions
    this.incognitoExtensionsLoaded = false;
    */
  }

  // Loading extensions in an off the record BrowserContext is not supported.
  public async loadExtensions() {
    if (!process.env.ENABLE_EXTENSIONS) return;

    const context = this.view;

    if (this.extensionsLoaded) return;

    const extensionsPath = getPath('extensions');
    const dirs = await promises.readdir(extensionsPath);

    for (const dir of dirs) {
      try {
        const path = resolve(extensionsPath, dir);
        const extension = await context.loadExtension(path, {allowFileAccess: true});

        this.extensions.push(extension);

        for (const window of Application.instance.windows.list) {
          window.send('load-browserAction', extension);
        }
      } catch (e) {
        console.error(e);
      }
    }

    /*if (session === 'incognito') {
      this.incognitoExtensionsLoaded = true;
    }*/

    this.extensionsLoaded = true;
  }

  async uninstallExtension(id: string) {
    if (!process.env.ENABLE_EXTENSIONS) return;
    const newtab = Application.instance.settings.object.newtab;
    if (newtab) {
      let tabs = "";
      // let tabs = newtab.split("\n").filter(it => !it.includes(id)).join("\n");
      Application.instance.settings.updateSettings({newtab: tabs});
      Application.instance.windows.broadcast('update-settings', Application.instance.settings.object);
    }

    const extension = this.view.getExtension(id);
    if (!extension) return;
    this.extensions = this.extensions.filter(it => it.id != id);

    await this.view.removeExtension(id);

    await rf(extension.path);

    const extensionsPath = getPath('extensions');
    const path = resolve(extensionsPath, id);
    await rf(path);
  }

  public onCreateTab = async (details: chrome.tabs.CreateProperties) => {
    const view = Application.instance.windows.list
      .find((x) => x.win.id === details.windowId)
      .viewManager.create(details, false, true);

    return view.id;
  };

  public onBrowserActionUpdate = (
    extensionId: string,
    action: BrowserActionChangeType,
    details: any,
  ) => {
    Application.instance.windows.list.forEach((w) => {
      w.send('set-browserAction-info', extensionId, action, details);
    });
  };
}
