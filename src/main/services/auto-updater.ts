import { ipcMain } from 'electron';
import { Application } from '../application';

export const runAutoUpdaterService = () => {
  let updateAvailable = false;

  ipcMain.handle('is-update-available', () => {
    return updateAvailable;
  });

  ipcMain.on('update-check', () => {
    // todo check from cloud
    // updateAvailable = true;
    // for (const window of Application.instance.windows.list) {
    //   window.send('update-available');
    //   Application.instance.dialogs
    //     .getDynamic('menu')
    //     ?.browserView?.webContents?.send('update-available');
    // }
  });
};
