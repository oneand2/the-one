const API_BASE = 'https://www.the-one-and-the-two.com';

Page({
  data: {
    status: 'pending',
    message: '正在确认身份',
    completeUrl: '',
  },

  onLoad(query) {
    const ticket = ((query && query.ticket) || '').trim();
    this.ticket = ticket;
    if (!/^[a-f0-9]{32}$/.test(ticket)) {
      this.setData({
        status: 'missing',
        message: '请从网站登录页进入，不要直接打开这个页面',
      });
      return;
    }
    this.confirm(ticket);
  },

  confirm(ticket) {
    this.setData({ status: 'pending', message: '正在确认身份' });
    wx.login({
      success: (res) => {
        if (!res.code) {
          this.setData({ status: 'error', message: '未能取得微信凭证' });
          return;
        }
        wx.request({
          url: `${API_BASE}/api/auth/wechat/miniprogram/login`,
          method: 'POST',
          header: { 'content-type': 'application/json' },
          data: { ticket, code: res.code },
          success: (resp) => {
            const data = resp.data || {};
            if (resp.statusCode >= 200 && resp.statusCode < 300 && data.ok) {
              this.setData({
                status: 'ok',
                message: '已确认，正在返回网站',
                completeUrl: data.completeUrl || '',
              });
              setTimeout(() => {
                if (typeof wx.exitMiniProgram === 'function') {
                  wx.exitMiniProgram();
                }
              }, 360);
              return;
            }
            this.setData({
              status: 'error',
              message: data.error || '登录未完成',
            });
          },
          fail: () => {
            this.setData({
              status: 'error',
              message: '网络未通。请在小程序后台把 request 合法域名设为 www.the-one-and-the-two.com',
            });
          },
        });
      },
      fail: () => {
        this.setData({ status: 'error', message: '微信登录未完成' });
      },
    });
  },

  retry() {
    if (this.ticket) this.confirm(this.ticket);
  },

  openSite() {
    const src = this.data.completeUrl;
    if (!src) return;
    wx.navigateTo({
      url: `/pages/web-login/webview?src=${encodeURIComponent(src)}`,
    });
  },
});
