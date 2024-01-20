import * as React from 'react';

import {Header, Row, Title, Control, SecondaryText} from '../App/style';
import { Button } from '~/renderer/components/Button';
import store from '../../store';
import { BLUE_500 } from '~/renderer/constants';
import { observer } from 'mobx-react-lite';
import { onSwitchChange } from '../../utils';
import { Switch } from '~/renderer/components/Switch';
import {NormalButton} from "~/renderer/views/settings/components/App";
import BrowsingDataDialog from "~/renderer/views/settings/components/Privacy/BrowsingDataDialog";

const onClearBrowsingData = () => {
  store.dialogContent = 'privacy';
};
const showAdblockRule = () => {
  window.postMessage(
    {
      type: 'show-adblock-rule'
    }, "*");
};

const DoNotTrackToggle = observer(() => {
  const { doNotTrack } = store.settings;

  return (
    <Row onClick={onSwitchChange('doNotTrack')}>
      <Title>
        Send a &quot;Do Not Track&quot; request with your browsing traffic
      </Title>
      <Control>
        <Switch value={doNotTrack} />
      </Control>
    </Row>
  );
});

export const Privacy = () => {
  return (
    <>
      <Header>拦截保护</Header>
      <Row>
        <div>
          <Title>广告拦截订阅</Title>
          <SecondaryText>支持订阅 ublock、adblockplus、adguard 格式地址</SecondaryText>
        </div>
        <Control>
          <NormalButton onClick={showAdblockRule}>修改</NormalButton>
        </Control>
      </Row>
      
      <Row>
        <div>
          <Title>浏览数据</Title>
        </div>
        <Control>
          <NormalButton onClick={onClearBrowsingData}>清除</NormalButton>
        </Control>
      </Row>
      <BrowsingDataDialog/>
      <DoNotTrackToggle />
    </>
  );
};
