import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { ThemeProvider } from 'styled-components';

import { StyledApp, Title, Row, Label, Buttons } from './style';
import store from '../../store';
import { Input, Dropdown } from '~/renderer/components/Input';
import { Button } from '~/renderer/components/Button';
import { ipcRenderer } from 'electron';
import { getBookmarkTitle } from '~/renderer/views/bookmarks/utils';
import { UIStyle } from '~/renderer/mixins/default-styles';
const { BrowserWindow } = require('@electron/remote');
import * as remote from '@electron/remote';

const onDone = () => {
  store.hide();
};

const updateBookmark = () => {
  if (!store.bookmark) return;
  ipcRenderer.send('bookmarks-update', store.bookmark._id, store.bookmark);
};

const onChange = () => {
  store.bookmark.title = store.titleRef.current.value;
  updateBookmark();
};

const onDropdownClick = (e: React.MouseEvent<HTMLDivElement>) => {
  const { left, top, height } = e.currentTarget.getBoundingClientRect();
  const menu = remote.Menu.buildFromTemplate([
    ...store.folders.map((folder) => ({
      label: getBookmarkTitle(folder),
      click: () => {
        store.currentFolder = folder;
        store.bookmark.parent = folder._id;
        updateBookmark();
      },
    })),
  ]);

  const { x, y } = remote.BrowserWindow.fromWebContents(
    remote.getCurrentWebContents(),
  ).getBounds();

  menu.popup({ x: x + left, y: y + top + height });
};

const onRemove = () => {
  if (!store.bookmark) return;
  ipcRenderer.send('bookmarks-remove', [store.bookmark._id]);
  store.hide();
};

export const App = observer(() => {
  return (
    <ThemeProvider theme={{ ...store.theme }}>
      <StyledApp visible={store.visible}>
        <UIStyle />
        <Title>{store.dialogTitle}</Title>
        <Row>
          <Label>名称</Label>
          <Input
            tabIndex={0}
            className="textfield"
            ref={store.titleRef}
            onChange={onChange}
          />
        </Row>
        <Row>
          <Label>文件夹</Label>
          <Dropdown
            dark={store.theme['dialog.lightForeground']}
            tabIndex={1}
            className="dropdown"
            onMouseDown={onDropdownClick}
          >
            {store.currentFolder && getBookmarkTitle(store.currentFolder)}
          </Dropdown>
        </Row>
        <Buttons>
          <Button onClick={onDone}>完成</Button>
          <Button
            onClick={onRemove}
            background={
              store.theme['dialog.lightForeground']
                ? 'rgba(255, 255, 255, 0.08)'
                : 'rgba(0, 0, 0, 0.08)'
            }
            foreground={
              store.theme['dialog.lightForeground'] ? 'white' : 'black'
            }
          >
            删除
          </Button>
        </Buttons>
      </StyledApp>
    </ThemeProvider>
  );
});