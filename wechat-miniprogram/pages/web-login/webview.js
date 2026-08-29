Page({
  data: {
    src: '',
  },
  onLoad(query) {
    this.setData({
      src: decodeURIComponent((query && query.src) || ''),
    });
  },
});
