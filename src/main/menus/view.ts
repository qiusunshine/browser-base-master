import { AppWindow } from '../windows';
import {
  clipboard,
  nativeImage,
  Menu,
  session,
  ipcMain,
  BrowserView,
} from 'electron';
import { isURL, prefixHttp } from '~/utils';
import { saveAs, viewSource, printPage } from './common-actions';

export const getViewMenu = (
  appWindow: AppWindow,
  params: Electron.ContextMenuParams,
  webContents: Electron.WebContents,
) => {
  let menuItems: Electron.MenuItemConstructorOptions[] = [];

  if (params.linkURL !== '') {
    menuItems = menuItems.concat([
      {
        label: '在新标签页打开链接',
        click: () => {
          appWindow.viewManager.create(
            {
              url: params.linkURL,
              active: false,
            },
            true,
          );
        },
      },
      {
        type: 'separator',
      },
      {
        label: '复制链接地址',
        click: () => {
          clipboard.clear();
          clipboard.writeText(params.linkURL);
        },
      },
      {
        type: 'separator',
      },
    ]);
  }

  if (params.hasImageContents) {
    menuItems = menuItems.concat([
      {
        label: '在新标签页打开图片',
        click: () => {
          appWindow.viewManager.create(
            {
              url: params.srcURL,
              active: false,
            },
            true,
          );
        },
      },
      {
        label: '复制图片',
        click: () => webContents.copyImageAt(params.x, params.y),
      },
      {
        label: '复制图片地址',
        click: () => {
          clipboard.clear();
          clipboard.writeText(params.srcURL);
        },
      },
      {
        label: '保存图片为...',
        click: () => {
          appWindow.webContents.downloadURL(params.srcURL);
        },
      },
      {
        type: 'separator',
      },
    ]);
  }

  if (params.isEditable) {
    menuItems = menuItems.concat([
      {
        role: 'undo',
        accelerator: 'CmdOrCtrl+Z',
        label: '撤销',
      },
      {
        role: 'redo',
        accelerator: 'CmdOrCtrl+Shift+Z',
        label: '重做',
      },
      {
        type: 'separator',
      },
      {
        role: 'cut',
        accelerator: 'CmdOrCtrl+X',
        label: '剪切',
      },
      {
        role: 'copy',
        accelerator: 'CmdOrCtrl+C',
        label: '复制',
      },
      {
        role: 'pasteAndMatchStyle',
        accelerator: 'CmdOrCtrl+V',
        label: '粘贴',
      },
      {
        role: 'paste',
        accelerator: 'CmdOrCtrl+Shift+V',
        label: '粘贴为文本',
      },
      {
        role: 'selectAll',
        accelerator: 'CmdOrCtrl+A',
        label: '选择全部',
      },
      {
        type: 'separator',
      },
    ]);
  }

  if (!params.isEditable && params.selectionText !== '') {
    menuItems = menuItems.concat([
      {
        role: 'copy',
        accelerator: 'CmdOrCtrl+C',
        label: '复制'
      },
      {
        type: 'separator',
      },
    ]);
  }

  if (params.selectionText !== '') {
    const trimmedText = params.selectionText.trim();

    if (isURL(trimmedText)) {
      menuItems = menuItems.concat([
        {
          label: '转到 ' + trimmedText,
          click: () => {
            appWindow.viewManager.create(
              {
                url: prefixHttp(trimmedText),
                active: true,
              },
              true,
            );
          },
        },
        {
          type: 'separator',
        },
      ]);
    }
  }

  if (
    !params.hasImageContents &&
    params.linkURL === '' &&
    params.selectionText === '' &&
    !params.isEditable
  ) {
    menuItems = menuItems.concat([
      {
        label: '返回',
        accelerator: 'Alt+Left',
        enabled: webContents.canGoBack(),
        click: () => {
          webContents.goBack();
        },
      },
      {
        label: '前进',
        accelerator: 'Alt+Right',
        enabled: webContents.canGoForward(),
        click: () => {
          webContents.goForward();
        },
      },
      {
        label: '重新加载',
        accelerator: 'CmdOrCtrl+R',
        click: () => {
          webContents.reload();
        },
      },
      {
        type: 'separator',
      },
      {
        label: '保存页面为...',
        accelerator: 'CmdOrCtrl+S',
        click: async () => {
          saveAs();
        },
      },
      {
        label: '打印',
        accelerator: 'CmdOrCtrl+P',
        click: async () => {
          printPage();
        },
      },
      {
        type: 'separator',
      },
      {
        label: '查看网页源代码',
        accelerator: 'CmdOrCtrl+U',
        click: () => {
          viewSource();
        },
      },
    ]);
  }

  menuItems.push({
    label: '检查',
    accelerator: 'CmdOrCtrl+Shift+I',
    click: () => {
      webContents.inspectElement(params.x, params.y);

      if (webContents.isDevToolsOpened()) {
        webContents.devToolsWebContents.focus();
      }
    },
  });

  return Menu.buildFromTemplate(menuItems);
};
