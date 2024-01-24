import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { ThemeProvider } from 'styled-components';
import { StyledApp, Buttons } from './style';
import store from '../../store';
import { Button } from '~/renderer/components/Button';
import { ipcRenderer } from 'electron';
import { UIStyle } from '~/renderer/mixins/default-styles';


const onClick = (type: string) => () => {
  ipcRenderer.send(`show-${type}-video-dialog-${store.tabId}`);
  store.hide();
};
const onCopyClick = () => {
  const s = (store.videoUrls || []).join("\n");
  const textarea = document.createElement('textarea');
  textarea.value = s;
  document.body.appendChild(textarea);
  textarea.select();
  navigator.clipboard.writeText(textarea.value)
    .then(() => {
      alert("以下链接已复制到剪贴板：\n" + s);
    })
    .catch((error) => {
      alert("复制文本失败：\n" + error);
    });
  document.body.removeChild(textarea);
  store.hide();
};

export const App = observer(() => {
  const videoUrls = store.videoUrls || [];
  return (
    <ThemeProvider theme={{ ...store.theme }}>
      <StyledApp visible={store.visible}>
        <UIStyle />
        <Buttons>
          <Button onClick={onClick("full")}>全屏播放</Button>
          <Button onClick={onClick("float")}>悬浮播放</Button>
          <Button onClick={onClick("other")}>外部播放</Button>
          <Button onClick={onCopyClick}>复制地址</Button>
        </Buttons>
      </StyledApp>
    </ThemeProvider>
  );
});
