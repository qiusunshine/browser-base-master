import * as React from 'react';

import { Dropdown } from '~/renderer/components/Dropdown';
import { Switch } from '~/renderer/components/Switch';
import { Title, Row, Control, Header } from '../App/style';
import store from '../../store';
import { onSwitchChange } from '../../utils';
import { observer } from 'mobx-react-lite';
import { TopBarVariant } from '~/interfaces';

const onThemeChange = (value: string) => {
  if (value === 'auto') {
    store.settings.themeAuto = true;
  } else {
    store.settings.themeAuto = false;
    store.settings.theme = value;
  }

  store.save();
};

const ThemeVariant = observer(() => {
  const defaultValue = store.settings.theme;

  return (
    <Row>
      <Title>主题颜色</Title>
      <Control>
        <Dropdown
          defaultValue={store.settings.themeAuto ? 'auto' : defaultValue}
          onChange={onThemeChange}
        >
          <Dropdown.Item value="auto">自动</Dropdown.Item>
          <Dropdown.Item value="wexond-light">浅色</Dropdown.Item>
          <Dropdown.Item value="wexond-dark">深色</Dropdown.Item>
        </Dropdown>
      </Control>
    </Row>
  );
});

const onTopBarChange = (value: TopBarVariant) => {
  store.settings.topBarVariant = value;
  store.save();
};

const TopBarVariant = observer(() => {
  return (
    <Row>
      <Title>顶部标题栏</Title>
      <Control>
        <Dropdown
          defaultValue={store.settings.topBarVariant}
          onChange={onTopBarChange}
        >
          <Dropdown.Item value="default">分离显示</Dropdown.Item>
          <Dropdown.Item value="compact">融合显示</Dropdown.Item>
        </Dropdown>
      </Control>
    </Row>
  );
});

const WarnQuit = observer(() => {
  const { warnOnQuit } = store.settings;

  return (
    <Row onClick={onSwitchChange('warnOnQuit')}>
      <Title>当关闭多个标签时显示警告弹窗</Title>
      <Control>
        <Switch value={warnOnQuit} />
      </Control>
    </Row>
  );
});

const MenuAnimations = observer(() => {
  const { animations } = store.settings;

  return (
    <Row onClick={onSwitchChange('animations')}>
      <Title>菜单动画</Title>
      <Control>
        <Switch value={animations} />
      </Control>
    </Row>
  );
});

const BookmarksBar = observer(() => {
  const { bookmarksBar } = store.settings;

  return (
    <Row onClick={onSwitchChange('bookmarksBar')}>
      <Title>显示书签栏</Title>
      <Control>
        <Switch value={bookmarksBar} />
      </Control>
    </Row>
  );
});

export const Appearance = observer(() => {
  return (
    <>
      <Header>个性化</Header>
      {/* <MenuAnimations /> */}
      <BookmarksBar />
      <WarnQuit />
      <ThemeVariant />
      <TopBarVariant />
    </>
  );
});
