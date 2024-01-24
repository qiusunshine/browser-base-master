import * as React from 'react';
import { observer } from 'mobx-react-lite';

import {
  Line,
  MenuItem,
  MenuItems,
  Content,
  Icon,
  MenuItemTitle,
  Shortcut,
  RightControl,
} from './style';
import store from '../../store';
import { ipcRenderer } from 'electron';
import * as remote from '@electron/remote';
import { WEBUI_BASE_URL, WEBUI_URL_SUFFIX } from '~/constants/files';
import { Switch } from '~/renderer/components/Switch';
import {
  ICON_FIRE,
  ICON_TOPMOST,
  ICON_TAB,
  ICON_WINDOW,
  ICON_INCOGNITO,
  ICON_HISTORY,
  ICON_BOOKMARKS,
  ICON_SETTINGS,
  ICON_EXTENSIONS,
  ICON_DOWNLOAD,
  ICON_FIND,
  ICON_PRINT, ICON_ARROWBACK, ICON_MULTRIN, ICON_DASHBOARD,
} from '~/renderer/constants/icons';
import { getWebUIURL } from '~/common/webui';

const onFindClick = () => {
  /*
  // TODO(sentialx): get selected tab
  ipcRenderer.send(
    `find-show-${store.windowId}`,
    store.tabs.selectedTab.id,
    store.tabs.selectedTab.findInfo,
  );*/
};

const onDarkClick = () => {
  store.settings.darkContents = !store.settings.darkContents;
  store.save();
};

const onPrintClick = () => {
  ipcRenderer.send('open-dev-tool', null);
  store.hide();
};

const onFindInPageClick = () => {
  ipcRenderer.send(`find-in-page-${store.windowId}`);
  store.hide();
};

const onAlwaysClick = () => {
  store.alwaysOnTop = !store.alwaysOnTop;
  remote.getCurrentWindow().setAlwaysOnTop(store.alwaysOnTop);
};

const onNewWindowClick = () => {
  ipcRenderer.send('create-window');
};

const onIncognitoClick = () => {
  ipcRenderer.send('create-window', true);
};

const addNewTab = (url: string) => {
  ipcRenderer.send(`add-tab-${store.windowId}`, {
    url,
    active: true,
  });
  store.hide();
};

const goToWebUIPage = (name: string) => () => {
  addNewTab(getWebUIURL(name));
};

const showDownloadDialog = () => {
  ipcRenderer.send("dialog-visibility-change", 'downloads-dialog', true)
}

const goToURL = (url: string) => () => {
  addNewTab(url);
};

const onUpdateClick = () => {
  //todo 暂时写死
  addNewTab("https://www.123pan.com/s/fajA-jgyQh.html");
};

export const QuickMenu = observer(() => {
  return (
    <div
      style={{
        display: 'flex',
        flexFlow: 'column',
      }}
    >
      <Content>
        <MenuItems>
          {store.updateAvailable && (
            <>
              <MenuItem onClick={onUpdateClick}>
                <Icon icon={ICON_FIRE}></Icon>
                <MenuItemTitle>{remote.app.name}有新版本了</MenuItemTitle>
              </MenuItem>
              <Line />
            </>
          )}
          <MenuItem onClick={onAlwaysClick}>
            <Icon icon={ICON_TOPMOST} />
            <MenuItemTitle>置顶窗口</MenuItemTitle>
            <RightControl>
              <Switch dense value={store.alwaysOnTop}></Switch>
            </RightControl>
          </MenuItem>
          <Line />
          <MenuItem onClick={goToWebUIPage('history')} arrow>
            <Icon icon={ICON_HISTORY} />
            <MenuItemTitle>历史记录</MenuItemTitle>
          </MenuItem>
          <MenuItem onClick={goToWebUIPage('bookmarks')} arrow>
            <Icon icon={ICON_BOOKMARKS} />
            <MenuItemTitle>书签</MenuItemTitle>
          </MenuItem>
          <MenuItem onClick={showDownloadDialog()}>
            <Icon icon={ICON_DOWNLOAD} />
            <MenuItemTitle>下载</MenuItemTitle>
          </MenuItem>
          <Line />
          <MenuItem onClick={goToWebUIPage('settings')}>
            <Icon icon={ICON_SETTINGS} />
            <MenuItemTitle>设置</MenuItemTitle>
          </MenuItem>
          {/* TODO: <MenuItem onClick={goToWebUIPage('extensions')}> */}
          <MenuItem
            onClick={goToURL(
              'https://microsoftedge.microsoft.com/addons/Microsoft-Edge-Extensions-Home?hl=zh-CN',
            )}
          >
            <Icon icon={ICON_EXTENSIONS} />
            <MenuItemTitle>扩展程序</MenuItemTitle>
          </MenuItem>
          <Line />
          <MenuItem onClick={onFindInPageClick}>
            <Icon icon={ICON_FIND} />
            <MenuItemTitle>页内查找</MenuItemTitle>
            <Shortcut>Ctrl+F</Shortcut>
          </MenuItem>
          <MenuItem onClick={onPrintClick}>
              <Icon icon={ICON_DASHBOARD} />
            <MenuItemTitle>开发者工具</MenuItemTitle>
            <Shortcut>Ctrl+Shift+I</Shortcut>
          </MenuItem>
        </MenuItems>
      </Content>
    </div>
  );
});
