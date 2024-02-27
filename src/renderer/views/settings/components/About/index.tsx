import * as React from 'react';

import {Header, Row, Title, Control, SecondaryText} from '../App/style';
import {NormalButton} from "~/renderer/views/settings/components/App";
import store from "~/renderer/views/settings/store";
const goUrl = (url: string) => () => {
  window.location.href = url;
};

export const About = () => {
  let chromeVersion = navigator.userAgent;
  try {
    const chromeVersionRegex = /Chrome\/([\d\.]+)/;
    const matches = navigator.userAgent.match(chromeVersionRegex);
    if (matches) {
      chromeVersion = matches[1];
    }
  } catch (e) {
    console.log(e);
  }
  return (
    <>
      <Header>关于</Header>
      <Row>
        <div>
          <Title>官方博客</Title>
        </div>
        <Control>
          <NormalButton onClick={goUrl("https://haikuoshijie.cn")}>查看</NormalButton>
        </Control>
      </Row>
      <Row>
        <div>
          <Title>新版本地址</Title>
          <SecondaryText onClick={goUrl("https://haikuoshijie.cn")}>https://haikuoshijie.cn</SecondaryText>
        </div>
        <Control>
          <NormalButton onClick={goUrl("https://www.123pan.com/s/fajA-2nyQh.html")}>查看</NormalButton>
        </Control>
      </Row>
      <Row>
        <div>
          <Title>当前版本：{store.appVersion}</Title>
          <SecondaryText>Chromium {chromeVersion}</SecondaryText>
        </div>
      </Row>
    </>
  );
};
