const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api/submit-contract',
    createProxyMiddleware({
      target: 'https://script.google.com',
      changeOrigin: true,
      pathRewrite: {
        // เขียนใหม่เป็นเส้นทาง Web App + query ที่ต้องการ
        '^/api/submit-contract$': '/macros/s/<DEPLOYMENT_ID>/exec?path=submit',
      },
    })
  );
};
