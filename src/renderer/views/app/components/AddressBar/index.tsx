import * as React from 'react';
import {observer} from 'mobx-react-lite';

import store from '../../store';
import {isURL} from '~/utils';
import {callViewMethod} from '~/utils/view';
import {clipboard, ipcRenderer} from 'electron';
import {ToolbarButton} from '../ToolbarButton';
import {StyledAddressBar, InputContainer, Input, Text} from './style';
import {ICON_SEARCH} from '~/renderer/constants';
import {SiteButtons} from '../SiteButtons';
import {DEFAULT_TITLEBAR_HEIGHT} from '~/constants/design';
import MyInput from "./input";
import * as remote from "@electron/remote";

const onMouseDown = (e: React.MouseEvent<HTMLInputElement>) => {
  e.stopPropagation();

  if (!store.isCompact) return;

  store.addressbarTextVisible = false;
  store.addressbarFocused = true;
};

const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
  store.addressbarTextVisible = false;
  store.addressbarFocused = true;

  if (store.tabs.selectedTab) {
    store.tabs.selectedTab.addressbarFocused = true;
  }

  if (store.isCompact) {
    // ipcRenderer.send(`window-fix-dragging-${store.windowId}`);
    e.currentTarget.select();
  }
};

const onSelect = (e: React.MouseEvent<HTMLInputElement>) => {
  if (store.tabs.selectedTab) {
    store.tabs.selectedTab.addressbarSelectionRange = [
      e.currentTarget.selectionStart,
      e.currentTarget.selectionEnd,
    ];
  }
};

const onMouseUp = (e: React.MouseEvent<HTMLInputElement>) => {
  if (
    !store.isCompact &&
    window.getSelection().toString().length === 0 &&
    !store.mouseUpped
  ) {
    e.currentTarget.select();
  }

  store.mouseUpped = true;
};

const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Escape') {
    store.tabs.selectedTab.addressbarValue = null;
  }

  if (e.key === 'Escape') {
    const target = e.currentTarget;
    requestAnimationFrame(() => {
      target.select();
    });
  }

  if (e.key === 'Enter') {
    enterNow(e.currentTarget.value, e.currentTarget);
  }
};

const enterNow = (value: string, target: any) => {
  let url = value;
  if (isURL(value)) {
    url = value.indexOf('://') === -1 ? `http://${value}` : value;
  } else {
    url = store.settings.searchEngine.url.replace('%s', value);
  }
  store.tabs.selectedTab.addressbarValue = url;
  callViewMethod(store.tabs.selectedTabId, 'loadURL', url);
  blurNow(target);
}

let addressbarRef: HTMLDivElement;

const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  changeText(e.currentTarget.value, e.currentTarget.selectionStart, true);
};

const changeText = (t: string, cursorPos: any, showSearch: boolean) => {
  if (store.tabs.selectedTab) {
    store.tabs.selectedTab.addressbarValue = t;
  }

  const {left, width} = addressbarRef.getBoundingClientRect();

  if (t.trim() !== '' && showSearch) {
    ipcRenderer.send(`search-show-${store.windowId}`, {
      text: t,
      cursorPos: cursorPos,
      x: left,
      y: !store.isCompact ? DEFAULT_TITLEBAR_HEIGHT : 0,
      width: width,
    });
    store.addressbarEditing = true;
  }
}
const blurNow = (target: any) => {
  //console.log("blurNow", target);
  target.blur();
  window.getSelection().removeAllRanges();
  store.addressbarTextVisible = true;
  store.addressbarFocused = false;
  store.mouseUpped = false;

  // if (store.isCompact && !store.addressbarEditing)
  //   ipcRenderer.send(`window-fix-dragging-${store.windowId}`);

  const {selectedTab} = store.tabs;

  if (selectedTab) {
    selectedTab.addressbarFocused = false;
  }
};

const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
  blurNow(e.currentTarget);
};

const onContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
  const menu = remote.Menu.buildFromTemplate([
    {
      label: '复制',
      click: () => {
        clipboard.clear();
        clipboard.writeText(store.addressbarValue);
      },
    },
    {
      label: '粘贴',
      click: () => {
        let t = clipboard.readText();
        if (t == null) {
          t = "";
        }
        changeText(t, t.length, true);
      },
    },
    {
      label: '粘贴并前往',
      click: () => {
        let t = clipboard.readText();
        if (t == null) {
          t = "";
        }
        changeText(t, t.length, false);
        enterNow(t, store.inputRef);
      },
    },
  ]);

  menu.popup();
};

export const AddressBar = observer(() => {
  return (
    <StyledAddressBar
      ref={(r) => (addressbarRef = r)}
      focus={store.addressbarFocused}
    >
      <ToolbarButton
        toggled={false}
        icon={ICON_SEARCH}
        size={16}
        dense
        iconStyle={{transform: 'scale(-1,1)'}}
      />
      <InputContainer>
        <MyInput
          ref={(r) => (store.inputRef = r)}
          spellCheck={false}
          onKeyDown={onKeyDown}
          onMouseDown={onMouseDown}
          onSelect={onSelect}
          onBlur={onBlur}
          onFocus={onFocus}
          onMouseUp={onMouseUp}
          onChange={onChange}
          placeholder="搜索或输入网址"
          onContextMenu={onContextMenu}
          visible={!store.addressbarTextVisible || store.addressbarValue === ''}
          value={store.addressbarValue}
        ></MyInput>
        <Text
          visible={store.addressbarTextVisible && store.addressbarValue !== ''}
        >
          {store.addressbarUrlSegments.map((item, key) => (
            <div
              key={key}
              style={{
                opacity: item.grayOut ? 0.54 : 1,
              }}
            >
              {item.value}
            </div>
          ))}
        </Text>
      </InputContainer>
      {!store.isCompact && <SiteButtons/>}
    </StyledAddressBar>
  );
});
