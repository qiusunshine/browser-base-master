import * as React from 'react';
import {observer} from 'mobx-react-lite';
import {ThemeProvider} from 'styled-components';

import {StyledApp, Title, Row, Label, Buttons, SmallRow, SmallRow2} from './style';
import store from '../../store';
import {Button} from '~/renderer/components/Button';
import {UIStyle} from '~/renderer/mixins/default-styles';

const {BrowserWindow} = require('@electron/remote');
import MyInput from "./input";
import {ipcRenderer} from "electron";

const onDone = () => {
  store.hide();
};
const onChange = () => {
  store.adListUrls = store.titleRef.current.value;
};
const save = () => {
  console.log(store.adListUrls);
  ipcRenderer.send('update-ad-lists', store.adListUrls);
  store.hide();
};
export const App = observer(() => {
  return (
    <ThemeProvider theme={{...store.theme}}>
      <StyledApp visible={store.visible}>
        <UIStyle/>
        <Title>{"当前页面拦截（" + store.list.length + "）"}</Title>
        <div style={{overflow: "auto", maxHeight: 200}}>
          {store.list.map((item) => (
            <div>
              <SmallRow>
                <Label className={"ellipsis-line"}>{item.url}</Label>
              </SmallRow>
              <SmallRow2>
                <Label>{"被 " + item.filter + " 拦截"}</Label>
              </SmallRow2>
            </div>
          ))}
        </div>
        <Row>
          <Label>{"编辑订阅地址，当前规则数：" + store.filterCount}</Label>
        </Row>
        <Row style={{minHeight: 150}}>
          <MyInput
            type={"textarea"}
            tabIndex={0}
            placeholder={"订阅地址，一行一个，支持ublock/adblockplus/adguard格式"}
            ref={store.titleRef}
            onChange={onChange}
            value={store.adListUrls}
          />
        </Row>
        <Buttons>
          <Button onClick={save}>保存</Button>
          <Button onClick={onDone}>取消</Button>
        </Buttons>
      </StyledApp>
    </ThemeProvider>
  );
});
