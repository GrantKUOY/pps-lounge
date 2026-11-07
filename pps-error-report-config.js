window.PPS_ERROR_REPORT_CONFIG = {
  // 錯誤回報改走外部表單（原 Apps Script 回饋端點已無法匿名存取，見 W3 查證紀錄）。
  // 將這裡改成你建立好的 Google Form 連結後，據點詳情才會顯示「回報錯誤」入口，例如：
  // formUrl: "https://docs.google.com/forms/d/e/xxxxxxxxxxxxxxxx/viewform",
  // 留空字串時不顯示入口，站上其他功能不受影響。
  formUrl: "https://docs.google.com/forms/d/e/1FAIpQLSd85Jml8Jx0N72G7Nw0--L1B8uUFZyVTHHs_JYnIQ-w8y0WBQ/viewform",
};
