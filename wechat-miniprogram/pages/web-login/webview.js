Page({
  data: {
    src: '',
    loadError: false,
    loginUrl: 'https://www.the-one-and-the-two.com/login',
  },
  onLoad(query) {
    let src = query && typeof query.src === 'string' ? query.src : '';
    try {
      if (!src.startsWith('https://')) src = decodeURIComponent(src);
    } catch {
      src = '';
    }
    if (!/^https:\/\/(www\.)?the-one-and-the-two\.com(?:[/?#]|$)/.test(src)) {
      this.setData({ src: '', loadError: true });
      return;
    }
    this.setData({ src, loadError: false });
  },
  onLoadError() {
    this.setData({ loadError: true });
  },
  retry() {
    if (!this.data.src) return;
    this.setData({ loadError: false });
  },
  copyLoginUrl() {
    wx.setClipboardData({
      data: this.data.loginUrl,
      fail: () => wx.showToast({ title: '复制未完成，请重试', icon: 'none' }),
    });
  },
});
