import {BrowserWindow} from 'electron';
import {Application} from '../application';
import {DIALOG_MARGIN_TOP, DIALOG_MARGIN} from '~/constants/design';
import {IBookmark} from '~/interfaces';

export const showBlockDialog = (
  browserWindow: BrowserWindow,
  x: number,
  y: number,
  data: {
    data: [{
      url: string;
      filter: string;
    }],
    count: number
  },
) => {
  const dialog = Application.instance.dialogs.show({
    name: 'show-block',
    browserWindow,
    getBounds: () => ({
      width: 466,
      height: 99999,
      x: x - 466 + DIALOG_MARGIN,
      y: y - DIALOG_MARGIN_TOP,
    }),
    onWindowBoundsUpdate: () => dialog.hide(),
  });

  if (!dialog) return;

  dialog.on('loaded', (e) => {
    e.reply('data', data);
  });
};
