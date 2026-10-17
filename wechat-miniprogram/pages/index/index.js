Page({
  data: {
    loginUrl: 'https://www.the-one-and-the-two.com/login',
    opening: false,
  },

  openLogin() {
    if (this.data.opening) return;
    this.setData({ opening: true });
    wx.navigateTo({
      url: `/pages/web-login/webview?src=${encodeURIComponent(this.data.loginUrl)}`,
      fail: () => {
        wx.showToast({ title: '暂时无法打开，请复制网址后访问', icon: 'none' });
      },
      complete: () => this.setData({ opening: false }),
    });
  },

  copyLoginUrl() {
    wx.setClipboardData({
      data: this.data.loginUrl,
      fail: () => wx.showToast({ title: '复制未完成，请重试', icon: 'none' }),
    });
  },
});
