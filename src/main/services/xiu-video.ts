import OnHeadersReceivedListenerDetails = Electron.OnHeadersReceivedListenerDetails;
import {Application} from "~/main/application";

const m3u8Types = ["application/vnd.apple.mpegurl", "application/mpegurl", "application/x-mpegurl", "audio/mpegurl", "audio/x-mpegurl", "application/x-mpeg"]

export interface VideoRequest {
  url: string,
  requestHeaders?: Record<string, string>,
  referrer: string,
  frameUrl?: string
}

//记录请求头headers
export const recordUrlRequest = (details: Electron.OnBeforeSendHeadersListenerDetails) => {
  const {webContentsId, url, requestHeaders} = details;
  if (webContentsId) {
    const view = Application.instance.windows.current.viewManager.getById(webContentsId);
    if (view) {
      view.requestRecord.set(url, requestHeaders);
    }
  }
}
//记录m3u8格式链接，用于后续blob地址的替换
//todo 支持其它格式
export const filterVideo = (details: OnHeadersReceivedListenerDetails) => {
  const {webContentsId, url, frame, referrer, resourceType, responseHeaders} = details;
  if (resourceType == 'xhr' || resourceType == "object" || resourceType == "media" || resourceType == "other") {
    if (url.includes(".m3u8") || (responseHeaders && responseHeaders["Content-Type"] && m3u8Types.includes(responseHeaders["Content-Type"][0]))) {
      const view = Application.instance.windows.current.viewManager.getById(webContentsId);
      if (!view) {
        return
      }
      const request: VideoRequest = {
        url,
        referrer,
        frameUrl: (frame || {}).url,
        requestHeaders: view.requestRecord.get(url)
      };
      //console.log(url, referrer, request.requestHeaders);
      view.addNetVideoRequest(request);
    }
  }
}

//找到video组件
export const findVideoCode = `
          function findLargestPlayingVideo() {
            const videos = Array.from(document.querySelectorAll('video'))
              .filter(video => video.readyState != 0)
              // .filter(video => video.disablePictureInPicture == false)
              .sort((v1, v2) => {
                const v1Rect = v1.getClientRects()[0]||{width:0,height:0};
                const v2Rect = v2.getClientRects()[0]||{width:0,height:0};
                return ((v2Rect.width * v2Rect.height) - (v1Rect.width * v1Rect.height));
              });
            if (videos.length === 0) {
              return;
            }
            return videos[0];
          }
      `;


//暂停播放
const pauseCode = `
        (() => {
              ${findVideoCode}
              (async () => {
                const video = findLargestPlayingVideo();
                if (!video) {
                  return;
                }
                video.pause();
              })();
        })();
          `;


//全屏播放
const fullscreenCode = `
    (() => {
          ${findVideoCode}
          (async () => {
            const video = findLargestPlayingVideo();
            if (!video) {
              return;
            }
            function hasClick(item) {
              if (item.onclick) {
                return true;
              }
              return typeof hasClickEvent000 != 'undefined' && hasClickEvent000(item);
            }
        
            function hasBtnSize(item) {
              if (item.clientWidth <= 0 || item.clientHeight <= 0) {
                const styles = window.getComputedStyle(item);
                const height = styles.getPropertyValue('height');
                const width = styles.getPropertyValue('width');
                return height != '0px' && width != '0px' && height != '0' && width != '0';
              }
              if (item.clientWidth > 100) {
                return false;
              }
              if (item.clientHeight > 100) {
                return false;
              }
              return true;
            }
        
            function findFullscreenNode(node) {
              let tag = node.tagName.toLowerCase();
              if (tag == "video" || tag == "link" || tag == "script" || tag == "use" || tag == "svg") {
                return null;
              }
              let html = (node.outerHTML || "").toLowerCase();
              if (!html.includes("fullscreen") && !html.includes("full-screen") && !html.includes("全屏")) {
                return null;
              }
              let arr1 = Array.from(node.children || []);
              if(arr1.length > 0) {
                let childNodes = [];
                for (let item of arr1) {
                  let child = findFullscreenNode(item);
                  if(child) {
                    childNodes.push(child);
                  }
                }
                //筛选一下
                let nodes1 = [];
                let nodes2 = [];
                for (let item of childNodes) {
                  let html1 = (item.outerHTML || "").toLowerCase();
                  if(html1.includes("网页全屏") || html1.includes("页面全屏")) {
                    nodes1.push(item);
                  } else {
                    nodes2.push(item);
                  }
                }
                if(nodes2.length > 0) {
                  return nodes2[0];
                }
                if(nodes1.length > 0) {
                  return nodes1[0];
                }
              } 
              if(hasBtnSize(node) && hasClick(node)) {
                return node;
              }
              return null;
            }
            
            function checkFullscreenBtn(video) {
              try {
                let now = video;
                let parent = video.parentNode;
                let count = 0;
                let found;
                while(count <= 5) {
                  if(parent == null) {
                    console.log('parent == null');
                    return;
                  }
                  for(let node of parent.children) {
                    if(node === now) {
                      continue;
                    }
                    found = findFullscreenNode(node);
                    if(found) {
                      console.log(found);
                      found.click();
                      return;
                    }
                  }
                  now = parent;
                  parent = parent.parentNode;
                  count++;
                }
              } catch(e) {
                console.log(e);
              }
            }
            checkFullscreenBtn(video);
            function isFullscreen() {
              return document.fullscreenElement != null
               || document.webkitFullscreenElement != null
               || document.mozFullscreenElement != null;
            }
            let isFull = isFullscreen();
            console.log("isFullscreen", isFull);
            if(!isFull) {
              setTimeout(() => {
                isFull = isFullscreen();
                console.log("isFullscreen2", isFull);
                if(!isFull) {
                  if (video.requestFullscreen) {
                    video.requestFullscreen();
                  } else if (video.mozRequestFullScreen) {
                    video.mozRequestFullScreen();
                  } else if (video.webkitRequestFullscreen) {
                    video.webkitRequestFullscreen();
                  } else if (video.msRequestFullscreen) {
                    video.msRequestFullscreen();
                  }
                }
              }, 100);
            }
          })();
    })();
      `;


//画中画模式播放
const floatCode = `
    (() => {
          ${findVideoCode}
          async function requestPictureInPicture(video) {
            await video.requestPictureInPicture();
            video.setAttribute('__pip__', true);
            video.addEventListener('leavepictureinpicture', event => {
              video.removeAttribute('__pip__');
            }, { once: true });
            new ResizeObserver(maybeUpdatePictureInPictureVideo).observe(video);
          }
          function maybeUpdatePictureInPictureVideo(entries, observer) {
            const observedVideo = entries[0].target;
            if (!document.querySelector('[__pip__]')) {
              observer.unobserve(observedVideo);
              return;
            }
            const video = findLargestPlayingVideo();
            if (video && !video.hasAttribute('__pip__')) {
              observer.unobserve(observedVideo);
              requestPictureInPicture(video);
            }
          }
          (async () => {
            const video = findLargestPlayingVideo();
            if (!video) {
              return;
            }
            if (video.hasAttribute('__pip__')) {
              document.exitPictureInPicture();
              return;
            }
            await requestPictureInPicture(video);
          })();
    })();
      `;

export const getVideoPlayCode = (method: string) => {
  if (method == "other") {
    return pauseCode;
  }
  if (method == "full") {
    return fullscreenCode;
  }
  return floatCode;
}


//拦截监听页面添加点击事件
export const hookClickCode = `
        try {
          //console.log('injectJS2', location.href);
          if(typeof originalAddEventListener == 'undefined') {
            originalAddEventListener = EventTarget.prototype.addEventListener;
            let clickEventMap000 = new Map();
            EventTarget.prototype.addEventListener = function(type, listener, options) {
              if (type === 'click') {
                clickEventMap000.set(this, 1);
              }
              originalAddEventListener.call(this, type, listener, options);
            };
            hasClickEvent000 = function(element) {
              return clickEventMap000.has(element);
            };
          }
        } catch(e) {
          //console.log('injectJS2', e);
        }
      `;


//监听页面中的视频链接和组件
export const watchVideoCode = `
    (() => {
        function getParentWindow00(w) {
          // 如果当前窗口是最顶层窗口，则停止递归
          if (w === w.parent) {
            return w;
          }
          if(w.parent) {
            return getParentWindow00(w.parent);
          } else {
            return w;
          }
        }
        function findVideos00(c) {
          try {
            const urls = Array.from(document.getElementsByTagName('video'))
            .filter(video => video && video.src).map((video) => video.src);
            //console.log(‘video’, document.getElementsByTagName('video'));
            //console.log(urls);
            if(urls && urls.length > 0) {
              for (let v of urls) {
                v && getParentWindow00(window).postMessage({ type: 'xiu-video-created', src: v }, '*');
              }
            } else if(c < 10){
              c++;
              setTimeout(() => {
                findVideos00(c);
              }, c < 3 ? 500 : 1000);
            }
          } catch(e) {
            console.log(e);
          }
        }
        findVideos00(0);
        const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
          if (mutation.type === 'childList') {
            for (const addedNode of mutation.addedNodes) {
              if (addedNode instanceof HTMLVideoElement) {
                const src = addedNode.getAttribute('src');
                if(src) {
                  getParentWindow00(window).postMessage({ type: 'xiu-video-created', src }, '*');
                }
              }
            }
          }
        }
      });
      if(document.body) observer.observe(document.body, { childList: true, subtree: true });
    })();true
      `