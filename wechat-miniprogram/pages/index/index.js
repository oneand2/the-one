const API_BASE = 'https://www.the-one-and-the-two.com';
const SITE_HOME = `${API_BASE}/?embed=miniprogram`;

Page({
  data: {
    src: '',
    message: '正在进入',
  },

  onLoad() {
    this.enter();
  },

  enter() {
    this.setData({ message: '正在进入' });
    wx.login({
      success: (res) => {
        if (!res.code) {
          this.openSite(SITE_HOME);
          return;
        }
        wx.request({
          url: `${API_BASE}/api/auth/wechat/miniprogram/app-open`,
          method: 'POST',
          header: { 'content-type': 'application/json' },
          data: { code: res.code },
          success: (resp) => {
            const data = resp.data || {};
            this.openSite(data.completeUrl || data.homeUrl || SITE_HOME);
          },
          fail: () => {
            this.openSite(SITE_HOME);
          },
        });
      },
      fail: () => {
        this.openSite(SITE_HOME);
      },
    });
  },

  openSite(src) {
    this.setData({ src });
  },
});
