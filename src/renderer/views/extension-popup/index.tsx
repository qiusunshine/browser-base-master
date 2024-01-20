import {ipcRenderer} from 'electron';
import {resolve} from 'path';
import * as remote from '@electron/remote';

const getWebContentsId = () => ipcRenderer.sendSync('get-webcontents-id');

const app = document.getElementById('app');
const container = document.getElementById('container');

let webview: Electron.WebviewTag;
let visible = false;

const removeWebview = () => {
  if (webview) {
    container.removeChild(webview);
    container.style.width = 0 + 'px';
    container.style.height = 0 + 'px';
  }
};

const _hide = () => {
  app.classList.remove('visible');
  removeWebview();
};

const hide = () => {
  visible = false;
  _hide();
  setTimeout(() => {
    ipcRenderer.send(`hide-${getWebContentsId()}`);
  });
};

const show = () => {
  if (!app.classList.contains("visible")) {
    app.classList.add('visible');
  }
  visible = true;
};

const createWebview = (url: string, inspect: boolean) => {
  webview = document.createElement('webview');

  webview.setAttribute('partition', 'persist:view');
  webview.setAttribute('src', url);
  webview.setAttribute(
    'preload',
    `file:///${resolve(
      remote.app.getAppPath(),
      'build',
      'popup-preload.bundle.js',
    )}`,
  );

  webview.style.width = '100%';
  webview.style.height = '100%';
  webview.style.borderRadius = '8px';

  webview.addEventListener('dom-ready', () => {
    remote.webContents
      .fromId(webview.getWebContentsId())
      .addListener('context-menu', (e, params) => {
        const menu = remote.Menu.buildFromTemplate([
          {
            label: '检查...',
            click: () => {
              webview.inspectElement(params.x, params.y);
            },
          },
        ]);

        menu.popup();
      });

    if (inspect) {
      webview.openDevTools();
    }
  });
  let lastWidth = -1;
  let lastHeight = -1;
  let lastWidthChange = false;
  let lastHeightChange = false;

  webview.addEventListener('ipc-message', (e) => {
    if (e.channel === 'webview-size') {
      let [width, height] = e.args;
      const goWidth = width === 0 ? 1 : width;
      const goHeight = height === 0 ? 1 : height;
      height = height === 0 ? 1 : height;
      let widthChange = lastWidth != width;
      let heightChange = lastHeight != height;
      const changeNow = () => {
        lastHeight = height;
        lastWidth = width;
        container.style.width = goWidth + 'px';
        container.style.height = goHeight + 'px';
        ipcRenderer.send(`bounds-${getWebContentsId()}`, goWidth + 40, goHeight + 40);
      }
      //防抖动
      if (widthChange && heightChange) {
        changeNow();
      } else if (widthChange) {
        if (lastHeightChange) {
          changeNow();
        }
      } else if (heightChange) {
        if (lastWidthChange) {
          changeNow();
        }
      }
      lastWidthChange = widthChange;
      lastHeightChange = heightChange;
      show();
      webview.focus();
    } else if (e.channel === 'webview-blur') {
      if (visible && !webview.isDevToolsOpened()) {
        hide();
      }
    }
  });

  container.appendChild(webview);
};

ipcRenderer.on('data', (e, data) => {
  const {url, inspect} = data;
  console.log(url);
  createWebview(url, inspect);
});

ipcRenderer.send(`loaded-${getWebContentsId()}`);
