import * as React from 'react';
import { observer } from 'mobx-react-lite';

import { Item, Icon, Title } from './style';
import { IHistoryItem } from '~/interfaces';
import store from '../../store';
import { ICON_PAGE } from '~/renderer/constants';
import {getWebUIURL} from "~/common/webui";

const onClick = (url: string) => () => {
  console.log("TopSite", url);
  if (url != '' && url != null) {
    window.location.href = url;
  } else {
    window.location.href = getWebUIURL('bookmarks');
  }
};

export const TopSite = observer(({ item }: { item?: IHistoryItem }) => {
  const { title, favicon, url } = item || {};
  const custom = favicon === '' || favicon == null;

  let fav = ICON_PAGE;

  if (!custom) {
    fav = favicon;
  } else if(url && url.startsWith("http")){
    try {
      fav = new URL('/favicon.ico', url).href;
    } catch (e) {
      console.log(e);
    }
  }

  return (
    <Item imageSet={store.imageVisible && store.image} onClick={onClick(url)}>
      <Icon
        imageSet={store.imageVisible && store.image}
        custom={custom}
        icon={fav}
        onError={"this.style.backgroundImage='url(" + ICON_PAGE + ")'"}
        add={url == null || url == ''}
      ></Icon>
      {title && <Title>{title}</Title>}
    </Item>
  );
});
