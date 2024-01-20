import * as React from 'react';

import { Switch } from '~/renderer/components/Switch';
import { Title, Row, Control, Header, SecondaryText } from '../App/style';
import store from '../../store';
import { onSwitchChange } from '../../utils';
import { ipcRenderer } from 'electron';
import { observer } from 'mobx-react-lite';
import { NormalButton } from '../App';

const AskToggle = observer(() => {
  const { downloadsDialog } = store.settings;

  return (
    <Row onClick={onSwitchChange('downloadsDialog')}>
      <Title>下载前询问</Title>
      <Control>
        <Switch value={downloadsDialog} />
      </Control>
    </Row>
  );
});

const onChangeClick = () => {
  ipcRenderer.send('downloads-path-change');
};

const Location = observer(() => {
  return (
    <Row>
      <div>
        <Title>下载位置</Title>
        <SecondaryText>{store.settings.downloadsPath}</SecondaryText>
      </div>

      <Control>
        <NormalButton onClick={onChangeClick}>修改</NormalButton>
      </Control>
    </Row>
  );
});

export const Downloads = () => {
  return (
    <>
      <Header>下载</Header>
      <Location />
      <AskToggle />
    </>
  );
};
