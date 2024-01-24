import { BrowserWindow } from 'electron';
import { Application } from '../application';
import { DIALOG_MARGIN_TOP, DIALOG_MARGIN } from '~/constants/design';

export const showVideoDialog = (
  browserWindow: BrowserWindow,
  x: number,
  y: number,
  data?: {
    videoUrls?: string[];
    tabId: number
  },
) => {
  if (!data) {
    const {
      videoUrls,
      id,
    } = Application.instance.windows.current.viewManager.selected;
    data = {
      videoUrls,
      tabId: id
    };
  }

  const dialog = Application.instance.dialogs.show({
    name: 'show-video',
    browserWindow,
    getBounds: () => ({
      width: 144,
      height: 350,
      x: x - 84,
      y: y - DIALOG_MARGIN_TOP,
    }),
    onWindowBoundsUpdate: () => dialog.hide(),
  });

  if (!dialog) return;

  dialog.on('loaded', (e) => {
    e.reply('data', data);
  });
};
