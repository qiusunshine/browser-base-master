import * as React from 'react';
import {observer} from 'mobx-react-lite';
import * as remote from '@electron/remote';

import {Title, SubTitle, Back} from './style';

import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
} from '~/renderer/components/ContextMenu';
import {Switch} from '~/renderer/components/Switch';
import {Dropdown} from '~/renderer/components/Dropdown';

import store, {Preset} from '../../store';
import {ICON_WINDOW, ICON_BACK} from '~/renderer/constants';
import {useRef} from "react";

const onBackClick = () => {
  store.preferencesContent = 'main';
};

const onCustomClick = () => {
  store.preferencesContent = 'custom';
  store.preset = 'custom';
};

const onNewsVisibilityChange = (value: any) => {
  store.newsBehavior = value;
  localStorage.setItem('newsBehavior', value);
};

const onSwitchClick = (name: string) => () => {
  (store as any)[name] = !(store as any)[name];
  localStorage.setItem(name, (store as any)[name].toString());
};

const onPresetClick = (name: Preset) => () => {
  store.preset = name;
};

export const SwitchItem = observer(
  ({
     children,
     name,
     disabled,
   }: {
    children: any;
    name: string;
    disabled?: boolean;
  }) => {
    return (
      <ContextMenuItem bigger disabled={disabled} onClick={onSwitchClick(name)}>
        <div style={{flex: 1}}>{children}</div>
        <Switch value={(store as any)[name]}></Switch>
      </ContextMenuItem>
    );
  },
);

export const Preferences = observer(() => {

  const fileInputRef = useRef(null);
  const handleButtonClick = () => {
    fileInputRef.current.click();
  };
  const handleFileSelect = (event: any) => {
    const file = event.target.files[0];
    const maxSize = 4 * 1024 * 1024; // 设置最大文件大小为4MB
    if (file && file.size <= maxSize) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const imageData = reader.result;
        if (typeof imageData === "string") {
          store.updateImage(imageData);
          console.log(imageData);
        }
      };
      reader.readAsDataURL(file);
    } else {
      alert("请选择正确的图片文件，且文件大小不要超过4MB");
    }
  };

  return (
    <ContextMenu
      translucent
      bigger
      style={{right: 32, top: 68, width: 275}}
      visible={store.dashboardSettingsVisible}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        style={{
          display: 'flex',
          overflow: store.overflowVisible ? 'visible' : 'hidden',
          position: 'relative',
          transform: 'translate(0, 0)',
        }}
      >
        <div
          style={{
            opacity: store.preferencesContent === 'main' ? 1 : 0,
            minWidth: 275,
            transition: '0.3s opacity, 0.3s transform',
            top: 0,
            left: 0,
            pointerEvents:
              store.preferencesContent === 'main' ? 'inherit' : 'none',
            transform:
              store.preferencesContent === 'main'
                ? 'none'
                : 'translateX(-100%)',
          }}
        >
          <Title style={{marginLeft: 20}}>主页定制</Title>

          <ContextMenuSeparator bigger></ContextMenuSeparator>

          <ContextMenuItem
            bigger
            onClick={onPresetClick('focused')}
            selected={store.preset === 'focused'}
            iconSize={28}
            icon={ICON_WINDOW}
          >
            专注
          </ContextMenuItem>
          <ContextMenuItem
            bigger
            onClick={onPresetClick('inspirational')}
            selected={store.preset === 'inspirational'}
            iconSize={28}
            icon={ICON_WINDOW}
          >
            灵动
          </ContextMenuItem>
          {/* <ContextMenuItem
            bigger
            onClick={onPresetClick('informational')}
            selected={store.preset === 'informational'}
            iconSize={28}
            icon={ICON_WINDOW}
          >
            Informational
          </ContextMenuItem> */}
          <ContextMenuItem
            bigger
            selected={store.preset === 'custom'}
            onClick={onCustomClick}
            iconSize={28}
            icon={ICON_WINDOW}
          >
            自定义
          </ContextMenuItem>
        </div>
        <div
          style={{
            minWidth: 275,
            position: 'relative',
            opacity: store.preferencesContent === 'custom' ? 1 : 0,
            pointerEvents:
              store.preferencesContent === 'custom' ? 'inherit' : 'none',
            transition: '0.3s max-height, 0.3s transform, 0.3s opacity',
            // maxHeight: store.preferencesContent === 'custom' ? 390 : 200,
            maxHeight: store.preferencesContent === 'custom' ? 300 : 150,
            transform:
              store.preferencesContent === 'custom'
                ? 'translateX(-100%)'
                : 'none',
          }}
        >
          <Title>
            <Back onClick={onBackClick} icon={ICON_BACK}></Back>
            自定义
          </Title>
          <ContextMenuSeparator bigger></ContextMenuSeparator>
          <SwitchItem name="imageVisible">显示壁纸</SwitchItem>
          <SwitchItem disabled={!store.imageVisible} name="changeImageDaily">
            每天切换壁纸
          </SwitchItem>
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            style={{display: 'none'}}
            onChange={handleFileSelect}
          />
          <ContextMenuItem
            bigger
            onClick={handleButtonClick}
            disabled={!store.imageVisible || store.changeImageDaily}
          >
            选择图片...
          </ContextMenuItem>
          <ContextMenuSeparator bigger></ContextMenuSeparator>
          <SwitchItem name="topSitesVisible">显示近期访问的网站</SwitchItem>
          <SwitchItem name="quickMenuVisible">显示快捷菜单</SwitchItem>
          {/* <ContextMenuSeparator bigger></ContextMenuSeparator>
          <SubTitle>News visibility:</SubTitle>
          <Dropdown
            defaultValue={store.newsBehavior}
            onMouseDown={() => (store.overflowVisible = true)}
            style={{ margin: '0 20px 8px' }}
            onChange={onNewsVisibilityChange}
          >
            <Dropdown.Item value="always-visible">Always visible</Dropdown.Item>
            <Dropdown.Item value="hidden">Hidden</Dropdown.Item>
            <Dropdown.Item value="on-scroll">Visible on scroll</Dropdown.Item>
          </Dropdown> */}
        </div>
      </div>
    </ContextMenu>
  );
});
