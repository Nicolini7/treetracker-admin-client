async (page) => {
  await page.route('**/*', (route) => {
    const host = new URL(route.request().url()).hostname;
    return ['127.0.0.1', 'localhost'].includes(host)
      ? route.continue()
      : route.abort('blockedbyclient');
  });
  await page.addInitScript(() => {
    localStorage.setItem('user', JSON.stringify({
      id: 1, userName: 'local-verifier', firstName: 'Local', lastName: 'Verifier',
      policy: { policies: ['greenstand-admin', 'super_permission', 'approve_tree', 'list_tree'].map((name) => ({ name })) },
    }));
    localStorage.setItem('token', JSON.stringify('local-fixture-token'));
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:3001/verify');
}
