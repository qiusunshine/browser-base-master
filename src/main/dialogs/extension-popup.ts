import { BrowserWindow } from 'electron';
import { Application } from '../application';
import { DIALOG_MARGIN_TOP, DIALOG_MARGIN } from '~/constants/design';

export const showExtensionDialog = (
  browserWindow: BrowserWindow,
  x: number,
  y: number,
  url: string,
  inspect = false,
) => {
  if (!process.env.ENABLE_EXTENSIONS) return;

  let height = 512;
  let width = 512;
  console.log("showExtensionDialog:", url);

  const dialog = Application.instance.dialogs.show({
    name: 'extension-popup',
    browserWindow,
    getBounds: () => {
      return {
        x: x - width + DIALOG_MARGIN,
        y: y - DIALOG_MARGIN_TOP,
        height: Math.min(1024, height),
        width: Math.min(1024, width),
      };
    },
    onWindowBoundsUpdate: () => dialog.hide(),
  });
  console.log("dialog:   ", dialog);

  //if (!dialog) return;

  dialog.on('bounds', (e, w, h) => {
    width = w;
    height = h;
    dialog.rearrange();
  });

  dialog.browserView.webContents.on(
    'will-attach-webview',
    (e, webPreferences, params) => {
      webPreferences.sandbox = false;
      webPreferences.nodeIntegration = false;
      webPreferences.contextIsolation = false;
      webPreferences.allowRunningInsecureContent = true;
      webPreferences.webSecurity = false;
      webPreferences.javascript = true;
      webPreferences.enableWebSQL = true;
      webPreferences.enablePreferredSizeMode = true;
      webPreferences.plugins = true;
      webPreferences.nodeIntegrationInWorker = false;
      webPreferences.nodeIntegrationInSubFrames = false;
    },
  );

  dialog.on('loaded', (e) => {
    e.reply('data', { url, inspect });
  });
};
