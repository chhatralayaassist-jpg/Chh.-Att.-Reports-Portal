export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Loading…</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #fafafa; color: #111; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 24rem; width: 100%; text-align: center; padding: 2rem; }
      .spinner { width: 34px; height: 34px; margin: 0 auto 1rem; border: 3px solid #e5e7eb; border-top-color: #111; border-radius: 50%; animation: spin .8s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }
      p { color: #4b5563; margin: 0; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="spinner"></div>
      <p>One moment, we're getting the portal ready…</p>
    </div>
    <script>
      (function () {
        try {
          var n = parseInt(sessionStorage.getItem('__retry') || '0', 10);
          sessionStorage.setItem('__retry', String(n + 1));
          var delay = Math.min(800 * (n + 1), 4000);
          setTimeout(function () {
            if (n >= 3) { sessionStorage.setItem('__retry', '0'); location.href = '/'; }
            else { location.reload(); }
          }, delay);
        } catch (e) {
          setTimeout(function () { location.reload(); }, 1200);
        }
      })();
    </script>
  </body>
</html>`;
}
