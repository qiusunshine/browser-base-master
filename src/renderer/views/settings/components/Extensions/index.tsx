import * as React from 'react';

import {Header, Title} from '../App/style';
import {Button} from '~/renderer/components/Button';
import {BLUE_500} from '~/renderer/constants';
import {ipcRenderer} from "electron";
import {NormalButton} from "~/renderer/views/settings/components/App";

const loadExtensionFromCrx = async () => {
  const res = await ipcRenderer.invoke('load-extension-from-crx');
  //console.log("loadExtensionFromCrx", res);
  if (res && res.name) {
    alert("已加载扩展程序" + res.name);
  }
};
const loadExtensionFromDir = async () => {
  const res = await ipcRenderer.invoke('load-extension-from-dir');
  if (res && res.name) {
    alert("已加载扩展程序" + res.name);
  }
};
const loadExtensionFromWeb = (url: string) => () => {
  window.location.href = url;
};

export const Extensions = () => {
  return (
    <>
      <Header>扩展程序</Header>
      <div style={{marginTop: 10}}>
        <NormalButton
          onClick={loadExtensionFromWeb("https://microsoftedge.microsoft.com/addons/Microsoft-Edge-Extensions-Home?hl=zh-CN")}
        >
          从Edge扩展程序商店安装
        </NormalButton>
      </div>
      <div style={{marginTop: 10}}>
        <NormalButton
          onClick={loadExtensionFromWeb("https://www.crxsoso.com/")}
        >
          从Crx搜搜扩展商店安装
        </NormalButton>
      </div>
      <div style={{marginTop: 10}}>
        <NormalButton
          onClick={loadExtensionFromCrx}
        >
          从本地加载crx扩展程序
        </NormalButton>
      </div>
      <div style={{marginTop: 10}}>
        <NormalButton
          onClick={loadExtensionFromDir}
        >
          加载已解压的扩展程序文件夹
        </NormalButton>
      </div>
    </>
  );
};
