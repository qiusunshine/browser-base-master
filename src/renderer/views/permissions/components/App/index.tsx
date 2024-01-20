import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { ThemeProvider } from 'styled-components';

import { StyledApp, Title, Permissions, Permission, Buttons } from './style';
import store from '../../store';
import { Button } from '~/renderer/components/Button';
import { UIStyle } from '~/renderer/mixins/default-styles';

const sendResult = (r: boolean) => {
  store.send('result', r);
};

const getText = (permission: string) => {
  if (permission === 'notifications') {
    return '发送通知消息';
  }

  if (permission === 'microphone') {
    return '使用麦克风';
  }

  if (permission === 'camera') {
    return '使用摄像头';
  }

  if (permission === 'geolocation') {
    return '获取位置信息';
  }

  return "获取" + permission + "权限";
};

export const App = observer(() => {
  return (
    <ThemeProvider theme={{ ...store.theme }}>
      <StyledApp>
        <UIStyle />
        <Title>网站 {store.domain} 想要：</Title>
        <Permissions>
          {store.permissions.map((item) => (
            <Permission key={item}>{getText(item)}</Permission>
          ))}
        </Permissions>
        <Buttons>
          <Button
            background={
              store.theme['dialog.lightForeground']
                ? 'rgba(255, 255, 255, 0.08)'
                : 'rgba(0, 0, 0, 0.08)'
            }
            foreground={
              store.theme['dialog.lightForeground'] ? 'white' : 'black'
            }
            onClick={() => sendResult(true)}
          >
            允许
          </Button>
          <Button
            background={
              store.theme['dialog.lightForeground']
                ? 'rgba(255, 255, 255, 0.08)'
                : 'rgba(0, 0, 0, 0.08)'
            }
            foreground={
              store.theme['dialog.lightForeground'] ? 'white' : 'black'
            }
            style={{ marginLeft: 8 }}
            onClick={() => sendResult(false)}
          >
            拒绝
          </Button>
        </Buttons>
        <div style={{ clear: 'both' }}></div>
      </StyledApp>
    </ThemeProvider>
  );
});
